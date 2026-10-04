import { Option } from "effect";
import {
  recurringSelection,
  slotsConflict,
  type Request,
  type Schedule,
  type Slot,
  type RecurringSelection,
} from "./schedule.js";

export const shortTeam = (name: string): string =>
  name
    .replace(/^.*?\b(\d+(?:st|nd|rd|th))\s+Grade\s+/i, "$1 ")
    .replace(/\s+Basketball\b/gi, "");
export const minutes = (time: string): number => {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
};
export const clockLabel = (time: string): string => {
  const value = minutes(time);
  const hour = Math.floor(value / 60);
  return `${hour % 12 || 12}${value % 60 ? `:${String(value % 60).padStart(2, "0")}` : ""} ${hour < 12 ? "am" : "pm"}`;
};
export const timeRange = (slot: Slot): string =>
  `${clockLabel(slot.start)}–${clockLabel(slot.end)}`;
export const slotFor = (schedule: Schedule, id: number): Option.Option<Slot> =>
  Option.fromNullable(schedule.slots.find((slot) => slot.id === id));
export const pendingAt = (
  schedule: Schedule,
  slot: Slot,
): ReadonlyArray<Request> =>
  schedule.requests.filter(
    (request) =>
      request.status === "pending" &&
      Option.exists(slotFor(schedule, request.slot), (other) =>
        slotsConflict(slot, other),
      ),
  );

export type ReviewGroup = {
  readonly key: string;
  readonly requests: ReadonlyArray<Request>;
  readonly competing: boolean;
  readonly firstDate: string;
};
/** Recurring rows and physically competing rows form connected review groups. Compatible halves stay separate. */
export const reviewGroups = (
  schedule: Schedule,
  requests: ReadonlyArray<Request>,
): ReadonlyArray<ReviewGroup> => {
  const groups: Array<Array<Request>> = [];
  const related = (a: Request, b: Request): boolean =>
    (a.team === b.team &&
      a.series !== null &&
      a.series === b.series &&
      Boolean(a.replacement) === Boolean(b.replacement) &&
      a.activity === b.activity &&
      a.note === b.note &&
      a.reason === b.reason) ||
    (a.status === "pending" &&
      b.status === "pending" &&
      a.team !== b.team &&
      Option.exists(slotFor(schedule, a.slot), (first) =>
        Option.exists(slotFor(schedule, b.slot), (second) =>
          slotsConflict(first, second),
        ),
      ));
  for (const request of requests) {
    const connected = groups.filter((group) =>
      group.some((other) => related(request, other)),
    );
    const merged = [request, ...connected.flat()];
    for (const group of connected) groups.splice(groups.indexOf(group), 1);
    groups.push(merged);
  }
  return groups
    .map((group) => {
      const ordered = [...group].sort(
        (a, b) =>
          Option.match(slotFor(schedule, a.slot), {
            onNone: () => 0,
            onSome: (slot) => slot.starts_at,
          }) -
            Option.match(slotFor(schedule, b.slot), {
              onNone: () => 0,
              onSome: (slot) => slot.starts_at,
            }) || a.id - b.id,
      );
      return {
        key: String(Math.min(...group.map((r) => r.id))),
        requests: ordered,
        competing: new Set(group.map((r) => r.team)).size > 1,
        firstDate: Option.match(slotFor(schedule, ordered[0]?.slot ?? 0), {
          onNone: () => "",
          onSome: (slot) => slot.date,
        }),
      };
    })
    .sort(
      (a, b) =>
        a.firstDate.localeCompare(b.firstDate) || a.key.localeCompare(b.key),
    );
};
/** Expand every distinct selected weekly pattern, preserving the full list of exceptions. */
export const weeklyPatterns = (
  schedule: Schedule,
  anchors: ReadonlyArray<number>,
  end: string,
): RecurringSelection => {
  const patterns = new Map<string, Slot>();
  anchors.forEach((id) =>
    Option.map(slotFor(schedule, id), (slot) => {
      const day = new Date(`${slot.date}T12:00:00Z`).getUTCDay();
      const key = `${slot.season}/${day}/${slot.start}/${slot.end}/${slot.space}`;
      const prior = patterns.get(key);
      if (!prior || slot.date < prior.date) patterns.set(key, slot);
    }),
  );
  const values = [...patterns.values()].map((anchor) =>
    recurringSelection(schedule, anchor, end),
  );
  return {
    slots: [...new Set(values.flatMap((value) => value.slots))].sort(
      (a, b) =>
        Option.match(slotFor(schedule, a), {
          onNone: () => 0,
          onSome: (slot) => slot.starts_at,
        }) -
        Option.match(slotFor(schedule, b), {
          onNone: () => 0,
          onSome: (slot) => slot.starts_at,
        }),
    ),
    excluded: values.flatMap((value, index) =>
      value.excluded.map((excluded) => ({
        date: excluded.date,
        reason: `${[...patterns.values()][index]?.start ?? ""} · ${[...patterns.values()][index]?.space.replaceAll("_", " ") ?? ""}: ${excluded.reason}`,
      })),
    ),
  };
};
