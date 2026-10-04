import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Session } from "../domain/api.js";
import type { Schedule } from "../domain/schedule.js";
import {
  initialGuidance,
  setupSteps,
  helpTopics,
  type GuidancePreferences,
  type HelpDestination,
} from "../domain/guidance.js";
import { plannerStyles } from "./planner-styles.js";
@customElement("gymtime-guide")
export class GymtimeGuide extends LitElement {
  @property({ attribute: false }) schedule?: Schedule;
  @property({ attribute: false }) session?: Session;
  @property({ attribute: false }) preferences: GuidancePreferences =
    initialGuidance;
  @property({ type: Number }) season = 0;
  @property({ type: Boolean }) compact = false;
  static override styles = plannerStyles;
  private go(destination: HelpDestination) {
    this.dispatchEvent(
      new CustomEvent("help-go", {
        detail: destination,
        bubbles: true,
        composed: true,
      }),
    );
  }
  private change(value: GuidancePreferences) {
    this.dispatchEvent(
      new CustomEvent("help-preferences", {
        detail: value,
        bubbles: true,
        composed: true,
      }),
    );
  }
  override render() {
    const s = this.schedule;
    const session = this.session;
    if (!s || !session) return nothing;
    const teams = s.teams.filter(
      (team) =>
        team.seasons.includes(this.season) &&
        (team.primary === session.user_id ||
          team.assistants.includes(session.user_id)),
    );
    const primary = teams.some((team) => team.primary === session.user_id);
    const season = s.seasons.find((season) => season.id === this.season);
    const seasonTeams = s.teams.filter((team) =>
      team.seasons.includes(this.season),
    );
    const steps = setupSteps(s, this.season, this.preferences);
    const done = steps.filter((step) => step.complete).length;
    const title = session.organizer
      ? "Set up your season"
      : "Getting started with your team";
    const next = steps.find((step) => !step.complete);
    if (this.compact)
      return html`<aside class="welcome-card" aria-labelledby="welcome-title">
        <div>
          <strong id="welcome-title">${title}</strong>
          <p class="small muted">
            ${session.organizer
              ? `${done} of ${steps.length} setup steps complete${next ? ` · Next: ${next.title}` : ""}`
              : "Learn to read the schedule and use your team's calendar."}
          </p>
        </div>
        <div class="actions">
          <button
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent("help-open", { bubbles: true, composed: true }),
              )}
          >
            ${session.organizer ? "Open setup guide" : "Open coach guide"}</button
          ><button
            aria-label="Dismiss getting started"
            @click=${() =>
              this.change({ ...this.preferences, intro_hidden: true })}
          >
            Dismiss
          </button>
        </div>
      </aside>`;
    return html`<section aria-labelledby="guide-title">
      <div class="section-heading">
        <div>
          <h2 id="guide-title">${title}</h2>
          <p class="muted">
            ${session.organizer
              ? "Prepare a season, then open it for coach requests. You can return to this guide anytime."
              : "Your organizer publishes available time. Your team calendar shows the bookings that have been confirmed."}
          </p>
        </div>
      </div>
      ${session.organizer
        ? html`<p class="small">
              ${s.seasons.find((season) => season.id === this.season)?.name ??
              "No season yet"}
              · ${done} of ${steps.length} setup steps complete
            </p>
            <progress
              aria-label="Season setup progress"
              value=${done}
              max=${steps.length}
            ></progress>
            <details>
              <summary>Review saved setup</summary>
              <div class="guide-content">
                <p>
                  <strong>Gym:</strong> ${s.gym.name} · ${s.gym.timezone} ·
                  ${s.gym.split ? "Full gym, Half A, and Half B" : "Full gym"} ·
                  ${s.gym.hours.length} open days per week.
                </p>
                <p>
                  <strong>Season:</strong> ${season
                    ? `${season.name} · ${season.start_date}–${season.end_date} · ${season.status}`
                    : "Create your first season."}
                </p>
                <p>
                  <strong>Teams:</strong> ${seasonTeams.length
                    ? seasonTeams.map((team) => team.name).join(", ")
                    : "No teams in this season yet."}
                </p>
                <p>
                  <strong>Published slots:</strong> ${s.slots.filter(
                    (slot) => slot.season === this.season && slot.enabled,
                  ).length}
                  dates and spaces. Review unavailable time before activating;
                  the closure step links to all saved closures.
                </p>
                <p class="small muted">
                  Setup progress is a reminder, not a guarantee that every team
                  or holiday has been included.
                </p>
              </div>
            </details>
            <ol class="setup-checklist">
              ${steps.map(
                (step) =>
                  html`<li class="guide-step">
                    <span class="badge"
                      >${step.complete ? "Complete" : "To do"}</span
                    >
                    <div>
                      <h3>${step.title}</h3>
                      <p>${step.text}</p>
                    </div>
                    <button @click=${() => this.go(step.destination)}>
                      ${step.complete ? "Review" : "Start"}: ${step.title}
                    </button>
                    ${step.destination === "closures" &&
                    this.season &&
                    !step.complete
                      ? html`<button
                          @click=${() =>
                            this.change({
                              ...this.preferences,
                              closures_reviewed: [
                                ...this.preferences.closures_reviewed,
                                this.season,
                              ],
                            })}
                        >
                          No closures to add
                        </button>`
                      : nothing}
                    ${step.destination === "sharing" &&
                    this.season &&
                    s.teams.some((team) =>
                      team.seasons.includes(this.season),
                    ) &&
                    !step.complete
                      ? html`<button
                          @click=${() =>
                            this.change({
                              ...this.preferences,
                              shared_seasons: [
                                ...this.preferences.shared_seasons,
                                this.season,
                              ],
                            })}
                        >
                          I've shared the team links
                        </button>`
                      : nothing}
                  </li>`,
              )}
            </ol>
            <p class="small muted">
              Progress follows saved gym and season data. “No closures to add”
              and “I've shared the team links” are reminders saved for your
              account in this browser. Completion is guidance; review each
              team's settings before activation.
            </p>`
        : html`<div class="info-box">
              <h3>Your team assignments</h3>
              ${teams.length
                ? html`<ul>
                    ${teams.map(
                      (team) =>
                        html`<li>
                          <strong>${team.name}</strong> ·
                          ${team.primary === session.user_id
                            ? "Primary coach: request and change time"
                            : "Assistant coach: view schedules and receive updates"}
                        </li>`,
                    )}
                  </ul>`
                : html`<p>
                    No team is assigned to you in this season. Ask the organizer
                    to check your team and season assignment.
                  </p>`}
            </div>
            <ol class="guide-instructions">
              <li>
                <strong>Read your schedule.</strong> My teams shows your
                assigned teams. All gym shows everyone. Open a booking for its
                full details.
              </li>
              <li>
                <strong>Choose the right team.</strong> Your permissions follow
                the team you select. Assistants can view schedules and receive
                updates; the primary coach makes changes.
              </li>
              ${primary
                ? html`<li>
                      <strong>Request published time.</strong> Open Find time,
                      choose your team and dates, then select available slots.
                      Repeat weekly finds matching slots; review excluded dates.
                    </li>
                    <li>
                      <strong>Review and send.</strong> Check the dates, space,
                      and activity. Notes stay internal. Competing requests need
                      a reason. A request awaits approval; it does not reserve
                      time.
                    </li>
                    <li>
                      <strong>Check decisions.</strong> Requests shows pending
                      work and completed decisions. Notifications contains your
                      team updates.
                    </li>
                    <li>
                      <strong>Change a confirmed booking.</strong> Open booking
                      details. A change needs approval, cancellation releases
                      time immediately, and a swap needs the other primary
                      coach's acceptance.
                    </li>`
                : nothing}
              <li>
                <strong>Share the team calendar.</strong> Parent links gives you
                the webpage and subscription URL. Parents do not need accounts.
              </li>
            </ol>
            ${!s.seasons.some(
              (season) =>
                season.id === this.season && season.status === "active",
            )
              ? html`<p class="info-box">
                  This season is not open for requests. The organizer must
                  activate it first.
                </p>`
              : !s.slots.some(
                    (slot) => slot.season === this.season && slot.enabled,
                  )
                ? html`<p class="info-box">
                    The organizer has not published time for this season yet.
                    Check back after availability is prepared.
                  </p>`
                : nothing}
            <div class="actions">
              <button @click=${() => this.go("calendar")}>Open calendar</button
              >${primary
                ? html`<button
                    ?disabled=${!s.seasons.some(
                      (season) =>
                        season.id === this.season && season.status === "active",
                    ) ||
                    !s.slots.some(
                      (slot) => slot.season === this.season && slot.enabled,
                    )}
                    @click=${() => this.go("finder")}
                  >
                    Show me how to request time
                  </button>`
                : nothing}<button @click=${() => this.go("sharing")}>
                Open parent links
              </button>
            </div>`}
      <h3>Quick answers</h3>
      <div class="help-answers">
        ${Object.entries(helpTopics)
          .filter(
            ([key]) =>
              session.organizer ||
              !["hours", "seasons", "people", "closures"].includes(key),
          )
          .map(
            ([, topic]) =>
              html`<details>
                <summary>${topic.title}</summary>
                <p>${topic.text}</p>
              </details>`,
          )}
      </div>
    </section>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "gymtime-guide": GymtimeGuide;
  }
}
