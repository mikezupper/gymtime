import { html, nothing, type ChildValue } from "@gyral/core";
import { shortTeam } from "../../domain/schedule-views.js";
import { type Schedule } from "../../domain/schedule.js";
import { manageable, mine } from "./helpers.js";
import { workspaceIntents as i } from "./intents.js";
import type { WorkspaceView } from "./model.js";
export const guide = (
  v: WorkspaceView,
  s: Schedule,
  compact = false,
): ChildValue => {
  return html`<gymtime-guide
    .schedule=${s}
    .session=${v.session}
    .season=${v.season}
    .preferences=${v.helpPreferences}
    .compact=${compact}
    data-intent=${i.Guide}
  ></gymtime-guide>`;
};
export const calendar = (v: WorkspaceView, s: Schedule): ChildValue => {
  return html`<section aria-labelledby="calendar-title">
    <div class="section-heading">
      <div>
        <div class="section-heading">
          <h2 id="calendar-title">
            ${v.teamFilter === -1 ? "My teams" : "Gym calendar"}
          </h2>
          <gymtime-help-tip topic="calendar"></gymtime-help-tip>
        </div>
        <p class="muted">
          ${s.seasons.find((season) => season.id === v.season)?.name}
        </p>
      </div>
      <div class="actions">
        ${s.seasons.some(
          (season) => season.id === v.season && season.status === "active",
        ) &&
        s.teams.some(
          (team) => manageable(v, team.id) && team.seasons.includes(v.season),
        )
          ? html`<button class="primary" data-intent=${i.Tab} value="finder">
              ${v.session?.organizer ? "Assign time" : "Find time"}
            </button>`
          : nothing}${v.session?.organizer
          ? html`<button data-intent=${i.Setup} value="slots">
                Publish time</button
              ><button data-intent=${i.Setup} value="closures">
                Block gym
              </button>`
          : nothing}
      </div>
    </div>
    <div class="toolbar calendar-filters">
      <label
        >View teams<select
          value=${String(v.teamFilter)}
          data-intent=${i.NumberFilter}
          data-field="teamFilter"
        >
          ${!v.session?.organizer
            ? html`<option value="-1" ?selected=${v.teamFilter === -1}>
                My teams
              </option>`
            : nothing}
          <option value="0" ?selected=${v.teamFilter === 0}>All gym</option>
          ${s.teams
            .filter((team) => team.seasons.includes(v.season))
            .map(
              (team) =>
                html`<option
                  value=${team.id}
                  ?selected=${v.teamFilter === team.id}
                >
                  ${shortTeam(team.name)}
                </option>`,
            )}
        </select></label
      ><label
        >Week containing<input
          type="date"
          value=${v.day || v.week}
          data-intent=${i.CalendarDate} /></label
      ><button
        ?disabled=${v.loadStatus === "Loading" || v.busy}
        data-intent=${i.Refresh}
      >
        Refresh schedule
      </button>
    </div>
    <gymtime-calendar
      .schedule=${s}
      .season=${v.season}
      .week=${v.week}
      .day=${v.day}
      .teams=${v.teamFilter === -1 ? mine(v, s) : [v.teamFilter]}
      .allTeams=${v.teamFilter === 0}
      .canSelect=${s.teams.some((team) => manageable(v, team.id))}
      .busy=${v.busy}
      data-intent=${i.Calendar}
    ></gymtime-calendar>
  </section>`;
};
