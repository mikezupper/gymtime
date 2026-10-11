import type { PublicCalendar } from "../domain/schedule.js";
import {
  each,
  type ChildValue,
  command,
  define,
  html,
  prop,
  type PropsOf,
} from "@gyral/core";
import { Either } from "effect";
import { parentGuide } from "../components/parent-guide.js";
import { plannerStyles } from "../components/planner-styles.js";
import { ApiFailure } from "../domain/api.js";
import { instantLabel, spaceLabel } from "../domain/schedule.js";
import { publicDriver, revalidate, type Result } from "../runtime/commands.js";
import { remoteView, type Remote } from "./remote-view.js";
const props = { token: prop.string({ default: "" }) };
type Props = PropsOf<typeof props>;
interface State {
  readonly date: string;
  readonly page: number;
  readonly calendar: Remote<Result<"publicCalendar">>;
}
type Msg =
  | { readonly _tag: "Refresh" }
  | { readonly _tag: "Date"; readonly date: string }
  | { readonly _tag: "Page"; readonly page: number }
  | { readonly _tag: "Loaded"; readonly result: Result<"publicCalendar"> }
  | { readonly _tag: "Failed"; readonly failure: ApiFailure };
const load = (token: string) =>
  command(publicDriver, token, {
    key: "public-calendar",
    concurrency: "switch",
    onSuccess: (result): Msg => ({ _tag: "Loaded", result }),
    onFailure: (failure): Msg => ({ _tag: "Failed", failure }),
  });
export const GymtimeTeamCalendar = define<State, Msg, Props>()(
  "gymtime-team-calendar",
  {
    props,
    styles: plannerStyles,
    init: (p) => [
      { date: "", page: 0, calendar: { _tag: "Loading" } },
      [load(p.token)],
    ],
    subscriptions: () => [revalidate<Msg>({ _tag: "Refresh" })],
    intent: {
      Refresh: true,
      Date: ({ value }) => ({ _tag: "Date", date: value ?? "" }),
      Page: ({ value }) =>
        Number.isSafeInteger(Number(value))
          ? { _tag: "Page", page: Number(value) }
          : undefined,
    },
    update: {
      Refresh: (s, _m, { props: p }) =>
        s.calendar._tag === "Loading"
          ? s
          : [{ ...s, calendar: { _tag: "Loading" } }, [load(p.token)]],
      Date: (s, m) => ({ ...s, date: m.date, page: 0 }),
      Page: (s, m) => ({ ...s, page: Math.max(0, m.page) }),
      Loaded: (s, m) => ({
        ...s,
        calendar: { _tag: "Ready", value: m.result },
      }),
      Failed: (s, m) => ({
        ...s,
        calendar: { _tag: "Failed", failure: m.failure },
      }),
      PropsChanged: (s, m) =>
        m.props.token === m.prev.token
          ? s
          : [
              { date: "", page: 0, calendar: { _tag: "Loading" } },
              [load(m.props.token)],
            ],
    },
    view: (s, i) => {
      return remoteView(s.calendar, {
        loading: () =>
          html`<h1>Team calendar</h1>
            <p role="status">Loading confirmed team times…</p>`,
        ready: (r) =>
          Either.isLeft(r)
            ? html`<h1>Team calendar unavailable</h1>
                <p>
                  ${r.left.code === "not_found"
                    ? "This link may have been replaced. Ask your team's coach for the current link."
                    : r.left.message}
                </p>
                <button data-intent=${i.Refresh}>Try again</button>`
            : html`<h1>${r.right.team}</h1>
                <section>
                  <h2>Confirmed team schedule</h2>
                  <p>${r.right.gym} · All times use ${r.right.timezone}.</p>
                  <div class="actions">
                    <a href=${r.right.subscription_url}
                      >Subscribe to team calendar</a
                    ><a href=${r.right.calendar_url} download
                      >Download calendar file</a
                    ><button data-intent=${i.Refresh}>
                      Refresh team schedule
                    </button>
                  </div>
                  ${parentGuide(r.right.calendar_url)}
                  <label
                    >Show from date<input
                      type="date"
                      value=${s.date}
                      data-intent=${i.Date}
                  /></label>
                  <ul class="plain-list">
                    ${each(
                      r.right.events
                        .filter(
                          (e) =>
                            !e.cancelled &&
                            (!s.date ||
                              new Intl.DateTimeFormat("en-CA", {
                                timeZone: r.right.timezone,
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              }).format(e.starts_at) >= s.date),
                        )
                        .slice(s.page * 20, s.page * 20 + 20),
                      (e) => e.uid,
                      publicEvent,
                      () => ({ r }),
                    )}
                  </ul>
                  <div class="actions">
                    <button
                      ?disabled=${s.page === 0}
                      data-intent=${i.Page}
                      value=${s.page - 1}
                    >
                      Previous events</button
                    ><span>Page ${s.page + 1}</span
                    ><button
                      ?disabled=${(s.page + 1) * 20 >=
                      r.right.events.filter(
                        (e) =>
                          !e.cancelled &&
                          (!s.date ||
                            new Intl.DateTimeFormat("en-CA", {
                              timeZone: r.right.timezone,
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            }).format(e.starts_at) >= s.date),
                      ).length}
                      data-intent=${i.Page}
                      value=${s.page + 1}
                    >
                      Next events
                    </button>
                  </div>
                  ${!r.right.events.some((e) => !e.cancelled)
                    ? html`<p>
                        No confirmed team times yet. Check again after the
                        organizer approves the schedule.
                      </p>`
                    : html``}
                </section>`,
        failed: () =>
          html`<h1>Team calendar</h1>
            <p role="alert">The service could not be reached.</p>
            <button data-intent=${i.Refresh}>Try again</button>`,
      });
    },
  },
);

const publicEvent = (
  e: (typeof PublicCalendar.Type.events)[number],
  { r }: { readonly r: { readonly right: typeof PublicCalendar.Type } },
): ChildValue =>
  html`<li class="card">
    <h3>${e.activity === "practice" ? "Practice" : "Game"}</h3>
    <time datetime=${new Date(e.starts_at).toISOString()}
      >${instantLabel(e.starts_at, r.right.timezone)}</time
    ><span
      >Ends ${instantLabel(e.ends_at, r.right.timezone)} ·
      ${spaceLabel(e.space)}</span
    >
  </li>`;
