import {
  child,
  type IntentInput,
  type Intents,
  type ParserCtx,
} from "@gyral/core";
import { Schema } from "effect";
import { GymtimeCalendar } from "../../components/gymtime-calendar.js";
import { GymtimeGuide } from "../../components/gymtime-guide.js";
import {
  activityInput,
  number,
  scopeInput,
  slotLabel,
  text,
} from "../../components/planner-forms.js";
import { idFrom } from "../../components/props.js";
import type { ScheduleAction } from "../../domain/schedule.js";
import { GymtimeInbox } from "../gymtime-inbox.js";
import { GymtimeSetup } from "../gymtime-setup.js";
import type { WorkspaceMsg, WorkspaceProps, WorkspaceState } from "./model.js";
const tabs = Schema.Literal(
  "calendar",
  "finder",
  "requests",
  "history",
  "swaps",
  "setup",
  "people",
  "inbox",
  "sharing",
  "help",
);
const texts = Schema.Literal(
  "finderEnd",
  "spaceFilter",
  "bookingMode",
  "swapDate",
  "requestType",
  "requestDate",
  "historyKind",
  "historySearch",
  "historyStatus",
);
const numbers = Schema.Literal("teamFilter", "selectedTeam", "requestTeam");
const dialogs = Schema.Literal(
  "None",
  "Booking",
  "Slot",
  "Selection",
  "Confirm",
);
const date = (value: string | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
const attr = (input: IntentInput, name: string) =>
  input.target.getAttribute(`data-${name}`) ?? "";
type Context = ParserCtx<WorkspaceProps, WorkspaceState>;
type ActionMsg = Extract<WorkspaceMsg, { _tag: "Action" }>;
const action = (
  value: ScheduleAction,
  confirmation = "",
  preview = false,
  formKey = "",
): ActionMsg => ({
  _tag: "Action",
  action: value,
  confirmation,
  preview,
  formKey,
});
const fromForm = (
  input: IntentInput,
  context: Context,
  make: (f: FormData, s: WorkspaceState) => ActionMsg | undefined,
) =>
  input.formData && context.state.operation === "Idle"
    ? make(input.formData, context.state)
    : undefined;
const booking = (input: IntentInput, s: WorkspaceState) =>
  s.current?.bookings.find((b) => b.id === idFrom(attr(input, "booking")));
const request = (input: IntentInput, s: WorkspaceState) =>
  s.current?.requests.find((r) => r.id === idFrom(attr(input, "request")));
const description = (s: WorkspaceState, id: number) => {
  const b = s.current?.bookings.find((x) => x.id === id);
  const slot = s.current?.slots.find((x) => x.id === b?.slot);
  return `${s.current?.teams.find((x) => x.id === b?.team)?.name ?? "Team"} · ${slot ? slotLabel(slot) : "Unknown time"}`;
};
const setupOutput = child(GymtimeSetup, (out) =>
  action(out.action, out.confirmation, out.preview, out.formKey),
);
const inboxOutput = child(GymtimeInbox, (out) =>
  action(out.action, out.confirmation, out.preview, out.formKey),
);

export const workspaceParsers = {
  Calendar: child(GymtimeCalendar, (output): WorkspaceMsg => output),
  Guide: child(GymtimeGuide, (output): WorkspaceMsg => output),
  Action: (input: IntentInput) => setupOutput(input) ?? inboxOutput(input),
  Tab: ({ value }: IntentInput) =>
    Schema.is(tabs)(value) ? ({ _tag: "Tab", tab: value } as const) : undefined,
  Setup: ({ value }: IntentInput) =>
    value &&
    ["slots", "closures", "gym-setup", "seasons", "team-setup"].includes(value)
      ? ({ _tag: "Setup", section: value } as const)
      : undefined,
  Refresh: true,
  TextFilter: (input: IntentInput) => {
    const field = attr(input, "field");
    return Schema.is(texts)(field)
      ? ({ _tag: "TextFilter", field, value: input.value ?? "" } as const)
      : undefined;
  },
  NumberFilter: (input: IntentInput) => {
    const field = attr(input, "field");
    const value = Number(input.value);
    return Schema.is(numbers)(field) &&
      Number.isSafeInteger(value) &&
      value >= -1
      ? ({ _tag: "NumberFilter", field, value } as const)
      : undefined;
  },
  CalendarDate: ({ value }: IntentInput) => {
    const parsed = date(value);
    return parsed
      ? ({ _tag: "CalendarDate", date: parsed } as const)
      : undefined;
  },
  FinderDate: ({ value }: IntentInput) => {
    const parsed = date(value);
    return parsed ? ({ _tag: "FinderDate", date: parsed } as const) : undefined;
  },
  Walkthrough: ({ value }: IntentInput) =>
    Number.isInteger(Number(value))
      ? ({ _tag: "Walkthrough", step: Number(value) } as const)
      : undefined,
  ToggleSlot: ({ value }: IntentInput) => {
    const id = idFrom(value);
    return id ? ({ _tag: "ToggleSlot", id } as const) : undefined;
  },
  Booking: ({ value }: IntentInput) => {
    const id = idFrom(value);
    return id ? ({ _tag: "Booking", id } as const) : undefined;
  },
  Weekly: ({ formData }: IntentInput) => {
    const until = date(formData ? text(formData, "until") : undefined);
    return until ? ({ _tag: "Weekly", until } as const) : undefined;
  },
  Draft: (input: IntentInput, { state: s }: Context) => {
    if (!(input.target instanceof HTMLFormElement)) return undefined;
    const f = new FormData(input.target);
    return {
      _tag: "Draft",
      value: {
        note: text(f, "note"),
        reason: f.has("reason") ? text(f, "reason") : s.selectionDraft.reason,
        activity: activityInput(f),
        scope: scopeInput(f),
      },
    } as const;
  },
  RequestTime: (input: IntentInput, context: Context) =>
    fromForm(input, context, (f, s) => {
      if (!s.selected.length || !s.selectedTeam) return undefined;
      const edit = s.edit;
      const value: ScheduleAction = edit
        ? {
            operation: "change_booking",
            id: edit.id,
            version: edit.version,
            scope: scopeInput(f),
            slots: [...s.selected],
            activity: activityInput(f),
            note: text(f, "note"),
            reason: text(f, "reason"),
          }
        : text(f, "mode") === "direct" && context.props.session?.organizer
          ? {
              operation: "book_directly",
              team: s.selectedTeam,
              slots: [...s.selected],
              activity: activityInput(f),
              note: text(f, "note"),
            }
          : {
              operation: "submit_requests",
              team: s.selectedTeam,
              slots: [...s.selected],
              activity: activityInput(f),
              note: text(f, "note"),
              reason: text(f, "reason"),
            };
      return action(
        value,
        `Submit ${s.selected.length} selected date(s)? ${edit ? "Existing bookings remain confirmed until the organizer approves each change." : "Each selected date will be checked for conflicts."}`,
        false,
        attr(input, "form-key"),
      );
    }),
  ClearSelection: true,
  ChangeBooking: ({ value }: IntentInput) => {
    const id = idFrom(value);
    return id ? ({ _tag: "ChangeBooking", id } as const) : undefined;
  },
  CancelBooking: (input: IntentInput, context: Context) =>
    fromForm(input, context, (f, s) => {
      const b = booking(input, s);
      return !b
        ? undefined
        : action(
            {
              operation: "cancel_booking",
              id: b.id,
              version: b.version,
              scope: scopeInput(f),
            },
            `Cancel ${description(s, b.id)}? Scope: ${text(f, "scope")}. Completed dates stay in history. The released time becomes available immediately.`,
            false,
            attr(input, "form-key"),
          );
    }),
  Editor: (input: IntentInput) => {
    const key = attr(input, "editor");
    return input.newState === "open" && /^(move|swap)-\d+$/.test(key)
      ? ({ _tag: "Editor", key } as const)
      : undefined;
  },
  MoveBooking: (input: IntentInput, context: Context) =>
    fromForm(input, context, (f, s) => {
      const b = booking(input, s);
      return !b
        ? undefined
        : action(
            {
              operation: "move_booking",
              id: b.id,
              slot: number(f, "slot"),
              activity: activityInput(f),
              note: text(f, "note"),
              version: b.version,
            },
            "Change this confirmed booking? Affected coaches and parent calendars will receive the new time.",
            false,
            attr(input, "form-key"),
          );
    }),
  EditDate: (input: IntentInput) => {
    const record = attr(input, "record");
    const parsed = date(input.value);
    return parsed && /^(booking|request)-\d+$/.test(record)
      ? ({ _tag: "EditDate", record, date: parsed } as const)
      : undefined;
  },
  ProposeSwap: (input: IntentInput, context: Context) =>
    fromForm(input, context, (f, s) => {
      const first = booking(input, s);
      const second = s.current?.bookings.find(
        (b) => b.id === number(f, "second"),
      );
      return !first || !second
        ? undefined
        : action(
            {
              operation: "propose_swap",
              first: first.id,
              first_version: first.version,
              second: second.id,
              second_version: second.version,
            },
            "Propose this exchange? Both original bookings stay confirmed. The other team's primary coach must accept before the earlier booking starts.",
            false,
            attr(input, "form-key"),
          );
    }),
  RequestHistory: true,
  Competing: true,
  ClearRequestFilters: true,
  Decide: (input: IntentInput, { state: s }: Context) => {
    const id = idFrom(input.value);
    return {
      _tag: "Decide",
      approve: attr(input, "approve") === "true",
      ids: id ? [id] : s.decisions,
    } as const;
  },
  SelectGroup: ({ value }: IntentInput) =>
    value ? ({ _tag: "SelectGroup", key: value } as const) : undefined,
  ToggleDecision: ({ value }: IntentInput) => {
    const id = idFrom(value);
    return id ? ({ _tag: "ToggleDecision", id } as const) : undefined;
  },
  WithdrawRequests: (input: IntentInput, context: Context) =>
    fromForm(input, context, (f, s) => {
      const source = request(input, s);
      const schedule = s.current;
      if (!source || !schedule) return undefined;
      const scope = scopeInput(f);
      const from =
        schedule.slots.find((x) => x.id === source.slot)?.starts_at ?? 0;
      const ids = schedule.requests
        .filter((r) => {
          const slot = schedule.slots.find((x) => x.id === r.slot);
          return (
            r.status === "pending" &&
            r.team === source.team &&
            Boolean(slot && slot.ends_at > schedule.now) &&
            (r.id === source.id ||
              (source.series &&
                r.series === source.series &&
                scope !== "one" &&
                (scope === "remaining" ||
                  Boolean(slot && slot.starts_at >= from))))
          );
        })
        .map((r) => r.id);
      return action(
        { operation: "withdraw_requests", ids },
        `Withdraw ${ids.length} pending requested date(s)? Original confirmed bookings remain unchanged.`,
        false,
        attr(input, "form-key"),
      );
    }),
  EditRequest: (input: IntentInput, context: Context) =>
    fromForm(input, context, (f, s) => {
      const r = request(input, s);
      return !r
        ? undefined
        : action(
            {
              operation: "edit_request",
              id: r.id,
              slot: number(f, "slot"),
              activity: activityInput(f),
              note: text(f, "note"),
              reason: text(f, "reason"),
              version: r.version,
            },
            "",
            false,
            attr(input, "form-key"),
          );
    }),
  HistoryPage: ({ value }: IntentInput) =>
    Number.isSafeInteger(Number(value))
      ? ({ _tag: "HistoryPage", page: Number(value) } as const)
      : undefined,
  SwapHistory: true,
  RespondSwap: (input: IntentInput, { state: s }: Context) => {
    const swap = s.current?.swaps.find((x) => x.id === idFrom(input.value));
    const accept = attr(input, "accept") === "true";
    return !swap
      ? undefined
      : action(
          {
            operation: "respond_swap",
            id: swap.id,
            version: swap.version,
            accept,
          },
          accept
            ? "Accept this swap? Both teams' times and gym spaces change together. No organizer approval is needed."
            : "",
        );
  },
  WithdrawSwap: (input: IntentInput, { state: s }: Context) => {
    const swap = s.current?.swaps.find((x) => x.id === idFrom(input.value));
    return !swap
      ? undefined
      : action({
          operation: "withdraw_swap",
          id: swap.id,
          version: swap.version,
        });
  },
  RotateLink: (input: IntentInput, { state: s }: Context) => {
    const team = s.current?.teams.find((x) => x.id === idFrom(input.value));
    return !team
      ? undefined
      : action(
          {
            operation: "rotate_team_link",
            team: team.id,
            version: team.version,
          },
          `Replace ${team.name}'s public link? Its old webpage and calendar subscription stop working. Give parents the new link.`,
        );
  },
  RetryAction: true,
  ViewRequests: true,
  Season: ({ value }: IntentInput) =>
    Number.isSafeInteger(Number(value)) && Number(value) >= 0
      ? ({ _tag: "Season", season: Number(value) } as const)
      : undefined,
  Selection: true,
  CloseDialog: (input: IntentInput) =>
    Schema.is(dialogs)(input.value)
      ? ({ _tag: "CloseDialog", dialog: input.value } as const)
      : undefined,
  Closed: (input: IntentInput) => {
    const dialog = attr(input, "dialog");
    return Schema.is(dialogs)(dialog)
      ? ({ _tag: "Closed", dialog } as const)
      : undefined;
  },
  Dismiss: true,
  Confirm: true,
} satisfies Intents<WorkspaceMsg, WorkspaceProps, string, WorkspaceState>;
export const workspaceIntents = {
  Calendar: "Calendar",
  Guide: "Guide",
  Action: "Action",
  Tab: "Tab",
  Setup: "Setup",
  Refresh: "Refresh",
  TextFilter: "TextFilter",
  NumberFilter: "NumberFilter",
  CalendarDate: "CalendarDate",
  FinderDate: "FinderDate",
  Walkthrough: "Walkthrough",
  ToggleSlot: "ToggleSlot",
  Booking: "Booking",
  Weekly: "Weekly",
  Draft: "Draft",
  RequestTime: "RequestTime",
  ClearSelection: "ClearSelection",
  ChangeBooking: "ChangeBooking",
  CancelBooking: "CancelBooking",
  Editor: "Editor",
  MoveBooking: "MoveBooking",
  EditDate: "EditDate",
  ProposeSwap: "ProposeSwap",
  RequestHistory: "RequestHistory",
  Competing: "Competing",
  ClearRequestFilters: "ClearRequestFilters",
  Decide: "Decide",
  SelectGroup: "SelectGroup",
  ToggleDecision: "ToggleDecision",
  WithdrawRequests: "WithdrawRequests",
  EditRequest: "EditRequest",
  HistoryPage: "HistoryPage",
  SwapHistory: "SwapHistory",
  RespondSwap: "RespondSwap",
  WithdrawSwap: "WithdrawSwap",
  RotateLink: "RotateLink",
  RetryAction: "RetryAction",
  ViewRequests: "ViewRequests",
  Season: "Season",
  Selection: "Selection",
  CloseDialog: "CloseDialog",
  Closed: "Closed",
  Dismiss: "Dismiss",
  Confirm: "Confirm",
} as const;
