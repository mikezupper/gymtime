#![allow(clippy::expect_used)]
use crate::auth_tests::Fixture;
use gymtime_app::{
    auth::AuthError,
    schedule::{
        MutationIdentity, ResourceRef, ScheduleError, ScheduleService,
        commands::ScheduleAction as A,
    },
};
use gymtime_domain::{
    EmailAddress, GymSpace,
    auth::{OpaqueToken, UserId},
    schedule::*,
};
use std::sync::Arc;
fn name(s: &str) -> Name {
    Name::try_from(s).expect("invariant: fixture name")
}
fn email(s: &str) -> EmailAddress {
    EmailAddress::try_from(s).expect("invariant: fixture email")
}
fn date(s: &str) -> LocalDate {
    LocalDate::try_from(s).expect("invariant: fixture date")
}
fn time(s: &str) -> LocalTime {
    LocalTime::try_from(s).expect("invariant: fixture time")
}
fn version(v: i64) -> Version {
    Version::try_from(v).expect("invariant: positive version")
}
fn owner() -> UserId {
    UserId::try_from(1).expect("invariant: first account")
}
fn service(f: &Fixture) -> ScheduleService {
    ScheduleService {
        store: Arc::new(f.db.clone()),
        clock: f.service.clock.clone(),
        crypto: f.service.crypto.clone(),
        public_url: f.service.public_url.clone(),
    }
}
fn identity(value: u64, input: &str) -> MutationIdentity {
    MutationIdentity {
        key: OpaqueToken::try_from(format!("{value:064x}").as_str())
            .expect("invariant: fixture token"),
        canonical_input: input.to_owned(),
    }
}
fn configure() -> A {
    A::ConfigureGym {
        name: name("School gym"),
        timezone: GymTimezone::try_from("America/New_York").expect("invariant: fixture zone"),
        split: SplitMode::HalvesAvailable,
        hours: WeeklyHours::try_from(
            (0..7)
                .map(|day| {
                    (
                        Weekday::try_from(day).expect("invariant: weekday"),
                        OpeningHours::new(time("08:00"), time("22:00")).expect("invariant: hours"),
                    )
                })
                .collect::<Vec<_>>(),
        )
        .expect("invariant: weekly hours"),
        version: version(1),
    }
}
fn season(outcome: &gymtime_app::schedule::ActionOutcome) -> SeasonId {
    outcome
        .resources
        .iter()
        .find_map(|r| match r {
            ResourceRef::Season(id) => Some(*id),
            ResourceRef::User(_)
            | ResourceRef::Gym(_)
            | ResourceRef::Team(_)
            | ResourceRef::Slot(_)
            | ResourceRef::Closure(_)
            | ResourceRef::Booking(_)
            | ResourceRef::Request(_)
            | ResourceRef::Swap(_) => None,
        })
        .expect("invariant: season outcome")
}

#[tokio::test]
async fn setup_preserves_one_active_season_and_idempotency_rechecks_permissions() {
    let f = Fixture::new().await;
    let s = service(&f);
    s.mutate(owner(), configure(), identity(1, "configure"))
        .await
        .expect("invariant: configure");
    let first = s
        .mutate(
            owner(),
            A::CreateSeason {
                name: name("Winter"),
                dates: DateRange::new(date("2026-10-01"), date("2027-03-01"))
                    .expect("invariant: dates"),
            },
            identity(2, "winter"),
        )
        .await
        .expect("invariant: season");
    let id = season(&first);
    let retry = s
        .mutate(
            owner(),
            A::CreateSeason {
                name: name("Winter"),
                dates: DateRange::new(date("2026-10-01"), date("2027-03-01"))
                    .expect("invariant: dates"),
            },
            identity(2, "winter"),
        )
        .await
        .expect("invariant: replay");
    assert_eq!(season(&retry), id);
    assert!(matches!(
        s.mutate(
            owner(),
            A::CreateSeason {
                name: name("Other"),
                dates: DateRange::new(date("2026-10-01"), date("2027-03-01"))
                    .expect("invariant: dates")
            },
            identity(2, "other")
        )
        .await,
        Err(ScheduleError::IdempotencyMismatch)
    ));
    let future = s
        .mutate(
            owner(),
            A::CreateSeason {
                name: name("Spring"),
                dates: DateRange::new(date("2027-04-01"), date("2027-06-01"))
                    .expect("invariant: dates"),
            },
            identity(3, "spring"),
        )
        .await
        .expect("invariant: season");
    let future = season(&future);
    s.mutate(
        owner(),
        A::SetSeasonStatus {
            id,
            status: SeasonStatus::Active,
            version: version(1),
        },
        identity(4, "activate"),
    )
    .await
    .expect("invariant: activate");
    assert!(matches!(
        s.mutate(
            owner(),
            A::SetSeasonStatus {
                id: future,
                status: SeasonStatus::Active,
                version: version(1)
            },
            identity(5, "activate-future")
        )
        .await,
        Err(ScheduleError::ActiveSeasonExists)
    ));
    sqlx::query("DELETE FROM organizer_grants")
        .execute(&f.db.pool)
        .await
        .expect("invariant: revoke grant");
    assert!(matches!(
        s.mutate(owner(), configure(), identity(1, "configure"))
            .await,
        Err(ScheduleError::Auth(AuthError::Forbidden))
    ));
    f.db.close().await;
}

#[tokio::test]
async fn teams_and_slot_templates_decode_correctly_and_rollback_failures() {
    let f = Fixture::new().await;
    let s = service(&f);
    s.mutate(owner(), configure(), identity(10, "configure"))
        .await
        .expect("invariant: configure");
    let created = s
        .mutate(
            owner(),
            A::CreateSeason {
                name: name("Winter"),
                dates: DateRange::new(date("2026-10-01"), date("2027-03-01"))
                    .expect("invariant: range"),
            },
            identity(11, "season"),
        )
        .await
        .expect("invariant: season");
    let season = season(&created);
    sqlx::query("CREATE TRIGGER reject_association BEFORE INSERT ON team_seasons BEGIN SELECT RAISE(FAIL,'fixture'); END").execute(&f.db.pool).await.expect("invariant: trigger");
    assert!(
        s.mutate(
            owner(),
            A::CreateTeam {
                name: name("4th grade"),
                primary: email("coach@example.test"),
                season
            },
            identity(12, "team")
        )
        .await
        .is_err()
    );
    let snapshot = s
        .snapshot(owner())
        .await
        .expect("invariant: snapshot after rollback");
    assert!(snapshot.teams.is_empty());
    assert_eq!(
        f.service
            .list_accounts(owner())
            .await
            .expect("invariant: accounts")
            .len(),
        1
    );
    sqlx::query("DROP TRIGGER reject_association")
        .execute(&f.db.pool)
        .await
        .expect("invariant: remove trigger");
    s.mutate(
        owner(),
        A::CreateTeam {
            name: name("4th grade"),
            primary: email("coach@example.test"),
            season,
        },
        identity(12, "team"),
    )
    .await
    .expect("invariant: create team");
    s.mutate(
        owner(),
        A::CreateSlots {
            season,
            dates: DateRange::new(date("2026-10-05"), date("2026-10-26"))
                .expect("invariant: range"),
            weekdays: Weekdays::try_from(vec![0]).expect("invariant: Mondays"),
            hours: OpeningHours::new(time("16:00"), time("17:00")).expect("invariant: hours"),
            space: GymSpace::HalfA,
        },
        identity(13, "slots"),
    )
    .await
    .expect("invariant: template expands");
    let snapshot = s
        .snapshot(owner())
        .await
        .expect("invariant: full snapshot decodes");
    assert_eq!(snapshot.slots.len(), 4);
    assert_eq!(snapshot.teams.len(), 1);
    assert_eq!(
        snapshot.teams.first().expect("invariant: team").seasons,
        vec![season]
    );
    assert_eq!(snapshot.gym.hours.entries().len(), 7);
    f.db.close().await;
}

fn note(s: &str) -> Note {
    Note::try_from(s).expect("invariant: note")
}
fn select<T: Eq>(items: Vec<T>) -> Selection<T> {
    Selection::try_from(items).expect("invariant: selection")
}
async fn scenario(f: &Fixture) -> ScheduleService {
    let s = service(f);
    s.mutate(owner(), configure(), identity(100, "gym"))
        .await
        .expect("invariant: gym");
    let created = s
        .mutate(
            owner(),
            A::CreateSeason {
                name: name("Winter"),
                dates: DateRange::new(date("2026-10-01"), date("2026-12-01"))
                    .expect("invariant: dates"),
            },
            identity(101, "season"),
        )
        .await
        .expect("invariant: season");
    let season = season(&created);
    for (index, address) in ["a@example.test", "b@example.test", "a@example.test"]
        .iter()
        .enumerate()
    {
        s.mutate(
            owner(),
            A::CreateTeam {
                name: name(&format!("Team {index}")),
                primary: email(address),
                season,
            },
            identity(
                102 + u64::try_from(index).expect("invariant: tiny index"),
                address,
            ),
        )
        .await
        .expect("invariant: team");
    }
    for (index, space) in [GymSpace::Full, GymSpace::HalfA, GymSpace::HalfB]
        .iter()
        .enumerate()
    {
        s.mutate(
            owner(),
            A::CreateSlots {
                season,
                dates: DateRange::new(date("2026-10-05"), date("2026-10-19"))
                    .expect("invariant: dates"),
                weekdays: Weekdays::try_from(vec![0]).expect("invariant: weekday"),
                hours: OpeningHours::new(time("16:00"), time("17:00")).expect("invariant: hours"),
                space: *space,
            },
            identity(
                106 + u64::try_from(index).expect("invariant: tiny index"),
                &format!("space {index}"),
            ),
        )
        .await
        .expect("invariant: slots");
    }
    s.mutate(
        owner(),
        A::SetSeasonStatus {
            id: season,
            status: SeasonStatus::Active,
            version: version(1),
        },
        identity(110, "active"),
    )
    .await
    .expect("invariant: activate");
    s
}
fn slot(s: &ScheduleSnapshot, space: GymSpace, day: &str) -> SlotId {
    s.slots
        .iter()
        .find(|slot| slot.space == space && slot.date == date(day))
        .expect("invariant: slot exists")
        .id
}
fn team(s: &ScheduleSnapshot, index: usize) -> &Team {
    s.teams.get(index).expect("invariant: team exists")
}
async fn submit(
    s: &ScheduleService,
    actor: UserId,
    team: TeamId,
    slots: Vec<SlotId>,
    reason: &str,
    key: u64,
) -> Result<gymtime_app::schedule::ActionOutcome, ScheduleError> {
    s.mutate(
        actor,
        A::SubmitRequests {
            team,
            slots: select(slots),
            activity: Activity::Practice,
            note: note("internal coaching plan"),
            reason: note(reason),
        },
        identity(key, &format!("request {key}")),
    )
    .await
}
async fn approve(
    s: &ScheduleService,
    ids: Vec<RequestId>,
    key: u64,
) -> gymtime_app::schedule::ActionOutcome {
    s.mutate(
        owner(),
        A::DecideRequests {
            decisions: ids
                .into_iter()
                .map(|id| gymtime_app::schedule::commands::RequestDecision {
                    id,
                    approve: true,
                    version: version(1),
                })
                .collect(),
        },
        identity(key, &format!("approve {key}")),
    )
    .await
    .expect("invariant: approval")
}
#[tokio::test]
async fn competing_full_and_half_requests_are_visible_and_approval_keeps_opposite_half() {
    let f = Fixture::new().await;
    let s = scenario(&f).await;
    let initial = s.snapshot(owner()).await.expect("invariant: snapshot");
    let a = team(&initial, 0);
    let b = team(&initial, 1);
    let c = team(&initial, 2);
    let full = slot(&initial, GymSpace::Full, "2026-10-05");
    let half_a = slot(&initial, GymSpace::HalfA, "2026-10-05");
    let half_b = slot(&initial, GymSpace::HalfB, "2026-10-05");
    submit(&s, a.primary, a.id, vec![full], "", 120)
        .await
        .expect("invariant: first request");
    assert!(matches!(
        submit(&s, b.primary, b.id, vec![half_a], "", 121).await,
        Err(ScheduleError::CompetingReason)
    ));
    submit(&s, b.primary, b.id, vec![half_a], "Game preparation", 122)
        .await
        .expect("invariant: competing request");
    submit(&s, c.primary, c.id, vec![half_b], "Separate half", 123)
        .await
        .expect("invariant: other half");
    let pending = s
        .snapshot(owner())
        .await
        .expect("invariant: visible pending");
    assert_eq!(pending.requests.len(), 3);
    assert!(pending.bookings.is_empty());
    let selected = pending
        .requests
        .iter()
        .find(|r| r.team == b.id)
        .expect("invariant: request")
        .id;
    approve(&s, vec![selected], 124).await;
    let after = s.snapshot(owner()).await.expect("invariant: snapshot");
    assert_eq!(
        after
            .requests
            .iter()
            .find(|r| r.team == a.id)
            .expect("invariant: full request")
            .status,
        RequestStatus::ConflictCancelled
    );
    assert_eq!(
        after
            .requests
            .iter()
            .find(|r| r.team == c.id)
            .expect("invariant: opposite half request")
            .status,
        RequestStatus::Pending
    );
    assert_eq!(after.bookings.len(), 1);
    assert!(after.requestable(
        after.slot(half_b).expect("invariant: slot"),
        f.service.clock.now().expect("invariant: clock")
    ));
    f.db.close().await;
}
#[tokio::test]
async fn concurrent_conflicting_approvals_commit_at_most_one_and_notification_failure_rolls_back() {
    let f = Fixture::new().await;
    let s = scenario(&f).await;
    let initial = s.snapshot(owner()).await.expect("invariant: snapshot");
    let a = team(&initial, 0);
    let b = team(&initial, 1);
    let full = slot(&initial, GymSpace::Full, "2026-10-05");
    submit(&s, a.primary, a.id, vec![full], "", 130)
        .await
        .expect("invariant: first request");
    submit(&s, b.primary, b.id, vec![full], "Competing", 131)
        .await
        .expect("invariant: second request");
    let pending = s.snapshot(owner()).await.expect("invariant: snapshot");
    let left = pending.requests.first().expect("invariant: first").id;
    let right = pending.requests.last().expect("invariant: last").id;
    let command = |id| A::DecideRequests {
        decisions: vec![gymtime_app::schedule::commands::RequestDecision {
            id,
            approve: true,
            version: version(1),
        }],
    };
    sqlx::query("CREATE TRIGGER reject_notice BEFORE INSERT ON notifications BEGIN SELECT RAISE(FAIL,'fixture'); END").execute(&f.db.pool).await.expect("invariant: trigger");
    assert!(
        s.mutate(owner(), command(left), identity(132, "left"))
            .await
            .is_err()
    );
    let rollback = s.snapshot(owner()).await.expect("invariant: rollback");
    assert!(rollback.bookings.is_empty());
    assert!(
        rollback
            .requests
            .iter()
            .all(|r| r.status == RequestStatus::Pending)
    );
    sqlx::query("DROP TRIGGER reject_notice")
        .execute(&f.db.pool)
        .await
        .expect("invariant: remove trigger");
    let (l, r) = tokio::join!(
        s.mutate(owner(), command(left), identity(132, "left")),
        s.mutate(owner(), command(right), identity(133, "right"))
    );
    assert_ne!(l.is_ok(), r.is_ok());
    assert_eq!(
        s.snapshot(owner())
            .await
            .expect("invariant: snapshot")
            .bookings
            .len(),
        1
    );
    f.db.close().await;
}
#[tokio::test]
async fn recurring_partial_decisions_changes_and_cancellations_preserve_completed_history() {
    let f = Fixture::new().await;
    let s = scenario(&f).await;
    let initial = s.snapshot(owner()).await.expect("invariant: snapshot");
    let t = team(&initial, 0);
    let dates = ["2026-10-05", "2026-10-12", "2026-10-19"];
    submit(
        &s,
        t.primary,
        t.id,
        dates
            .iter()
            .map(|day| slot(&initial, GymSpace::Full, day))
            .collect(),
        "",
        140,
    )
    .await
    .expect("invariant: series");
    let pending = s.snapshot(owner()).await.expect("invariant: snapshot");
    s.mutate(
        owner(),
        A::DecideRequests {
            decisions: pending
                .requests
                .iter()
                .enumerate()
                .map(
                    |(index, r)| gymtime_app::schedule::commands::RequestDecision {
                        id: r.id,
                        approve: index != 1,
                        version: r.version,
                    },
                )
                .collect(),
        },
        identity(141, "partial"),
    )
    .await
    .expect("invariant: partial decisions");
    let confirmed = s.snapshot(owner()).await.expect("invariant: snapshot");
    assert_eq!(confirmed.bookings.len(), 2);
    let last = confirmed.bookings.last().expect("invariant: last").clone();
    let half = slot(&initial, GymSpace::HalfA, "2026-10-19");
    s.mutate(
        t.primary,
        A::ChangeBooking {
            id: last.id,
            scope: SeriesScope::One,
            slots: select(vec![half]),
            activity: Activity::Game,
            note: note("private game"),
            reason: note(""),
            version: last.version,
        },
        identity(142, "change"),
    )
    .await
    .expect("invariant: change request");
    let changed = s
        .snapshot(owner())
        .await
        .expect("invariant: pending change");
    assert_eq!(
        changed.booking(last.id).expect("invariant: original").slot,
        last.slot
    );
    let request = changed.requests.last().expect("invariant: replacement").id;
    approve(&s, vec![request], 143).await;
    let after = s
        .snapshot(owner())
        .await
        .expect("invariant: approved change");
    let changed = after.booking(last.id).expect("invariant: same booking");
    assert_eq!(changed.slot, half);
    assert_eq!(changed.calendar_uid.as_str(), last.calendar_uid.as_str());
    let oct6 = initial
        .gym
        .timezone
        .resolve(date("2026-10-06"), time("08:00"))
        .expect("invariant: fixed local time");
    f.advance(
        oct6.epoch_millis()
            - f.service
                .clock
                .now()
                .expect("invariant: clock")
                .epoch_millis(),
    );
    s.mutate(
        t.primary,
        A::CancelBooking {
            id: last.id,
            scope: SeriesScope::Remaining,
            version: changed.version,
        },
        identity(144, "cancel remaining"),
    )
    .await
    .expect("invariant: cancel future");
    let final_s = s.snapshot(owner()).await.expect("invariant: history");
    assert_eq!(
        final_s.bookings.first().expect("invariant: past").status,
        BookingStatus::Confirmed
    );
    assert_eq!(
        final_s
            .booking(last.id)
            .expect("invariant: cancelled")
            .status,
        BookingStatus::CoachCancelled
    );
    assert!(final_s.requestable(
        final_s.slot(half).expect("invariant: half"),
        f.service.clock.now().expect("invariant: clock")
    ));
    f.db.close().await;
}
#[tokio::test]
async fn reciprocal_swap_is_atomic_and_closure_invalidates_pending_swaps_and_both_halves() {
    let f = Fixture::new().await;
    let s = scenario(&f).await;
    let initial = s.snapshot(owner()).await.expect("invariant: snapshot");
    let a = team(&initial, 0);
    let b = team(&initial, 1);
    for (key, t, space, day) in [
        (150, a, GymSpace::HalfA, "2026-10-05"),
        (151, b, GymSpace::HalfB, "2026-10-12"),
    ] {
        s.mutate(
            owner(),
            A::BookDirectly {
                team: t.id,
                slots: select(vec![slot(&initial, space, day)]),
                activity: Activity::Practice,
                note: note(""),
            },
            identity(key, day),
        )
        .await
        .expect("invariant: direct booking");
    }
    let before = s.snapshot(owner()).await.expect("invariant: snapshot");
    let left = before.bookings.first().expect("invariant: left");
    let right = before.bookings.last().expect("invariant: right");
    s.mutate(
        a.primary,
        A::ProposeSwap {
            first: left.id,
            second: right.id,
            first_version: left.version,
            second_version: right.version,
        },
        identity(152, "swap"),
    )
    .await
    .expect("invariant: proposal");
    let pending = s
        .snapshot(owner())
        .await
        .expect("invariant: proposal snapshot");
    let swap = pending.swaps.first().expect("invariant: swap");
    assert!(matches!(
        s.mutate(
            a.primary,
            A::RespondSwap {
                id: swap.id,
                accept: true,
                version: swap.version
            },
            identity(153, "wrong coach")
        )
        .await,
        Err(ScheduleError::Auth(AuthError::Forbidden))
    ));
    sqlx::query("CREATE TRIGGER reject_second_update BEFORE UPDATE ON bookings WHEN OLD.id=(SELECT MAX(id) FROM bookings) BEGIN SELECT RAISE(FAIL,'fixture'); END").execute(&f.db.pool).await.expect("invariant: trigger");
    assert!(
        s.mutate(
            b.primary,
            A::RespondSwap {
                id: swap.id,
                accept: true,
                version: swap.version
            },
            identity(154, "accept")
        )
        .await
        .is_err()
    );
    let rolled = s
        .snapshot(owner())
        .await
        .expect("invariant: atomic rollback");
    assert_eq!(
        rolled.booking(left.id).expect("invariant: left").slot,
        left.slot
    );
    assert_eq!(
        rolled.swaps.first().expect("invariant: pending").status,
        SwapStatus::Pending
    );
    sqlx::query("DROP TRIGGER reject_second_update")
        .execute(&f.db.pool)
        .await
        .expect("invariant: drop trigger");
    s.mutate(
        b.primary,
        A::RespondSwap {
            id: swap.id,
            accept: true,
            version: swap.version,
        },
        identity(154, "accept"),
    )
    .await
    .expect("invariant: accept");
    let swapped = s.snapshot(owner()).await.expect("invariant: swapped");
    assert_eq!(
        swapped.booking(left.id).expect("invariant: left").slot,
        right.slot
    );
    assert_eq!(
        swapped.booking(right.id).expect("invariant: right").slot,
        left.slot
    );
    let l = swapped.booking(left.id).expect("invariant: left");
    let r = swapped.booking(right.id).expect("invariant: right");
    s.mutate(
        a.primary,
        A::ProposeSwap {
            first: l.id,
            second: r.id,
            first_version: l.version,
            second_version: r.version,
        },
        identity(155, "new proposal"),
    )
    .await
    .expect("invariant: new proposal");
    let interval = initial
        .slot(left.slot)
        .expect("invariant: closure slot")
        .interval;
    s.mutate(
        owner(),
        A::CloseGym {
            interval,
            space: GymSpace::Full,
            reason: note("School assembly"),
        },
        identity(156, "closure"),
    )
    .await
    .expect("invariant: closure");
    let closed = s.snapshot(owner()).await.expect("invariant: closed");
    assert_eq!(
        closed.booking(right.id).expect("invariant: booking").status,
        BookingStatus::ClosureCancelled
    );
    assert_eq!(
        closed.swaps.last().expect("invariant: invalidated").status,
        SwapStatus::Invalidated
    );
    assert!(closed.slots.iter().filter(|slot|slot.date==date("2026-10-05")).all(|slot|!closed.requestable(slot,f.service.clock.now().expect("invariant: clock"))));
    f.db.close().await;
}
#[tokio::test]
async fn assistants_cannot_mutate_same_coach_overlap_warns_and_unanswered_swaps_expire() {
    let f = Fixture::new().await;
    let s = scenario(&f).await;
    let initial = s.snapshot(owner()).await.expect("invariant: snapshot");
    let a = team(&initial, 0);
    let b = team(&initial, 1);
    let c = team(&initial, 2);
    s.mutate(
        owner(),
        A::AssignAssistant {
            team: a.id,
            email: email("assistant@example.test"),
            remove: false,
            version: a.version,
        },
        identity(160, "assistant"),
    )
    .await
    .expect("invariant: assistant");
    let assigned = s.snapshot(owner()).await.expect("invariant: assigned");
    let assistant = assigned
        .team(a.id)
        .expect("invariant: team")
        .assistants
        .first()
        .copied()
        .expect("invariant: assistant");
    assert!(s.snapshot(assistant).await.is_ok());
    assert!(matches!(
        submit(
            &s,
            assistant,
            a.id,
            vec![slot(&initial, GymSpace::HalfA, "2026-10-05")],
            "",
            161
        )
        .await,
        Err(ScheduleError::Auth(AuthError::Forbidden))
    ));
    for (key, t, space, day) in [
        (162, a, GymSpace::HalfA, "2026-10-05"),
        (163, c, GymSpace::HalfB, "2026-10-05"),
        (164, b, GymSpace::Full, "2026-10-12"),
    ] {
        let result = s
            .mutate(
                owner(),
                A::BookDirectly {
                    team: t.id,
                    slots: select(vec![slot(&initial, space, day)]),
                    activity: Activity::Practice,
                    note: note(""),
                },
                identity(key, day),
            )
            .await
            .expect("invariant: direct booking");
        if key == 163 {
            assert!(
                result
                    .warnings
                    .iter()
                    .any(|w| matches!(w, gymtime_app::schedule::ScheduleWarning::CoachOverlap))
            );
        }
    }
    let before = s.snapshot(owner()).await.expect("invariant: snapshot");
    let left = before.bookings.first().expect("invariant: first");
    let right = before.bookings.last().expect("invariant: last");
    s.mutate(
        a.primary,
        A::ProposeSwap {
            first: left.id,
            second: right.id,
            first_version: left.version,
            second_version: right.version,
        },
        identity(165, "swap"),
    )
    .await
    .expect("invariant: proposal");
    let deadline = initial
        .slot(left.slot)
        .expect("invariant: first slot")
        .interval
        .start();
    f.advance(
        deadline.epoch_millis()
            - f.service
                .clock
                .now()
                .expect("invariant: clock")
                .epoch_millis(),
    );
    s.expire_swaps().await.expect("invariant: maintenance");
    let after = s.snapshot(owner()).await.expect("invariant: expired");
    assert_eq!(
        after.swaps.first().expect("invariant: swap").status,
        SwapStatus::Expired
    );
    assert_eq!(
        after
            .bookings
            .iter()
            .filter(|b| b.status == BookingStatus::Confirmed)
            .count(),
        3
    );
    f.db.close().await;
}

#[tokio::test]
async fn sharing_rotation_preserves_event_identity_and_published_history_without_private_fields() {
    let f = Fixture::new().await;
    let s = scenario(&f).await;
    let initial = s.snapshot(owner()).await.expect("invariant: snapshot");
    let a = team(&initial, 0);
    let b = team(&initial, 1);
    for (key, t, space, day) in [
        (180, a, GymSpace::HalfA, "2026-10-05"),
        (181, b, GymSpace::HalfB, "2026-10-12"),
    ] {
        s.mutate(
            owner(),
            A::BookDirectly {
                team: t.id,
                slots: select(vec![slot(&initial, space, day)]),
                activity: Activity::Practice,
                note: note("Private strategy"),
            },
            identity(key, day),
        )
        .await
        .expect("invariant: booking");
    }
    let before = s
        .public_calendar(&a.share_token)
        .await
        .expect("invariant: parent projection");
    assert_eq!(before.events.len(), 1);
    let event = before.events.first().expect("invariant: event");
    let uid = event.uid.as_str().to_owned();
    let text = before.icalendar().expect("invariant: feed");
    assert!(!text.contains("Private strategy"));
    assert!(!text.contains(b.name.as_str()));
    assert!(text.contains("SEQUENCE:0"));
    let snapshot = s
        .snapshot(owner())
        .await
        .expect("invariant: booking snapshot");
    let booking = snapshot.bookings.first().expect("invariant: first booking");
    s.mutate(
        owner(),
        A::MoveBooking {
            id: booking.id,
            slot: slot(&initial, GymSpace::HalfA, "2026-10-19"),
            activity: Activity::Game,
            note: note("Another private note"),
            version: booking.version,
        },
        identity(182, "move"),
    )
    .await
    .expect("invariant: move");
    let moved = s
        .public_calendar(&a.share_token)
        .await
        .expect("invariant: changed feed");
    assert_eq!(
        moved
            .events
            .first()
            .expect("invariant: same event")
            .uid
            .as_str(),
        uid
    );
    assert!(
        moved
            .icalendar()
            .expect("invariant: feed")
            .contains("SEQUENCE:1")
    );
    s.mutate(
        a.primary,
        A::RotateTeamLink {
            team: a.id,
            version: a.version,
        },
        identity(183, "rotate"),
    )
    .await
    .expect("invariant: rotate");
    assert!(matches!(
        s.public_calendar(&a.share_token).await,
        Err(ScheduleError::NotFound)
    ));
    let rotated = s
        .snapshot(owner())
        .await
        .expect("invariant: rotated snapshot");
    let token = &rotated.team(a.id).expect("invariant: team").share_token;
    let new = s.public_calendar(token).await.expect("invariant: new feed");
    assert_eq!(
        new.events
            .first()
            .expect("invariant: identity unchanged")
            .uid
            .as_str(),
        uid
    );
    f.db.close().await;
}
#[tokio::test]
async fn notifications_group_recurring_actions_and_deduplicate_active_coaches_with_multiple_teams()
{
    let f = Fixture::new().await;
    let s = scenario(&f).await;
    let initial = s.snapshot(owner()).await.expect("invariant: snapshot");
    let a = team(&initial, 0);
    let b = team(&initial, 1);
    s.mutate(
        owner(),
        A::AssignAssistant {
            team: a.id,
            email: email("assistant@example.test"),
            remove: false,
            version: a.version,
        },
        identity(190, "assistant"),
    )
    .await
    .expect("invariant: assistant");
    let backup = f
        .service
        .invite_account(
            owner(),
            email("backup@example.test"),
            gymtime_domain::auth::AccountRole::Organizer,
        )
        .await
        .expect("invariant: backup organizer");
    f.service
        .invite_account(
            owner(),
            email("unassigned@example.test"),
            gymtime_domain::auth::AccountRole::Coach,
        )
        .await
        .expect("invariant: unassigned coach");
    let count = |db: crate::sqlite::SqliteDatabase| async move {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM notifications")
            .fetch_one(&db.pool)
            .await
            .expect("invariant: notification count")
    };
    let before = count(f.db.clone()).await;
    submit(
        &s,
        a.primary,
        a.id,
        vec![
            slot(&initial, GymSpace::HalfA, "2026-10-05"),
            slot(&initial, GymSpace::HalfA, "2026-10-12"),
        ],
        "",
        191,
    )
    .await
    .expect("invariant: recurring request");
    assert_eq!(count(f.db.clone()).await - before, 2); // Owner and backup: one summary each.
    let pending = s.snapshot(owner()).await.expect("invariant: snapshot");
    let ids = pending.requests.iter().map(|r| r.id).collect::<Vec<_>>();
    let before = count(f.db.clone()).await;
    let result = s
        .mutate(
            backup.id,
            A::DecideRequests {
                decisions: ids
                    .into_iter()
                    .map(|id| gymtime_app::schedule::commands::RequestDecision {
                        id,
                        approve: true,
                        version: version(1),
                    })
                    .collect(),
            },
            identity(192, "backup approval"),
        )
        .await
        .expect("invariant: equal organizer permissions");
    assert_eq!(
        result
            .resources
            .iter()
            .filter(|r| matches!(r, ResourceRef::Booking(_)))
            .count(),
        2
    );
    assert_eq!(count(f.db.clone()).await - before, 2); // Primary and assistant receive one summary each.
    let confirmed = s.snapshot(owner()).await.expect("invariant: confirmed");
    let assistant = confirmed
        .team(a.id)
        .expect("invariant: team")
        .assistants
        .first()
        .copied()
        .expect("invariant: assistant");
    let booking = confirmed.bookings.first().expect("invariant: booking");
    let before = count(f.db.clone()).await;
    s.mutate(
        a.primary,
        A::CancelBooking {
            id: booking.id,
            scope: SeriesScope::Remaining,
            version: booking.version,
        },
        identity(193, "cancel series"),
    )
    .await
    .expect("invariant: release");
    // Two organizers plus three unique active-season coaches. Cancellation and availability share a message.
    assert_eq!(count(f.db.clone()).await - before, 5);
    let inbox = s
        .notifications(assistant, false)
        .await
        .expect("invariant: assistant inbox");
    let latest = inbox.first().expect("invariant: latest grouped message");
    assert!(latest.message.text().contains("Booking cancelled"));
    assert!(latest.message.text().contains("New slot available"));
    assert!(matches!(
        s.notifications(b.primary, true).await,
        Err(ScheduleError::Auth(AuthError::Forbidden))
    ));
    assert!(matches!(
        s.mutate(
            b.primary,
            A::MarkNoticeRead {
                id: latest.id.clone()
            },
            identity(194, "other inbox")
        )
        .await,
        Err(ScheduleError::NotFound)
    ));
    s.mutate(
        assistant,
        A::MarkNoticeRead {
            id: latest.id.clone(),
        },
        identity(195, "read own inbox"),
    )
    .await
    .expect("invariant: read own inbox");
    assert!(
        s.notifications(assistant, false)
            .await
            .expect("invariant: read inbox")
            .iter()
            .find(|n| n.id.as_str() == latest.id.as_str())
            .expect("invariant: notice")
            .read
    );
    f.db.close().await;
}
#[tokio::test]
async fn pending_edits_withdrawals_declined_changes_and_closed_seasons_keep_original_bookings() {
    let f = Fixture::new().await;
    let s = scenario(&f).await;
    let initial = s.snapshot(owner()).await.expect("invariant: snapshot");
    let a = team(&initial, 0);
    submit(
        &s,
        a.primary,
        a.id,
        vec![slot(&initial, GymSpace::HalfA, "2026-10-05")],
        "",
        200,
    )
    .await
    .expect("invariant: request");
    let pending = s.snapshot(owner()).await.expect("invariant: pending");
    let request = pending.requests.first().expect("invariant: request");
    assert!(matches!(
        s.mutate(
            owner(),
            A::ConfigureGym {
                name: pending.gym.name.clone(),
                timezone: pending.gym.timezone,
                split: SplitMode::WholeOnly,
                hours: pending.gym.hours.clone(),
                version: pending.gym.version,
            },
            identity(210, "disable halves with pending request")
        )
        .await,
        Err(ScheduleError::OccupiedSlot)
    ));
    let replacement = slot(&initial, GymSpace::HalfA, "2026-10-12");
    s.mutate(
        a.primary,
        A::EditRequest {
            id: request.id,
            slot: replacement,
            activity: Activity::Game,
            note: note("private"),
            reason: note(""),
            version: request.version,
        },
        identity(201, "edit"),
    )
    .await
    .expect("invariant: edit");
    let edited = s.snapshot(owner()).await.expect("invariant: edited");
    let r = edited.requests.first().expect("invariant: edited request");
    assert_eq!(r.slot, replacement);
    assert_eq!(r.activity, Activity::Game);
    s.mutate(
        a.primary,
        A::WithdrawRequests {
            ids: select(vec![r.id]),
        },
        identity(202, "withdraw"),
    )
    .await
    .expect("invariant: withdrawal");
    assert!(
        s.mutate(
            owner(),
            A::DecideRequests {
                decisions: vec![gymtime_app::schedule::commands::RequestDecision {
                    id: r.id,
                    approve: true,
                    version: version(3)
                }]
            },
            identity(203, "approve withdrawn")
        )
        .await
        .is_err()
    );
    s.mutate(
        owner(),
        A::BookDirectly {
            team: a.id,
            slots: select(vec![replacement]),
            activity: Activity::Practice,
            note: note(""),
        },
        identity(204, "confirmed"),
    )
    .await
    .expect("invariant: booking");
    let confirmed = s.snapshot(owner()).await.expect("invariant: confirmed");
    let b = confirmed.bookings.first().expect("invariant: booking");
    s.mutate(
        a.primary,
        A::ChangeBooking {
            id: b.id,
            scope: SeriesScope::One,
            slots: select(vec![slot(&initial, GymSpace::HalfA, "2026-10-19")]),
            activity: Activity::Game,
            note: note(""),
            reason: note(""),
            version: b.version,
        },
        identity(205, "change"),
    )
    .await
    .expect("invariant: change");
    let changes = s
        .snapshot(owner())
        .await
        .expect("invariant: change snapshot");
    let r = changes.requests.last().expect("invariant: change request");
    s.mutate(
        owner(),
        A::DecideRequests {
            decisions: vec![gymtime_app::schedule::commands::RequestDecision {
                id: r.id,
                approve: false,
                version: r.version,
            }],
        },
        identity(206, "decline change"),
    )
    .await
    .expect("invariant: decline");
    assert_eq!(
        s.snapshot(owner())
            .await
            .expect("invariant: unchanged booking")
            .booking(b.id)
            .expect("invariant: original")
            .slot,
        replacement
    );
    let season = initial.seasons.first().expect("invariant: active season");
    s.mutate(
        owner(),
        A::SetSeasonStatus {
            id: season.id,
            status: SeasonStatus::Closed,
            version: season.version,
        },
        identity(207, "close season"),
    )
    .await
    .expect("invariant: close");
    assert!(matches!(
        submit(
            &s,
            a.primary,
            a.id,
            vec![slot(&initial, GymSpace::HalfA, "2026-10-19")],
            "",
            208
        )
        .await,
        Err(ScheduleError::Inactive)
    ));
    assert!(matches!(
        s.mutate(
            a.primary,
            A::CancelBooking {
                id: b.id,
                scope: SeriesScope::One,
                version: b.version
            },
            identity(209, "closed history")
        )
        .await,
        Err(ScheduleError::Inactive)
    ));
    assert!(s.snapshot(a.primary).await.is_ok());
    f.db.close().await;
}

#[tokio::test]
async fn availability_respects_unsplit_gyms_and_the_exact_completed_date_boundary() {
    let f = Fixture::new().await;
    let s = scenario(&f).await;
    let mut snapshot = s
        .snapshot(owner())
        .await
        .expect("invariant: setup snapshot");
    let full = snapshot
        .slot(slot(&snapshot, GymSpace::Full, "2026-10-05"))
        .expect("invariant: full slot")
        .clone();
    let half = snapshot
        .slot(slot(&snapshot, GymSpace::HalfA, "2026-10-05"))
        .expect("invariant: half slot")
        .clone();
    snapshot.gym.split = SplitMode::WholeOnly;
    let before = full.interval.end().after_millis(-1);
    assert!(snapshot.requestable(&full, before));
    assert!(!snapshot.requestable(&half, before));
    assert!(!snapshot.requestable(&full, full.interval.end()));
    f.db.close().await;
}

#[tokio::test]
async fn declining_and_withdrawing_swaps_leave_both_bookings_confirmed_and_unchanged() {
    let f = Fixture::new().await;
    let s = scenario(&f).await;
    let initial = s.snapshot(owner()).await.expect("invariant: setup");
    let a = team(&initial, 0);
    let b = team(&initial, 1);
    for (key, team, space) in [(230, a, GymSpace::HalfA), (231, b, GymSpace::HalfB)] {
        s.mutate(
            owner(),
            A::BookDirectly {
                team: team.id,
                slots: select(vec![slot(&initial, space, "2026-10-05")]),
                activity: Activity::Practice,
                note: note(""),
            },
            identity(key, "booking"),
        )
        .await
        .expect("invariant: compatible booking");
    }
    let booked = s.snapshot(owner()).await.expect("invariant: bookings");
    let first = booked.bookings.first().expect("invariant: first booking");
    let second = booked.bookings.last().expect("invariant: second booking");
    for (key, accept) in [(232, false), (234, true)] {
        s.mutate(
            a.primary,
            A::ProposeSwap {
                first: first.id,
                second: second.id,
                first_version: first.version,
                second_version: second.version,
            },
            identity(key, "propose"),
        )
        .await
        .expect("invariant: proposal");
        let pending = s.snapshot(owner()).await.expect("invariant: pending");
        let swap = pending.swaps.last().expect("invariant: proposal");
        let action = if accept {
            A::WithdrawSwap {
                id: swap.id,
                version: swap.version,
            }
        } else {
            A::RespondSwap {
                id: swap.id,
                version: swap.version,
                accept: false,
            }
        };
        let actor = if accept { a.primary } else { b.primary };
        s.mutate(actor, action, identity(key + 1, "resolve"))
            .await
            .expect("invariant: decline or withdraw");
        let after = s
            .snapshot(owner())
            .await
            .expect("invariant: unchanged bookings");
        for original in [first, second] {
            let current = after
                .booking(original.id)
                .expect("invariant: retained booking");
            assert_eq!(current.slot, original.slot);
            assert_eq!(current.version, original.version);
            assert_eq!(current.status, BookingStatus::Confirmed);
        }
        assert_eq!(
            after.swaps.last().expect("invariant: resolved swap").status,
            if accept {
                SwapStatus::Withdrawn
            } else {
                SwapStatus::Declined
            }
        );
    }
    assert!(
        s.notifications(a.primary, false)
            .await
            .expect("invariant: proposer inbox")
            .iter()
            .any(|n| n.message.subject() == "Swap declined")
    );
    assert!(
        !s.notifications(b.primary, false)
            .await
            .expect("invariant: receiving inbox")
            .iter()
            .any(|n| n.message.subject() == "Swap declined")
    );
    f.db.close().await;
}
