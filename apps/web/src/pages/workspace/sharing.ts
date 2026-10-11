import { html, nothing, type ChildValue } from "@gyral/core";
import { type Schedule } from "../../domain/schedule.js";
import { manageable } from "./helpers.js";
import { workspaceIntents as i } from "./intents.js";
import type { WorkspaceView } from "./model.js";
export const sharing = (v: WorkspaceView, s: Schedule): ChildValue => {
  return html`<section aria-labelledby="sharing-title">
    <div class="section-heading">
      <h2 id="sharing-title">Team calendars for parents</h2>
      <gymtime-help-tip topic="sharing"></gymtime-help-tip>
    </div>
    <details>
      <summary>Message to share with parents</summary>
      <p>
        Here is our team calendar. No account is needed. Open the team webpage
        to see confirmed games and practices. Subscribe to the calendar to
        follow future changes; downloading the file gives you a snapshot. The
        team page has instructions for Apple, Google, and other calendar apps.
      </p>
    </details>
    <p class="muted">
      Anyone with a team link can view its confirmed schedule. Links are
      excluded from search. Internal notes and pending requests stay in the
      coach workspace. Calendar subscriptions refresh on the calendar app's
      schedule.
    </p>
    <div class="cards">
      ${s.teams
        .filter((t) => Boolean(t.share_token))
        .map(
          (t) =>
            html`<article class="card">
              <h3>${t.name}</h3>
              <a
                href=${`/teams/${t.share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                >Open ${t.name} parent calendar</a
              ><label
                >Shareable webpage link<input
                  readonly
                  value=${`${v.pageAddress.origin}/teams/${t.share_token}`} /></label
              ><label
                >Subscription URL<input
                  readonly
                  value=${`webcal://${v.pageAddress.host}/calendars/${t.share_token}.ics`} /></label
              ><a href=${`/calendars/${t.share_token}.ics`} download
                >Download calendar file</a
              >${manageable(v, t.id)
                ? html`<button
                    ?disabled=${v.busy}
                    data-intent=${i.RotateLink}
                    value=${t.id}
                  >
                    Replace sharing link
                  </button>`
                : nothing}
            </article>`,
        )}
    </div>
  </section>`;
};
