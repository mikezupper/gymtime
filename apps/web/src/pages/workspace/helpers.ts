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
