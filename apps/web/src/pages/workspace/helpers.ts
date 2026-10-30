import { slotLabel } from "../../components/planner-forms.js";
import {
  slotsConflict,
  type Booking,
  type Schedule,
} from "../../domain/schedule.js";
import type { WorkspaceView } from "./model.js";
export const manageable = (v: WorkspaceView, teamId: number) => {
  const team = v.current?.teams.find((t) => t.id === teamId);
  return Boolean(
    team &&
      v.session &&
      (v.session.organizer || team.primary === v.session.user_id),
  );
};
/** What a list row of the workspace picks: the view's fields and the schedule. */
export interface RowContext {
  readonly v: WorkspaceView;
  readonly s: Schedule;
}
const sameFields = (a: object, b: object) => {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        Object.is(Reflect.get(a, key), Reflect.get(b, key)),
    )
  );
};
/** `each` equality for a `RowContext`: the view builds `v` every render, so compare its fields. */
export const sameRowContext = (a: RowContext, b: RowContext) =>
  a.s === b.s && sameFields(a.v, b.v);
export const teamName = (v: WorkspaceView, id: number) => {
  return v.current?.teams.find((t) => t.id === id)?.name ?? "Team";
};
export const describeBooking = (v: WorkspaceView, b: Booking) => {
  const slot = v.current?.slots.find((slot) => slot.id === b.slot);
  return `${teamName(v, b.team)} · ${slot ? slotLabel(slot) : "Unknown time"}`;
};
export const mine = (v: WorkspaceView, s: Schedule) => {
  return s.teams
    .filter(
      (team) =>
        team.primary === v.session?.user_id ||
        team.assistants.includes(v.session?.user_id ?? 0),
    )
    .map((team) => team.id);
};
export const decisionConflict = (v: WorkspaceView, s: Schedule) => {
  const choices = s.requests.filter((request) =>
    v.decisions.includes(request.id),
  );
  return choices.some((first, index) =>
    choices
      .slice(index + 1)
      .some((second) =>
        s.slots.some(
          (a) =>
            a.id === first.slot &&
            s.slots.some((b) => b.id === second.slot && slotsConflict(a, b)),
        ),
      ),
  );
};
