mod receipts;
mod snapshot;
use crate::{auth_sqlite::AuthWrite, sqlite::SqliteDatabase};
use async_trait::async_trait;
use gymtime_app::{
    StorageError,
    schedule::{
        ActionOutcome,
        commands::{BookingEdit, NewBooking, NewRequest, NewSwap},
        ports::{Recipients, SavedMutation, ScheduleStore, ScheduleTransaction},
    },
};
use gymtime_domain::{
    EmailAddress, GymSpace, Instant, Interval,
    auth::{Actor, Digest, OpaqueToken, UserId},
    schedule::*,
};
use snapshot::{
    activity_label, booking_label, request_label, season_label, space_label, swap_label,
    unavailable, value,
};

fn changed(result: sqlx::sqlite::SqliteQueryResult) -> Result<(), StorageError> {
    match result.rows_affected() {
        1 => Ok(()),
        0 => Err(StorageError::ConcurrentChange),
        _ => Err(StorageError::InvalidData),
    }
}
async fn bump_team(
    tx: &mut sqlx::SqliteConnection,
    id: TeamId,
    version: Version,
) -> Result<(), StorageError> {
    changed(
        sqlx::query("UPDATE teams SET version=version+1 WHERE id=? AND version=?")
            .bind(id.get())
            .bind(version.get())
            .execute(tx)
            .await
            .map_err(unavailable)?,
    )
}
#[async_trait]
impl ScheduleStore for SqliteDatabase {
    async fn begin_schedule(&self) -> Result<Box<dyn ScheduleTransaction>, StorageError> {
        Ok(Box::new(AuthWrite {
            tx: self
                .pool
                .begin_with("BEGIN IMMEDIATE")
                .await
                .map_err(unavailable)?,
        }))
    }
}
#[async_trait]
impl ScheduleTransaction for AuthWrite {
    async fn notifications(
        &mut self,
        user: UserId,
        failed_only: bool,
    ) -> Result<Vec<gymtime_app::notifications::Notification>, StorageError> {
        use gymtime_app::notifications::{DeliveryStatus, Notification};
        let rows:Vec<(String,i64,String,String,String,i64,Option<i64>,String)>=sqlx::query_as("SELECT n.id,n.user_id,u.email,n.subject,n.text,n.created_at,n.read_at,o.status FROM notifications n JOIN users u ON u.id=n.user_id JOIN email_outbox o ON o.notification_id=n.id WHERE (?=0 AND n.user_id=?) OR (?=1 AND o.status='failed') ORDER BY n.created_at DESC,n.id DESC LIMIT 200").bind(failed_only).bind(user.get()).bind(failed_only).fetch_all(&mut *self.tx).await.map_err(unavailable)?;
        rows.into_iter()
            .map(|(id, user, email, subject, text, created, read, status)| {
                Ok(Notification {
                    id: value(OpaqueToken::try_from(id.as_str()))?,
                    user: value(UserId::try_from(user))?,
                    message: value(gymtime_app::EmailMessage::new(
                        value(EmailAddress::try_from(email.as_str()))?,
                        subject,
                        text,
                    ))?,
                    created: Instant::from_epoch_millis(created),
                    read: read.is_some(),
                    delivery: match status.as_str() {
                        "pending" => DeliveryStatus::Pending,
                        "sending" => DeliveryStatus::Sending,
                        "sent" => DeliveryStatus::Sent,
                        "failed" => DeliveryStatus::Failed,
                        _ => return Err(StorageError::InvalidData),
                    },
                })
            })
            .collect()
    }
    async fn mark_notice_read(
        &mut self,
        user: UserId,
        id: &OpaqueToken,
        now: Instant,
    ) -> Result<bool, StorageError> {
        Ok(sqlx::query(
            "UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?",
        )
        .bind(now.epoch_millis())
        .bind(id.as_str())
        .bind(user.get())
        .execute(&mut *self.tx)
        .await
        .map_err(unavailable)?
        .rows_affected()
            == 1)
    }
    async fn retry_email(&mut self, id: &OpaqueToken, now: Instant) -> Result<bool, StorageError> {
        Ok(sqlx::query("UPDATE email_outbox SET status='pending',attempts=0,retry_at=? WHERE notification_id=? AND status='failed'").bind(now.epoch_millis()).bind(id.as_str()).execute(&mut *self.tx).await.map_err(unavailable)?.rows_affected()==1)
    }
    async fn audit_entries(
        &mut self,
    ) -> Result<Vec<gymtime_app::schedule::ports::AuditEntry>, StorageError> {
        let rows:Vec<(i64,String,i64)>=sqlx::query_as("SELECT actor_id,action,occurred_at FROM audit_events WHERE actor_id IS NOT NULL ORDER BY occurred_at DESC,id DESC LIMIT 200").fetch_all(&mut *self.tx).await.map_err(unavailable)?;
        rows.into_iter()
            .map(|(actor, action, created)| {
                Ok(gymtime_app::schedule::ports::AuditEntry {
                    actor: value(UserId::try_from(actor))?,
                    action,
                    created: Instant::from_epoch_millis(created),
                })
            })
            .collect()
    }
    async fn audit_schedule(
        &mut self,
        actor: UserId,
        operation: &str,
        key: &OpaqueToken,
        now: Instant,
    ) -> Result<(), StorageError> {
        sqlx::query(
            "INSERT INTO audit_events(actor_id,action,resource_id,occurred_at) VALUES (?,?,?,?)",
        )
        .bind(actor.get())
        .bind(operation)
        .bind(key.as_str())
        .bind(now.epoch_millis())
        .execute(&mut *self.tx)
        .await
        .map_err(unavailable)?;
        Ok(())
    }
    async fn snapshot(&mut self) -> Result<ScheduleSnapshot, StorageError> {
        snapshot::load(&mut self.tx).await
    }
    async fn receipt(
        &mut self,
        actor: UserId,
        key: &OpaqueToken,
    ) -> Result<Option<SavedMutation>, StorageError> {
        receipts::load(&mut self.tx, actor, key).await
    }
    async fn save_receipt(
        &mut self,
        actor: UserId,
        key: &OpaqueToken,
        operation: &str,
        digest: &Digest,
        outcome: &ActionOutcome,
        now: Instant,
    ) -> Result<(), StorageError> {
        receipts::save(&mut self.tx, actor, key, operation, digest, outcome, now).await
    }
    async fn save_gym(
        &mut self,
        name: &Name,
        timezone: GymTimezone,
        split: SplitMode,
        hours: &WeeklyHours,
        version: Version,
    ) -> Result<Version, StorageError> {
        let next:i64=sqlx::query_scalar::<_, i64>("UPDATE gym_settings SET name=?,timezone=?,split_enabled=?,version=version+1 WHERE id=1 AND version=? RETURNING version").bind(name.as_str()).bind(timezone.as_str()).bind(split==SplitMode::HalvesAvailable).bind(version.get()).fetch_optional(&mut *self.tx).await.map_err(unavailable)?.ok_or(StorageError::ConcurrentChange)?;
        sqlx::query("DELETE FROM gym_hours")
            .execute(&mut *self.tx)
            .await
            .map_err(unavailable)?;
        for (day, hours) in hours.entries() {
            sqlx::query("INSERT INTO gym_hours(weekday,opens,closes) VALUES (?,?,?)")
                .bind(i64::from(day.get()))
                .bind(hours.start().as_string())
                .bind(hours.end().as_string())
                .execute(&mut *self.tx)
                .await
                .map_err(unavailable)?;
        }
        value(Version::try_from(next))
    }
    async fn create_season(
        &mut self,
        name: &Name,
        dates: DateRange,
    ) -> Result<SeasonId, StorageError> {
        value(SeasonId::try_from(
            sqlx::query_scalar::<_, i64>(
                "INSERT INTO seasons(name,starts_on,ends_on) VALUES (?,?,?) RETURNING id",
            )
            .bind(name.as_str())
            .bind(dates.start().as_string())
            .bind(dates.end().as_string())
            .fetch_one(&mut *self.tx)
            .await
            .map_err(unavailable)?,
        ))
    }
    async fn edit_season(
        &mut self,
        id: SeasonId,
        name: &Name,
        dates: DateRange,
        version: Version,
    ) -> Result<(), StorageError> {
        changed(sqlx::query("UPDATE seasons SET name=?,starts_on=?,ends_on=?,version=version+1 WHERE id=? AND version=?").bind(name.as_str()).bind(dates.start().as_string()).bind(dates.end().as_string()).bind(id.get()).bind(version.get()).execute(&mut *self.tx).await.map_err(unavailable)?)
    }
    async fn set_season_status(
        &mut self,
        id: SeasonId,
        status: SeasonStatus,
        version: Version,
    ) -> Result<(), StorageError> {
        changed(
            sqlx::query("UPDATE seasons SET status=?,version=version+1 WHERE id=? AND version=?")
                .bind(season_label(status))
                .bind(id.get())
                .bind(version.get())
                .execute(&mut *self.tx)
                .await
                .map_err(unavailable)?,
        )
    }
    async fn create_team(
        &mut self,
        name: &Name,
        primary: UserId,
        season: SeasonId,
        token: &OpaqueToken,
    ) -> Result<TeamId, StorageError> {
        let id: i64 = sqlx::query_scalar::<_, i64>(
            "INSERT INTO teams(name,share_token) VALUES (?,?) RETURNING id",
        )
        .bind(name.as_str())
        .bind(token.as_str())
        .fetch_one(&mut *self.tx)
        .await
        .map_err(unavailable)?;
        sqlx::query("INSERT INTO team_grants(team_id,user_id,role) VALUES (?,?,'primary')")
            .bind(id)
            .bind(primary.get())
            .execute(&mut *self.tx)
            .await
            .map_err(unavailable)?;
        sqlx::query("INSERT INTO team_seasons(team_id,season_id) VALUES (?,?)")
            .bind(id)
            .bind(season.get())
            .execute(&mut *self.tx)
            .await
            .map_err(unavailable)?;
        value(TeamId::try_from(id))
    }
    async fn edit_team(
        &mut self,
        id: TeamId,
        name: &Name,
        primary: UserId,
        version: Version,
    ) -> Result<(), StorageError> {
        changed(
            sqlx::query("UPDATE teams SET name=?,version=version+1 WHERE id=? AND version=?")
                .bind(name.as_str())
                .bind(id.get())
                .bind(version.get())
                .execute(&mut *self.tx)
                .await
                .map_err(unavailable)?,
        )?;
        sqlx::query("DELETE FROM team_grants WHERE team_id=? AND (role='primary' OR user_id=?)")
            .bind(id.get())
            .bind(primary.get())
            .execute(&mut *self.tx)
            .await
            .map_err(unavailable)?;
        sqlx::query("INSERT INTO team_grants(team_id,user_id,role) VALUES (?,?,'primary')")
            .bind(id.get())
            .bind(primary.get())
            .execute(&mut *self.tx)
            .await
            .map_err(unavailable)?;
        Ok(())
    }
    async fn assign_assistant(
        &mut self,
        team: TeamId,
        user: UserId,
        remove: bool,
        version: Version,
    ) -> Result<(), StorageError> {
        bump_team(&mut self.tx, team, version).await?;
        if remove {
            sqlx::query(
                "DELETE FROM team_grants WHERE team_id=? AND user_id=? AND role='assistant'",
            )
            .bind(team.get())
            .bind(user.get())
            .execute(&mut *self.tx)
            .await
            .map_err(unavailable)?;
        } else {
            sqlx::query("INSERT INTO team_grants(team_id,user_id,role) VALUES (?,?,'assistant') ON CONFLICT(team_id,user_id) DO NOTHING").bind(team.get()).bind(user.get()).execute(&mut *self.tx).await.map_err(unavailable)?;
        }
        Ok(())
    }
    async fn assign_team_season(
        &mut self,
        team: TeamId,
        season: SeasonId,
        version: Version,
    ) -> Result<(), StorageError> {
        bump_team(&mut self.tx, team, version).await?;
        sqlx::query(
            "INSERT INTO team_seasons(team_id,season_id) VALUES (?,?) ON CONFLICT DO NOTHING",
        )
        .bind(team.get())
        .bind(season.get())
        .execute(&mut *self.tx)
        .await
        .map_err(unavailable)?;
        Ok(())
    }
    async fn rotate_team_link(
        &mut self,
        team: TeamId,
        token: &OpaqueToken,
        version: Version,
    ) -> Result<(), StorageError> {
        changed(
            sqlx::query(
                "UPDATE teams SET share_token=?,version=version+1 WHERE id=? AND version=?",
            )
            .bind(token.as_str())
            .bind(team.get())
            .bind(version.get())
            .execute(&mut *self.tx)
            .await
            .map_err(unavailable)?,
        )
    }
    async fn create_slots(
        &mut self,
        season: SeasonId,
        slots: &[SlotOccurrence],
    ) -> Result<Vec<SlotId>, StorageError> {
        let mut ids = Vec::with_capacity(slots.len());
        for slot in slots {
            let id:Option<i64>=sqlx::query_scalar::<_, i64>("INSERT INTO slots(season_id,local_date,local_start,local_end,starts_at,ends_at,space) VALUES (?,?,?,?,?,?,?) ON CONFLICT(season_id,starts_at,ends_at,space) DO NOTHING RETURNING id")
                .bind(season.get()).bind(slot.date.as_string()).bind(slot.hours.start().as_string()).bind(slot.hours.end().as_string()).bind(slot.interval.start().epoch_millis()).bind(slot.interval.end().epoch_millis()).bind(space_label(slot.space)).fetch_optional(&mut *self.tx).await.map_err(unavailable)?;
            if let Some(id) = id {
                ids.push(value(SlotId::try_from(id))?);
            }
        }
        Ok(ids)
    }
    async fn edit_slot(
        &mut self,
        id: SlotId,
        slot: &SlotOccurrence,
        version: Version,
    ) -> Result<(), StorageError> {
        changed(sqlx::query("UPDATE slots SET local_date=?,local_start=?,local_end=?,starts_at=?,ends_at=?,space=?,version=version+1 WHERE id=? AND version=?").bind(slot.date.as_string()).bind(slot.hours.start().as_string()).bind(slot.hours.end().as_string()).bind(slot.interval.start().epoch_millis()).bind(slot.interval.end().epoch_millis()).bind(space_label(slot.space)).bind(id.get()).bind(version.get()).execute(&mut *self.tx).await.map_err(unavailable)?)
    }
    async fn set_slot_enabled(
        &mut self,
        id: SlotId,
        enabled: bool,
        version: Version,
    ) -> Result<(), StorageError> {
        changed(
            sqlx::query("UPDATE slots SET enabled=?,version=version+1 WHERE id=? AND version=?")
                .bind(enabled)
                .bind(id.get())
                .bind(version.get())
                .execute(&mut *self.tx)
                .await
                .map_err(unavailable)?,
        )
    }
    async fn create_closure(
        &mut self,
        interval: Interval,
        space: GymSpace,
        reason: &Note,
    ) -> Result<ClosureId, StorageError> {
        value(ClosureId::try_from(sqlx::query_scalar::<_, i64>("INSERT INTO closures(starts_at,ends_at,space,reason) VALUES (?,?,?,?) RETURNING id").bind(interval.start().epoch_millis()).bind(interval.end().epoch_millis()).bind(space_label(space)).bind(reason.as_str()).fetch_one(&mut *self.tx).await.map_err(unavailable)?))
    }
    async fn reopen_closure(
        &mut self,
        id: ClosureId,
        version: Version,
    ) -> Result<(), StorageError> {
        changed(sqlx::query("UPDATE closures SET active=0,version=version+1 WHERE id=? AND version=? AND active=1").bind(id.get()).bind(version.get()).execute(&mut *self.tx).await.map_err(unavailable)?)
    }
    async fn create_series(
        &mut self,
        id: &OpaqueToken,
        team: TeamId,
        season: SeasonId,
    ) -> Result<(), StorageError> {
        sqlx::query("INSERT INTO booking_series(id,team_id,season_id) VALUES (?,?,?)")
            .bind(id.as_str())
            .bind(team.get())
            .bind(season.get())
            .execute(&mut *self.tx)
            .await
            .map_err(unavailable)?;
        Ok(())
    }
    async fn create_request(&mut self, r: &NewRequest) -> Result<RequestId, StorageError> {
        value(RequestId::try_from(sqlx::query_scalar::<_, i64>("INSERT INTO booking_requests(team_id,slot_id,series_id,activity,note,competing_reason,replaces_booking_id,replaces_version,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id").bind(r.team.get()).bind(r.slot.get()).bind(r.series.as_ref().map(OpaqueToken::as_str)).bind(activity_label(r.activity)).bind(r.note.as_str()).bind(r.reason.as_str()).bind(r.replacement.as_ref().map(|r|r.booking.get())).bind(r.replacement.as_ref().map(|r|r.version.get())).bind(r.creator.get()).bind(r.created.epoch_millis()).fetch_one(&mut *self.tx).await.map_err(unavailable)?))
    }
    async fn edit_request(
        &mut self,
        id: RequestId,
        slot: SlotId,
        activity: Activity,
        note: &Note,
        reason: &Note,
        version: Version,
    ) -> Result<(), StorageError> {
        changed(sqlx::query("UPDATE booking_requests SET slot_id=?,activity=?,note=?,competing_reason=?,version=version+1 WHERE id=? AND version=? AND status='pending'").bind(slot.get()).bind(activity_label(activity)).bind(note.as_str()).bind(reason.as_str()).bind(id.get()).bind(version.get()).execute(&mut *self.tx).await.map_err(unavailable)?)
    }
    async fn set_request_status(
        &mut self,
        id: RequestId,
        status: RequestStatus,
        version: Version,
    ) -> Result<(), StorageError> {
        changed(
            sqlx::query(
                "UPDATE booking_requests SET status=?,version=version+1 WHERE id=? AND version=?",
            )
            .bind(request_label(status))
            .bind(id.get())
            .bind(version.get())
            .execute(&mut *self.tx)
            .await
            .map_err(unavailable)?,
        )
    }
    async fn create_booking(&mut self, b: &NewBooking) -> Result<BookingId, StorageError> {
        value(BookingId::try_from(sqlx::query_scalar::<_, i64>("INSERT INTO bookings(calendar_uid,team_id,slot_id,series_id,activity,note,status,created_at,changed_at) VALUES (?,?,?,?,?,?,'confirmed',?,?) RETURNING id").bind(b.calendar_uid.as_str()).bind(b.team.get()).bind(b.slot.get()).bind(b.series.as_ref().map(OpaqueToken::as_str)).bind(activity_label(b.activity)).bind(b.note.as_str()).bind(b.now.epoch_millis()).bind(b.now.epoch_millis()).fetch_one(&mut *self.tx).await.map_err(unavailable)?))
    }
    async fn edit_booking(&mut self, b: &BookingEdit) -> Result<(), StorageError> {
        changed(sqlx::query("UPDATE bookings SET slot_id=?,activity=?,note=?,status=?,version=version+1,changed_at=? WHERE id=? AND version=?").bind(b.slot.get()).bind(activity_label(b.activity)).bind(b.note.as_str()).bind(booking_label(b.status)).bind(b.now.epoch_millis()).bind(b.id.get()).bind(b.version.get()).execute(&mut *self.tx).await.map_err(unavailable)?)
    }
    async fn create_swap(&mut self, s: &NewSwap) -> Result<SwapId, StorageError> {
        value(SwapId::try_from(sqlx::query_scalar::<_, i64>("INSERT INTO swaps(first_booking_id,second_booking_id,first_version,second_version,proposed_by,proposed_at,deadline) VALUES (?,?,?,?,?,?,?) RETURNING id").bind(s.first.get()).bind(s.second.get()).bind(s.first_version.get()).bind(s.second_version.get()).bind(s.proposer.get()).bind(s.now.epoch_millis()).bind(s.deadline.epoch_millis()).fetch_one(&mut *self.tx).await.map_err(unavailable)?))
    }
    async fn set_swap_status(
        &mut self,
        id: SwapId,
        status: SwapStatus,
        version: Version,
    ) -> Result<(), StorageError> {
        changed(
            sqlx::query("UPDATE swaps SET status=?,version=version+1 WHERE id=? AND version=?")
                .bind(swap_label(status))
                .bind(id.get())
                .bind(version.get())
                .execute(&mut *self.tx)
                .await
                .map_err(unavailable)?,
        )
    }
    async fn recipients(&mut self, selection: &Recipients) -> Result<Vec<Actor>, StorageError> {
        let mut query = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
            "SELECT DISTINCT u.id,u.email,EXISTS(SELECT 1 FROM organizer_grants o WHERE o.user_id=u.id) FROM users u WHERE u.status='enabled' AND (",
        );
        match selection {
            Recipients::Organizers => {
                query.push("EXISTS(SELECT 1 FROM organizer_grants o WHERE o.user_id=u.id)");
            }
            Recipients::Teams(teams) | Recipients::OrganizersAndTeams(teams) => {
                if matches!(selection, Recipients::OrganizersAndTeams(_)) {
                    query.push("EXISTS(SELECT 1 FROM organizer_grants o WHERE o.user_id=u.id) OR ");
                }
                query.push(
                    "EXISTS(SELECT 1 FROM team_grants g WHERE g.user_id=u.id AND g.team_id IN (",
                );
                if teams.is_empty() {
                    query.push("NULL");
                } else {
                    let mut separated = query.separated(",");
                    for team in teams {
                        separated.push_bind(team.get());
                    }
                }
                query.push("))");
            }
            Recipients::ActiveCoaches => {
                query.push("EXISTS(SELECT 1 FROM team_grants g JOIN team_seasons ts ON ts.team_id=g.team_id JOIN seasons s ON s.id=ts.season_id WHERE g.user_id=u.id AND s.status='active')");
            }
        }
        query.push(") ORDER BY u.id");
        query
            .build_query_as::<(i64, String, bool)>()
            .fetch_all(&mut *self.tx)
            .await
            .map_err(unavailable)?
            .into_iter()
            .map(|(id, email, organizer)| {
                Ok(Actor {
                    id: value(UserId::try_from(id))?,
                    email: value(EmailAddress::try_from(email.as_str()))?,
                    organizer,
                })
            })
            .collect()
    }
    async fn invited_user(&mut self, email: &EmailAddress) -> Result<Option<UserId>, StorageError> {
        sqlx::query_scalar::<_, i64>("SELECT id FROM users WHERE email=? AND status='enabled'")
            .bind(email.as_str())
            .fetch_optional(&mut *self.tx)
            .await
            .map_err(unavailable)?
            .map(|id| value(UserId::try_from(id)))
            .transpose()
    }
}
