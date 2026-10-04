import { Data, Schema } from "effect";
import type { Schedule } from "./schedule.js";

export const GuidancePreferences = Schema.Struct({
  intro_hidden: Schema.Boolean,
  closures_reviewed: Schema.Array(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
  ),
  shared_seasons: Schema.Array(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
  ),
});
export type GuidancePreferences = typeof GuidancePreferences.Type;
export const initialGuidance: GuidancePreferences = {
  intro_hidden: false,
  closures_reviewed: [],
  shared_seasons: [],
};
export class GuidanceFailure extends Data.TaggedError("GuidanceFailure")<{
  readonly message: string;
}> {}
export type HelpDestination =
  | "gym-setup"
  | "seasons"
  | "team-setup"
  | "closures"
  | "slots"
  | "sharing"
  | "finder"
  | "calendar"
  | "requests"
  | "swaps"
  | "inbox";
export type SetupStep = {
  readonly title: string;
  readonly text: string;
  readonly complete: boolean;
  readonly destination: HelpDestination;
};
export const setupSteps = (
  s: Schedule,
  seasonId: number,
  preferences: GuidancePreferences,
): ReadonlyArray<SetupStep> => {
  const season = s.seasons.find((value) => value.id === seasonId);
  const teams = s.teams.filter((team) => team.seasons.includes(seasonId));
  const date = (instant: number) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: s.gym.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  const closure =
    season &&
    s.closures.some(
      (value) =>
        value.active &&
        date(value.starts_at) <= season.end_date &&
        date(value.ends_at - 1) >= season.start_date,
    );
  return [
    {
      title: "Define your gym",
      text: "Save the gym name, timezone, opening hours, and full or divided spaces.",
      complete: s.gym.version > 1 && s.gym.hours.length > 0,
      destination: "gym-setup",
    },
    {
      title: "Create a season",
      text: "Set the season dates. A draft gives you time to prepare before coaches can request slots.",
      complete: Boolean(season),
      destination: "seasons",
    },
    {
      title: "Add teams and coaches",
      text: "Assign a primary coach to each team. New coaches receive an invitation when you add them.",
      complete: teams.length > 0,
      destination: "team-setup",
    },
    {
      title: "Review unavailable time",
      text: "Add holidays, school events, and maintenance, or confirm that there are no closures to add.",
      complete:
        Boolean(closure) || preferences.closures_reviewed.includes(seasonId),
      destination: "closures",
    },
    {
      title: "Publish available slots",
      text: "Create the dates, times, and spaces coaches can request. Opening hours alone do not create slots.",
      complete: s.slots.some(
        (slot) => slot.season === seasonId && slot.enabled,
      ),
      destination: "slots",
    },
    {
      title: "Review and activate",
      text: "Check your settings, teams, and dates, then activate the season to open booking requests. Only one season can be active.",
      complete: season?.status === "active" || season?.status === "closed",
      destination: "seasons",
    },
    {
      title: "Share team schedules",
      text: "Send parents their team's webpage and subscription link. The calendar stays empty until bookings are confirmed.",
      complete: preferences.shared_seasons.includes(seasonId),
      destination: "sharing",
    },
  ];
};

export const helpTopics = {
  calendar: {
    title: "Reading the calendar",
    text: "Available means you can request a published slot. Pending means a coach has requested it; approval is still needed. Confirmed means a team has the time. Unavailable means the space is closed or occupied. Full gym uses both halves; Half A and Half B can be booked separately.",
  },
  finder: {
    title: "Choosing gym time",
    text: "Choose the team first, then select published times. A pending request does not reserve a slot. If you compete with a pending request, explain why you need the time. Your request becomes a booking only after organizer approval.",
  },
  notes: {
    title: "Who can see notes?",
    text: "Only organizers and coaches can see internal notes and competing-request reasons. Parents see their team's confirmed dates, times, activity, and gym space.",
  },
  recurring: {
    title: "Repeating and changing dates",
    text: "Repeat weekly finds published slots matching each selected weekday, time, and space. Review excluded dates before sending. For a recurring booking, This date changes one occurrence; future dates start with that occurrence; all remaining dates include every uncompleted occurrence in the series.",
  },
  requests: {
    title: "How approval works",
    text: "Approving a request cancels pending requests that conflict with its space and time. A Full gym approval conflicts with both halves. Approving Half A leaves a compatible Half B request pending. Organizers can approve some dates and decline others in a recurring request.",
  },
  changes: {
    title: "Changes, cancellations, and swaps",
    text: "A requested change keeps your original time confirmed until approval. Cancellation releases the time immediately. A swap keeps both bookings unchanged until the other primary coach accepts; both times then change together and the organizer is notified.",
  },
  hours: {
    title: "Hours and slots",
    text: "Opening hours set the gym's limits. Publish time slots within those hours to give coaches times they can request. Changing hours or timezone affects new slots; existing bookings keep their saved times.",
  },
  seasons: {
    title: "Draft, active, and closed seasons",
    text: "Prepare future seasons as drafts. Activate a season when coaches can request its slots; only one can be active. A closed season remains in history and cannot receive scheduling changes.",
  },
  people: {
    title: "Coach and organizer permissions",
    text: "A primary coach requests and changes time for their team. Assistants view schedules and receive the same team notifications. One person may coach several teams. All organizers have the same scheduling permissions.",
  },
  closures: {
    title: "Blocking gym time",
    text: "A closure cancels affected bookings and pending requests, blocks the chosen space, and notifies affected coaches. Review the affected dates before confirming. Reopening time does not restore cancelled bookings.",
  },
  sharing: {
    title: "Sharing with parents",
    text: "Send each team its webpage and calendar subscription link. Anyone with the link can view that team's confirmed schedule without signing in. Replacing a link stops the old webpage and feed; parents need the new link and must subscribe again.",
  },
  notices: {
    title: "Updates and delivery",
    text: "Primary and assistant coaches receive the same team updates. Related dates from one action are grouped into a message. Notifications show email delivery status; organizers can retry failed delivery after fixing the email service.",
  },
  history: {
    title: "Finding past decisions",
    text: "History keeps completed requests and bookings, including cancellations and recurring requests with mixed decisions. Use the date and status filters to find an outcome; Calendar shows the current schedule.",
  },
} as const;
export type HelpTopic = keyof typeof helpTopics;
