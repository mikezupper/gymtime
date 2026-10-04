use super::snapshot::{unavailable, value};
use gymtime_app::{
    StorageError,
    schedule::{ActionOutcome, ResourceRef, ScheduleWarning, ports::SavedMutation},
};
use gymtime_domain::{
    Instant,
    auth::{Digest, OpaqueToken, UserId},
    schedule::*,
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct ReceiptOutcome {
    resources: Vec<ReceiptResource>,
    warnings: Vec<String>,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct ReceiptResource {
    kind: String,
    id: i64,
}
fn encode(outcome: &ActionOutcome) -> ReceiptOutcome {
    let resources = outcome
        .resources
        .iter()
        .map(|resource| {
            let (kind, id) = match resource {
                ResourceRef::User(id) => ("user", id.get()),
                ResourceRef::Gym(id) => ("gym", id.get()),
                ResourceRef::Season(id) => ("season", id.get()),
                ResourceRef::Team(id) => ("team", id.get()),
                ResourceRef::Slot(id) => ("slot", id.get()),
                ResourceRef::Closure(id) => ("closure", id.get()),
                ResourceRef::Booking(id) => ("booking", id.get()),
                ResourceRef::Request(id) => ("request", id.get()),
                ResourceRef::Swap(id) => ("swap", id.get()),
            };
            ReceiptResource {
                kind: kind.to_owned(),
                id,
            }
        })
        .collect();
    ReceiptOutcome {
        resources,
        warnings: outcome
            .warnings
            .iter()
            .map(|warning| match warning {
                ScheduleWarning::CoachOverlap => "coach_overlap".to_owned(),
                ScheduleWarning::SomeDatesUnavailable => "some_dates_unavailable".to_owned(),
            })
            .collect(),
    }
}
fn decode(raw: ReceiptOutcome) -> Result<ActionOutcome, StorageError> {
    let resources = raw
        .resources
        .into_iter()
        .map(|r| match r.kind.as_str() {
            "user" => Ok(ResourceRef::User(value(UserId::try_from(r.id))?)),
            "gym" => Ok(ResourceRef::Gym(value(Version::try_from(r.id))?)),
            "season" => Ok(ResourceRef::Season(value(SeasonId::try_from(r.id))?)),
            "team" => Ok(ResourceRef::Team(value(TeamId::try_from(r.id))?)),
            "slot" => Ok(ResourceRef::Slot(value(SlotId::try_from(r.id))?)),
            "closure" => Ok(ResourceRef::Closure(value(ClosureId::try_from(r.id))?)),
            "booking" => Ok(ResourceRef::Booking(value(BookingId::try_from(r.id))?)),
            "request" => Ok(ResourceRef::Request(value(RequestId::try_from(r.id))?)),
            "swap" => Ok(ResourceRef::Swap(value(SwapId::try_from(r.id))?)),
            _ => Err(StorageError::InvalidData),
        })
        .collect::<Result<_, StorageError>>()?;
    let warnings = raw
        .warnings
        .into_iter()
        .map(|r| match r.as_str() {
            "coach_overlap" => Ok(ScheduleWarning::CoachOverlap),
            "some_dates_unavailable" => Ok(ScheduleWarning::SomeDatesUnavailable),
            _ => Err(StorageError::InvalidData),
        })
        .collect::<Result<_, _>>()?;
    Ok(ActionOutcome {
        resources,
        warnings,
    })
}
pub(super) async fn load(
    tx: &mut sqlx::SqliteConnection,
    actor: UserId,
    key: &OpaqueToken,
) -> Result<Option<SavedMutation>, StorageError> {
    let row: Option<(String, Vec<u8>, String)> = sqlx::query_as(
        "SELECT operation,request_digest,result FROM mutation_receipts WHERE actor_id=? AND key=?",
    )
    .bind(actor.get())
    .bind(key.as_str())
    .fetch_optional(tx)
    .await
    .map_err(unavailable)?;
    row.map(|(operation, digest, result)| {
        Ok(SavedMutation {
            operation,
            digest: value(Digest::try_from(digest.as_slice()))?,
            outcome: decode(value(serde_json::from_str(&result))?)?,
        })
    })
    .transpose()
}
pub(super) async fn save(
    tx: &mut sqlx::SqliteConnection,
    actor: UserId,
    key: &OpaqueToken,
    operation: &str,
    digest: &Digest,
    outcome: &ActionOutcome,
    now: Instant,
) -> Result<(), StorageError> {
    let result = value(serde_json::to_string(&encode(outcome)))?;
    sqlx::query("INSERT INTO mutation_receipts(actor_id,key,operation,request_digest,result,created_at) VALUES (?,?,?,?,?,?)").bind(actor.get()).bind(key.as_str()).bind(operation).bind(digest.as_bytes()).bind(result).bind(now.epoch_millis()).execute(tx).await.map_err(unavailable)?;
    Ok(())
}
