import { command, type Next, type PropsOf, type Update } from "@gyral/core";
import { Either } from "effect";
import type { CalendarOutput } from "../../components/gymtime-calendar.js";
import type { GuideOutput } from "../../components/gymtime-guide.js";
import { sessionProp } from "../../components/props.js";
import { ApiFailure } from "../../domain/api.js";
import {
  initialGuidance,
  type GuidancePreferences,
  type HelpDestination,
} from "../../domain/guidance.js";
import { reviewGroups, weeklyPatterns } from "../../domain/schedule-views.js";
import {
  monday,
  shiftDate,
  slotsConflict,
  type Booking,
  type Preview,
  type Schedule,
  type ScheduleAction,
} from "../../domain/schedule.js";
import {
  address,
  guidanceDriver,
  guidanceSaveDriver,
  previewDriver,
  saveDriver,
  scheduleDriver,
  type PageAddress,
  type Result,
} from "../../runtime/commands.js";

export const workspaceProps = { session: sessionProp() };
export type WorkspaceProps = PropsOf<typeof workspaceProps>;
export type Tab =
  | "calendar"
  | "finder"
  | "requests"
  | "history"
  | "swaps"
  | "setup"
  | "people"
  | "inbox"
  | "sharing"
  | "help";
export interface SelectionDraft {
  readonly note: string;
  readonly reason: string;
  readonly activity: "practice" | "game";
  readonly scope: "one" | "future" | "remaining";
}
export const emptyDraft: SelectionDraft = {
  note: "",
  reason: "",
  activity: "practice",
  scope: "one",
};
export interface WorkspaceState {
  readonly current: Schedule | undefined;
  readonly tab: Tab;
  readonly helpPreferences: GuidancePreferences;
  readonly helpWarning: string;
  readonly walkthrough: number;
  readonly guidanceStatus: "Loading" | "Ready";
  readonly loadStatus: "Loading" | "Ready";
  readonly operation: "Idle" | "Saving" | "Previewing";
  readonly revision: number;
  readonly pageAddress: PageAddress;
  readonly season: number;
  readonly week: string;
  readonly teamFilter: number;
  readonly spaceFilter: string;
  readonly day: string;
  readonly finderEnd: string;
  readonly selectedTeam: number;
  readonly activeBooking: number;
  readonly activeSlot: number;
  readonly historyPage: number;
  readonly historySearch: string;
  readonly historyStatus: string;
  readonly historyKind: string;
  readonly requestTeam: number;
  readonly requestType: string;
  readonly requestDate: string;
  readonly competingOnly: boolean;
  readonly swapHistory: boolean;
  readonly selectionOpen: boolean;
  readonly setupSection: string;
  readonly editDates: Readonly<Record<string, string>>;
  readonly swapDate: string;
  readonly bookingMode: string;
  readonly selectionDraft: SelectionDraft;
  readonly reviewOrigin: boolean;
  readonly selected: ReadonlyArray<number>;
  readonly excluded: ReadonlyArray<{
    readonly date: string;
    readonly reason: string;
  }>;
  readonly decisions: ReadonlyArray<number>;
  readonly edit: Booking | undefined;
  readonly pending: ScheduleAction | undefined;
  readonly retryKey: string;
  readonly confirmation: string;
  readonly previewValue: Preview | undefined;
  readonly message: string;
  readonly failure: ApiFailure | undefined;
  readonly errorForm: string;
  readonly openedBookingForms: ReadonlyArray<string>;
  readonly dialog: "None" | "Booking" | "Slot" | "Selection" | "Confirm";
}
export type WorkspaceView = WorkspaceState &
  WorkspaceProps & { readonly busy: boolean };
export type TextFilter =
  | "finderEnd"
  | "spaceFilter"
  | "bookingMode"
  | "swapDate"
  | "requestType"
  | "requestDate"
  | "historyKind"
  | "historySearch"
  | "historyStatus";
export type NumberFilter = "teamFilter" | "selectedTeam" | "requestTeam";
export type WorkspaceMsg =
  | CalendarOutput
  | GuideOutput
  | { readonly _tag: "Tab"; readonly tab: Tab }
  | { readonly _tag: "Setup"; readonly section: string }
  | { readonly _tag: "Refresh" }
  | {
      readonly _tag: "Loaded";
      readonly revision: number;
      readonly result: Result<"schedule">;
    }
  | { readonly _tag: "Address"; readonly value: PageAddress }
  | { readonly _tag: "GuidanceLoaded"; readonly result: Result<"guidance"> }
  | { readonly _tag: "GuidanceSaved"; readonly result: Result<"saveGuidance"> }
  | { readonly _tag: "Failure"; readonly failure: ApiFailure }
  | {
      readonly _tag: "LoadFailed";
      readonly revision: number;
      readonly failure: ApiFailure;
    }
  | { readonly _tag: "GuidanceFailed"; readonly failure: ApiFailure }
  | {
      readonly _tag: "Action";
      readonly action: ScheduleAction;
      readonly confirmation: string;
      readonly preview: boolean;
      readonly formKey: string;
    }
  | { readonly _tag: "Saved"; readonly result: Result<"save"> }
  | { readonly _tag: "Previewed"; readonly result: Result<"preview"> }
  | { readonly _tag: "Confirm" }
  | { readonly _tag: "Dismiss" }
  | { readonly _tag: "RetryAction" }
  | { readonly _tag: "CloseDialog"; readonly dialog: WorkspaceState["dialog"] }
  | { readonly _tag: "Closed"; readonly dialog: WorkspaceState["dialog"] }
  | { readonly _tag: "Selection" }
  | { readonly _tag: "ClearSelection" }
  | {
      readonly _tag: "TextFilter";
      readonly field: TextFilter;
      readonly value: string;
    }
  | {
      readonly _tag: "NumberFilter";
      readonly field: NumberFilter;
      readonly value: number;
    }
  | { readonly _tag: "CalendarDate"; readonly date: string }
  | { readonly _tag: "FinderDate"; readonly date: string }
  | { readonly _tag: "Walkthrough"; readonly step: number }
  | { readonly _tag: "ToggleSlot"; readonly id: number }
  | { readonly _tag: "Weekly"; readonly until: string }
  | { readonly _tag: "Draft"; readonly value: SelectionDraft }
  | { readonly _tag: "ChangeBooking"; readonly id: number }
  | { readonly _tag: "Editor"; readonly key: string }
  | {
      readonly _tag: "EditDate";
      readonly record: string;
      readonly date: string;
    }
  | { readonly _tag: "RequestHistory" }
  | { readonly _tag: "Competing" }
  | { readonly _tag: "ClearRequestFilters" }
  | {
      readonly _tag: "Decide";
      readonly approve: boolean;
      readonly ids: ReadonlyArray<number>;
    }
  | { readonly _tag: "SelectGroup"; readonly key: string }
  | { readonly _tag: "ToggleDecision"; readonly id: number }
  | { readonly _tag: "HistoryPage"; readonly page: number }
  | { readonly _tag: "SwapHistory" }
  | { readonly _tag: "Season"; readonly season: number }
  | { readonly _tag: "ViewRequests" };

export const workspaceInitial: WorkspaceState = {
  current: undefined,
  tab: "calendar",
  helpPreferences: initialGuidance,
  helpWarning: "",
  walkthrough: -1,
  guidanceStatus: "Loading",
  loadStatus: "Loading",
  operation: "Idle",
  revision: 0,
  pageAddress: { origin: "", host: "", path: "" },
  season: 0,
  week: "",
  teamFilter: 0,
  spaceFilter: "all",
  day: "",
  finderEnd: "",
  selectedTeam: 0,
  activeBooking: 0,
  activeSlot: 0,
  historyPage: 0,
  historySearch: "",
  historyStatus: "all",
  historyKind: "bookings",
  requestTeam: 0,
  requestType: "all",
  requestDate: "",
  competingOnly: false,
  swapHistory: false,
  selectionOpen: false,
  setupSection: "",
  editDates: {},
  swapDate: "",
  bookingMode: "direct",
  selectionDraft: emptyDraft,
  reviewOrigin: false,
  selected: [],
  excluded: [],
  decisions: [],
  edit: undefined,
  pending: undefined,
  retryKey: "",
  confirmation: "",
  previewValue: undefined,
  message: "",
  failure: undefined,
  errorForm: "",
  openedBookingForms: [],
  dialog: "None",
};
const failure = (error: ApiFailure): WorkspaceMsg => ({
  _tag: "Failure",
  failure: error,
});
export const loadWorkspace = (revision: number) =>
  command(scheduleDriver, undefined, {
    key: "schedule",
    concurrency: "switch",
    onSuccess: (result): WorkspaceMsg => ({ _tag: "Loaded", revision, result }),
    onFailure: (failure): WorkspaceMsg => ({
      _tag: "LoadFailed",
      revision,
      failure,
    }),
  });
export const loadGuidance = (user: number) =>
  command(guidanceDriver, user, {
    key: "guidance",
    concurrency: "switch",
    onSuccess: (result): WorkspaceMsg => ({ _tag: "GuidanceLoaded", result }),
    onFailure: (failure): WorkspaceMsg => ({ _tag: "GuidanceFailed", failure }),
  });
export const locateWorkspace = () =>
  address((value): WorkspaceMsg => ({ _tag: "Address", value }));
const canManage = (s: WorkspaceState, p: WorkspaceProps, id: number) =>
  Boolean(
    s.current?.teams.some(
      (t) =>
        t.id === id &&
        (p.session?.organizer || t.primary === p.session?.user_id),
    ),
  );
const initialFilters = (
  state: WorkspaceState,
  schedule: Schedule,
  p: WorkspaceProps,
): WorkspaceState => {
  const season =
    state.season ||
    schedule.seasons.find((v) => v.status === "active")?.id ||
    schedule.seasons[0]?.id ||
    0;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: schedule.gym.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(schedule.now);
  const s = { ...state, current: schedule, season };
  const selectedTeam = schedule.teams.some(
    (t) =>
      t.id === s.selectedTeam &&
      canManage(s, p, t.id) &&
      t.seasons.includes(season),
  )
    ? s.selectedTeam
    : (schedule.teams.find(
        (t) => canManage(s, p, t.id) && t.seasons.includes(season),
      )?.id ?? 0);
  return {
    ...s,
    selectedTeam,
    ...(!state.week
      ? {
          week: monday(today),
          day: today,
          finderEnd: shiftDate(today, 6),
          teamFilter: p.session?.organizer ? 0 : -1,
        }
      : {}),
  };
};
const toggleSlot = (s: WorkspaceState, id: number): WorkspaceState => {
  const slot = s.current?.slots.find((x) => x.id === id);
  if (!slot) return s;
  return {
    ...s,
    excluded: [],
    selected: s.selected.includes(id)
      ? s.selected.filter((x) => x !== id)
      : [
          ...s.selected.filter(
            (other) =>
              !s.current?.slots.some(
                (x) => x.id === other && slotsConflict(slot, x),
              ),
          ),
          id,
        ],
  };
};
const save = (
  s: WorkspaceState,
  p: WorkspaceProps,
): Next<WorkspaceState, WorkspaceMsg> =>
  !s.pending || !p.session || s.operation !== "Idle"
    ? s
    : [
        {
          ...s,
          operation: "Saving",
          revision: s.revision + 1,
          failure: undefined,
          message: "",
          dialog: "None",
        },
        [
          command(
            saveDriver,
            { action: s.pending, key: s.retryKey, csrf: p.session.csrf_token },
            {
              key: "save",
              concurrency: "exhaust",
              onSuccess: (result): WorkspaceMsg => ({ _tag: "Saved", result }),
              onFailure: failure,
            },
          ),
        ],
      ];
const start = (
  s: WorkspaceState,
  action: ScheduleAction,
  confirmation: string,
  preview: boolean,
  formKey: string,
  p: WorkspaceProps,
): Next<WorkspaceState, WorkspaceMsg> => {
  if (s.operation !== "Idle") return s;
  const next: WorkspaceState = {
    ...s,
    pending: action,
    confirmation,
    previewValue: undefined,
    retryKey: "",
    failure: undefined,
    errorForm: formKey,
    reviewOrigin: s.dialog === "Selection",
    dialog: confirmation && !preview ? "Confirm" : "None",
  };
  if (preview)
    return [
      { ...next, operation: "Previewing" },
      [
        command(previewDriver, action, {
          key: "preview",
          concurrency: "exhaust",
          onSuccess: (result): WorkspaceMsg => ({ _tag: "Previewed", result }),
          onFailure: failure,
        }),
      ],
    ];
  return confirmation ? next : save(next, p);
};
const savedMessage = (action: ScheduleAction | undefined) => {
  switch (action?.operation) {
    case "submit_requests":
    case "change_booking":
      return "Request sent · awaiting organizer approval.";
    case "decide_requests":
      return "Request decisions saved.";
    case "book_directly":
      return "Gym time assigned · coaches notified.";
    case "cancel_booking":
      return "Booking cancelled · released time is available.";
    case "propose_swap":
      return "Swap proposed · waiting for the other coach.";
    case "respond_swap":
      return action.accept
        ? "Swap accepted · both schedules updated."
        : "Swap declined · original bookings kept.";
    // Setup and administrative actions share one completion message.
    default:
      return "Schedule updated.";
  }
};
export const workspaceUpdate: Update<
  WorkspaceState,
  WorkspaceMsg,
  WorkspaceProps
> = {
  PropsChanged: (s, m) =>
    m.props.session?.user_id === m.prev.session?.user_id
      ? s
      : [
          workspaceInitial,
          m.props.session
            ? [
                loadWorkspace(0),
                loadGuidance(m.props.session.user_id),
                locateWorkspace(),
              ]
            : [],
        ],
  Refresh: (s) =>
    s.operation !== "Idle"
      ? s
      : [
          { ...s, loadStatus: "Loading", revision: s.revision + 1 },
          [loadWorkspace(s.revision + 1)],
        ],
  Loaded: (s, m, { props: p }) =>
    m.revision !== s.revision
      ? s
      : Either.isLeft(m.result)
        ? { ...s, loadStatus: "Ready", failure: m.result.left }
        : { ...initialFilters(s, m.result.right, p), loadStatus: "Ready" },
  Address: (s, m) => ({ ...s, pageAddress: m.value }),
  GuidanceLoaded: (s, m) => ({
    ...s,
    guidanceStatus: "Ready",
    helpPreferences: Either.isRight(m.result)
      ? m.result.right
      : initialGuidance,
    helpWarning: Either.isLeft(m.result) ? m.result.left.message : "",
  }),
  GuidanceSaved: (s, m) => ({
    ...s,
    helpWarning: Either.isLeft(m.result) ? m.result.left.message : "",
  }),
  HelpOpen: (s) => ({ ...s, tab: "help" }),
  HelpGo: (s, m) => {
    const destination: HelpDestination = m.destination;
    if (
      ["gym-setup", "seasons", "team-setup", "closures", "slots"].includes(
        destination,
      )
    )
      return { ...s, tab: "setup", setupSection: destination };
    const tab =
      destination === "sharing"
        ? "sharing"
        : destination === "requests"
          ? "requests"
          : destination === "swaps"
            ? "swaps"
            : destination === "inbox"
              ? "inbox"
              : destination === "finder"
                ? "finder"
                : "calendar";
    return {
      ...s,
      tab,
      walkthrough: destination === "finder" ? 0 : s.walkthrough,
    };
  },
  HelpPreferences: (s, m, { props: p }) => [
    { ...s, helpPreferences: m.value },
    p.session
      ? [
          command(
            guidanceSaveDriver,
            { user: p.session.user_id, value: m.value },
            {
              key: "guidance-save",
              concurrency: "queue",
              onSuccess: (result): WorkspaceMsg => ({
                _tag: "GuidanceSaved",
                result,
              }),
              onFailure: (failure): WorkspaceMsg => ({
                _tag: "GuidanceFailed",
                failure,
              }),
            },
          ),
        ]
      : [],
  ],
  LoadFailed: (s, m) =>
    m.revision !== s.revision
      ? s
      : { ...s, loadStatus: "Ready", failure: m.failure },
  GuidanceFailed: (s, m) => ({
    ...s,
    guidanceStatus: "Ready",
    helpWarning: m.failure.message,
  }),
  Failure: (s, m) => ({
    ...s,
    operation: "Idle",
    loadStatus: "Ready",
    failure: m.failure,
  }),
  Action: (s, m, { props: p }) =>
    start(s, m.action, m.confirmation, m.preview, m.formKey, p),
  Confirm: (s, _m, { props: p }) =>
    s.previewValue?.occurrences.some((o) => o.error) ||
    (s.pending?.operation === "create_slots" &&
      s.previewValue?.occurrences.length === 0)
      ? s
      : save(s, p),
  RetryAction: (s, _m, { props: p }) => save(s, p),
  Dismiss: (s) => ({
    ...s,
    dialog: s.reviewOrigin ? "Selection" : "None",
    reviewOrigin: false,
    pending: undefined,
    previewValue: undefined,
    confirmation: "",
  }),
  Previewed: (s, m) =>
    Either.isLeft(m.result)
      ? { ...s, operation: "Idle", failure: m.result.left }
      : {
          ...s,
          operation: "Idle",
          previewValue: m.result.right,
          dialog: "Confirm",
        },
  Saved: (s, m, { props: p }) => {
    if (Either.isLeft(m.result))
      return { ...s, operation: "Idle", failure: m.result.left };
    const prepared = m.result.right;
    if (Either.isLeft(prepared.result))
      return {
        ...s,
        operation: "Idle",
        retryKey: prepared.key,
        failure: prepared.result.left,
      };
    const result = prepared.result.right;
    const season =
      s.pending?.operation === "create_season"
        ? (result.outcome.resources.find((x) => x.kind === "season")?.id ??
          s.season)
        : s.season;
    const next = initialFilters({ ...s, season }, result.schedule, p);
    return {
      ...next,
      loadStatus: "Ready",
      operation: "Idle",
      message: result.outcome.warnings.includes("coach_overlap")
        ? "Saved. This primary coach has overlapping team bookings in different gym spaces."
        : result.outcome.warnings.includes("some_dates_unavailable")
          ? "Saved. Some requested dates were cancelled because another approved booking uses that space and time."
          : savedMessage(s.pending),
      selected: [],
      excluded: [],
      decisions: [],
      edit: undefined,
      selectionOpen: false,
      selectionDraft: emptyDraft,
      reviewOrigin: false,
      activeBooking: 0,
      pending: undefined,
      retryKey: "",
      dialog: "None",
      failure: undefined,
      errorForm: "",
    };
  },
  Tab: (s, m, { props: p }) =>
    (m.tab === "setup" || m.tab === "people") && !p.session?.organizer
      ? s
      : { ...s, tab: m.tab },
  Setup: (s, m, { props: p }) =>
    !p.session?.organizer ? s : { ...s, setupSection: m.section, tab: "setup" },
  TextFilter: (s, m) => ({
    ...s,
    [m.field]: m.value,
    ...(m.field.startsWith("history")
      ? {
          historyPage: 0,
          ...(m.field === "historyKind" ? { historyStatus: "all" } : {}),
        }
      : {}),
  }),
  NumberFilter: (s, m) => ({ ...s, [m.field]: m.value }),
  CalendarDate: (s, m) => ({ ...s, day: m.date, week: monday(m.date) }),
  FinderDate: (s, m) => ({
    ...s,
    day: m.date,
    finderEnd: s.finderEnd < m.date ? shiftDate(m.date, 6) : s.finderEnd,
  }),
  Walkthrough: (s, m) => ({
    ...s,
    walkthrough: Math.max(-1, Math.min(2, m.step)),
  }),
  Booking: (s, m) => ({ ...s, activeBooking: m.id, dialog: "Booking" }),
  Slot: (s, m) => ({ ...s, activeSlot: m.id, dialog: "Slot" }),
  Time: (s, m) => {
    const slot = s.current?.slots.find((x) => x.id === m.id);
    return !slot
      ? s
      : {
          ...toggleSlot(s, m.id),
          day: slot.date,
          finderEnd: slot.date,
          spaceFilter: slot.space,
          tab: "finder",
        };
  },
  Day: (s, m) => ({ ...s, day: m.date }),
  Shift: (s, m) => {
    const day = shiftDate(s.day || s.week, m.days);
    return { ...s, day, week: monday(day) };
  },
  Today: (s) => {
    if (!s.current) return s;
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: s.current.gym.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(s.current.now);
    return { ...s, day, week: monday(day) };
  },
  CloseDialog: (s, m) => (s.dialog === m.dialog ? { ...s, dialog: "None" } : s),
  Closed: (s, m) =>
    s.dialog !== m.dialog
      ? s
      : m.dialog === "Confirm"
        ? {
            ...s,
            dialog: s.reviewOrigin ? "Selection" : "None",
            reviewOrigin: false,
            pending: undefined,
            confirmation: "",
            previewValue: undefined,
          }
        : { ...s, dialog: "None" },
  Selection: (s) => ({ ...s, selectionOpen: true, dialog: "Selection" }),
  ClearSelection: (s) => ({
    ...s,
    selected: [],
    excluded: [],
    edit: undefined,
    selectionDraft: emptyDraft,
  }),
  ToggleSlot: (s, m) => (s.operation !== "Idle" ? s : toggleSlot(s, m.id)),
  Weekly: (s, m) => {
    if (!s.current || !s.selected.length) return s;
    const pattern = weeklyPatterns(s.current, s.selected, m.until);
    return { ...s, selected: pattern.slots, excluded: pattern.excluded };
  },
  Draft: (s, m) => ({ ...s, selectionDraft: m.value }),
  ChangeBooking: (s, m, { props: p }) => {
    const edit = s.current?.bookings.find((x) => x.id === m.id);
    if (!edit || !canManage(s, p, edit.team)) return s;
    const slot = s.current?.slots.find((x) => x.id === edit.slot);
    return {
      ...s,
      edit,
      selectionDraft: {
        note: edit.note,
        activity: edit.activity,
        reason: "",
        scope: "one",
      },
      selected: [],
      tab: "finder",
      selectedTeam: edit.team,
      dialog: "None",
      ...(slot
        ? {
            day: slot.date,
            week: monday(slot.date),
            finderEnd: shiftDate(slot.date, 6),
            season: slot.season,
          }
        : {}),
      message:
        "Choose replacement slots below, then submit the change. The original booking stays confirmed until approval.",
    };
  },
  Editor: (s, m) => ({
    ...s,
    openedBookingForms: [...new Set([...s.openedBookingForms, m.key])],
  }),
  EditDate: (s, m) => ({
    ...s,
    editDates: { ...s.editDates, [m.record]: m.date },
  }),
  RequestHistory: (s) => ({
    ...s,
    tab: "history",
    historyKind: "requests",
    historyPage: 0,
  }),
  Competing: (s) => ({ ...s, competingOnly: !s.competingOnly }),
  ClearRequestFilters: (s) => ({
    ...s,
    requestTeam: 0,
    requestType: "all",
    requestDate: "",
    competingOnly: false,
  }),
  Decide: (s, m, { props: p }) =>
    !s.current || !p.session?.organizer
      ? s
      : start(
          s,
          {
            operation: "decide_requests",
            decisions: s.current.requests
              .filter((r) => m.ids.includes(r.id))
              .map((r) => ({
                id: r.id,
                approve: m.approve,
                version: r.version,
              })),
          },
          `${m.approve ? "Approve" : "Decline"} ${m.ids.length} requested date(s)? Each date is checked again for conflicts. Approving a request cancels pending requests that use the same gym space and time.`,
          false,
          "",
          p,
        ),
  SelectGroup: (s, m) => {
    const group = s.current
      ? reviewGroups(
          s.current,
          s.current.requests.filter((r) => r.status === "pending"),
        ).find((g) => g.key === m.key)
      : undefined;
    return !group || group.competing
      ? s
      : {
          ...s,
          decisions: [
            ...new Set([...s.decisions, ...group.requests.map((r) => r.id)]),
          ],
        };
  },
  ToggleDecision: (s, m) => ({
    ...s,
    decisions: s.decisions.includes(m.id)
      ? s.decisions.filter((id) => id !== m.id)
      : [...s.decisions, m.id],
  }),
  HistoryPage: (s, m) => ({ ...s, historyPage: Math.max(0, m.page) }),
  SwapHistory: (s) => ({ ...s, swapHistory: !s.swapHistory }),
  Season: (s, m, { props: p }) => {
    const first = s.current?.slots.find((x) => x.season === m.season);
    return {
      ...s,
      season: m.season,
      selectedTeam:
        s.current?.teams.find(
          (t) => canManage(s, p, t.id) && t.seasons.includes(m.season),
        )?.id ?? 0,
      teamFilter: p.session?.organizer ? 0 : -1,
      ...(first
        ? {
            day: first.date,
            week: monday(first.date),
            finderEnd: shiftDate(first.date, 6),
          }
        : {}),
      selected: [],
      excluded: [],
      edit: undefined,
      selectionDraft: emptyDraft,
      historyPage: 0,
    };
  },
  ViewRequests: (s) => ({ ...s, requestTeam: s.selectedTeam, tab: "requests" }),
};
