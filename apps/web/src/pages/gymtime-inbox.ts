import type { Notices } from "../domain/schedule.js";
import {
  each,
  type ChildValue,
  command,
  define,
  html,
  nothing,
  prop,
  type PropsOf,
} from "@gyral/core";
import { Either } from "effect";
import "../components/gymtime-help-tip.js";
import {
  emitSchedule,
  type ScheduleOutput,
} from "../components/planner-forms.js";
import { plannerStyles } from "../components/planner-styles.js";
import { sessionProp } from "../components/props.js";
import { ApiFailure } from "../domain/api.js";
import { instantLabel } from "../domain/schedule.js";
import {
  auditDriver,
  noticesDriver,
  type Result,
} from "../runtime/commands.js";
import { remoteView, type Remote } from "./remote-view.js";
const props = { session: sessionProp(), busy: prop.boolean() };
type Props = PropsOf<typeof props>;
interface State {
  readonly failedOnly: boolean;
  readonly page: number;
  readonly inbox: Remote<Result<"notices">>;
  readonly history: Remote<Result<"audit">>;
}
type Msg =
  | ScheduleOutput
  | { readonly _tag: "Refresh" }
  | { readonly _tag: "FailedOnly" }
  | { readonly _tag: "Page"; readonly page: number }
  | { readonly _tag: "Loaded"; readonly result: Result<"notices"> }
  | { readonly _tag: "AuditLoaded"; readonly result: Result<"audit"> }
  | { readonly _tag: "Failed"; readonly failure: ApiFailure }
  | { readonly _tag: "AuditFailed"; readonly failure: ApiFailure };
const load = (failedOnly: boolean) =>
  command(noticesDriver, failedOnly, {
    key: "notices",
    concurrency: "switch",
    onSuccess: (result): Msg => ({ _tag: "Loaded", result }),
    onFailure: (failure): Msg => ({ _tag: "Failed", failure }),
  });
const audit = () =>
  command(auditDriver, undefined, {
    key: "audit",
    concurrency: "switch",
    onSuccess: (result): Msg => ({ _tag: "AuditLoaded", result }),
    onFailure: (failure): Msg => ({ _tag: "AuditFailed", failure }),
  });
const notice = (s: State, id: string | undefined) =>
  s.inbox._tag === "Ready" && Either.isRight(s.inbox.value)
    ? s.inbox.value.right.find((n) => n.id === id)
    : undefined;
export const GymtimeInbox = define<State, Msg, Props, ScheduleOutput>()(
  "gymtime-inbox",
  {
    props,
    styles: plannerStyles,
    init: (p) => [
      {
        failedOnly: false,
        page: 0,
        inbox: { _tag: "Loading" },
        history: { _tag: p.session?.organizer ? "Loading" : "Idle" },
      },
      [load(false), ...(p.session?.organizer ? [audit()] : [])],
    ],
    intent: {
      Refresh: true,
      FailedOnly: true,
      Page: ({ value }) =>
        Number.isSafeInteger(Number(value))
          ? { _tag: "Page", page: Number(value) }
          : undefined,
      MarkRead: ({ value }, { state: s }) => {
        const n = notice(s, value);
        return !n
          ? undefined
          : {
              _tag: "ScheduleAction",
              action: { operation: "mark_notice_read", id: n.id },
            };
      },
      RetryEmail: ({ value }, { state: s }) => {
        const n = notice(s, value);
        return !n
          ? undefined
          : {
              _tag: "ScheduleAction",
              action: { operation: "retry_email", id: n.id },
              confirmation: `Retry this email to ${n.recipient}? It uses the original delivery key to avoid duplicate provider delivery.`,
            };
      },
    },
    update: {
      ScheduleAction: (s, m, { props: p }) =>
        p.busy ? s : [s, [emitSchedule(m)]],
      Refresh: (s) => [
        { ...s, inbox: { _tag: "Loading" } },
        [load(s.failedOnly)],
      ],
      FailedOnly: (s, _m, { props: p }) =>
        !p.session?.organizer
          ? s
          : [
              {
                ...s,
                failedOnly: !s.failedOnly,
                page: 0,
                inbox: { _tag: "Loading" },
              },
              [load(!s.failedOnly)],
            ],
      Page: (s, m) => ({ ...s, page: Math.max(0, m.page) }),
      Loaded: (s, m) => ({ ...s, inbox: { _tag: "Ready", value: m.result } }),
      AuditLoaded: (s, m) => ({
        ...s,
        history: { _tag: "Ready", value: m.result },
      }),
      Failed: (s, m) => ({
        ...s,
        inbox: { _tag: "Failed", failure: m.failure },
      }),
      AuditFailed: (s, m) => ({
        ...s,
        history: { _tag: "Failed", failure: m.failure },
      }),
      PropsChanged: (s, m) =>
        m.props.busy || m.props.busy === m.prev.busy
          ? s
          : [
              s,
              [
                load(s.failedOnly),
                ...(m.props.session?.organizer ? [audit()] : []),
              ],
            ],
    },
    view: (s, i, { props: p }) => {
      return html`<section aria-labelledby="inbox-title">
          <div class="section-heading">
            <h2 id="inbox-title">Notifications</h2>
            <gymtime-help-tip topic="notices"></gymtime-help-tip>
          </div>
          <p class="muted">
            Schedule messages appear here even if email delivery fails. Related
            dates from one action are grouped into one message.
          </p>
          <div class="actions">
            <button data-intent=${i.Refresh}>Refresh notifications</button>${p
              .session?.organizer
              ? html`<label class="check"
                  ><input
                    type="checkbox"
                    ?checked=${s.failedOnly}
                    data-intent=${i.FailedOnly}
                  />Show failed email deliveries for all accounts</label
                >`
              : nothing}
          </div>
          ${remoteView(s.inbox, {
            loading: () => html`<p role="status">Loading notifications…</p>`,
            ready: (r) =>
              Either.isLeft(r)
                ? html`<p role="alert">${r.left.message}</p>`
                : html`<ul class="plain-list">
                      ${each(
                        r.right.slice(s.page * 20, s.page * 20 + 20),
                        (n) => n.id,
                        noticeRow,
                        () => ({ s, session: p.session, busy: p.busy, i }),
                      )}
                    </ul>
                    <div class="actions">
                      <button
                        ?disabled=${s.page === 0}
                        data-intent=${i.Page}
                        value=${s.page - 1}
                      >
                        Previous messages</button
                      ><span
                        >Page ${s.page + 1} of
                        ${Math.max(1, Math.ceil(r.right.length / 20))}</span
                      ><button
                        ?disabled=${(s.page + 1) * 20 >= r.right.length}
                        data-intent=${i.Page}
                        value=${s.page + 1}
                      >
                        Next messages
                      </button>
                    </div>
                    ${!r.right.length
                      ? html`<p>
                          ${s.failedOnly
                            ? "No failed email deliveries."
                            : "No notifications yet."}
                        </p>`
                      : nothing}`,
            failed: () =>
              html`<p role="alert">Notifications could not be reached.</p>`,
          })}
        </section>
        ${p.session?.organizer
          ? html`<details>
              <summary>Recent activity</summary>
              <section aria-labelledby="audit-title">
                <h2 id="audit-title">Recent activity</h2>
                <p class="muted">
                  The most recent 200 sign-in, account, and scheduling actions.
                </p>
                ${remoteView(s.history, {
                  loading: () =>
                    html`<p role="status">Loading recent activity…</p>`,
                  ready: (r) =>
                    r && Either.isRight(r)
                      ? html`<ul class="plain-list">
                          ${r.right.map(
                            (a) =>
                              html`<li>
                                Account ${a.actor}:
                                ${a.action.replaceAll("_", " ")} ·
                                ${instantLabel(a.occurred_at, "UTC")} UTC
                              </li>`,
                          )}
                        </ul>`
                      : html`<p>Recent activity is unavailable.</p>`,
                  failed: () =>
                    html`<p role="alert">Recent activity is unavailable.</p>`,
                })}
              </section>
            </details>`
          : nothing}`;
    },
  },
);

const noticeRow = (
  n: (typeof Notices.Type)[number],
  {
    s,
    session,
    busy,
    i,
  }: {
    readonly s: State;
    readonly session: Props["session"];
    readonly busy: boolean;
    readonly i: { readonly MarkRead: string; readonly RetryEmail: string };
  },
): ChildValue =>
  html`<li class="card">
    <h3>${n.subject}</h3>
    <span class="badge"
      >${n.read ? "Read" : "Unread"} · Email ${n.delivery}</span
    ><time datetime=${new Date(n.created_at).toISOString()}
      >${instantLabel(n.created_at, "UTC")} UTC</time
    >${s.failedOnly ? html`<p>To: ${n.recipient}</p>` : nothing}
    <details>
      <summary>Read message</summary>
      <pre>${n.text}</pre>
    </details>
    <div class="actions">
      ${!n.read && n.user_id === session?.user_id
        ? html`<button
            ?disabled=${busy}
            data-intent=${i.MarkRead}
            value=${n.id}
          >
            Mark as read
          </button>`
        : nothing}${session?.organizer && n.delivery === "failed"
        ? html`<button
            ?disabled=${busy}
            data-intent=${i.RetryEmail}
            value=${n.id}
          >
            Retry email delivery
          </button>`
        : nothing}
    </div>
  </li>`;
