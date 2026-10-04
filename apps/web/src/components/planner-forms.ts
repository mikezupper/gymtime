import "./gymtime-help-tip.js";
import { html } from "lit";
import type { ScheduleAction, Schedule, Slot } from "../domain/schedule.js";
import { dateLabel, spaceLabel } from "../domain/schedule.js";
export type ActionEvent = CustomEvent<{
  readonly action: ScheduleAction;
  readonly confirmation?: string;
  readonly preview?: boolean;
}>;
export const emitAction = (
  host: HTMLElement,
  action: ScheduleAction,
  options: { readonly confirmation?: string; readonly preview?: boolean } = {},
) =>
  host.dispatchEvent(
    new CustomEvent("schedule-action", {
      detail: { action, ...options },
      bubbles: true,
      composed: true,
    }),
  );
export const formValues = (event: SubmitEvent): FormData | undefined => {
  event.preventDefault();
  return event.currentTarget instanceof HTMLFormElement
    ? new FormData(event.currentTarget)
    : undefined;
};
export const text = (form: FormData, key: string): string =>
  String(form.get(key) ?? "");
export const number = (form: FormData, key: string): number =>
  Number(text(form, key));
export const activityField = (value = "practice") =>
  html`<label
    >Activity<select name="activity">
      <option value="practice" ?selected=${value === "practice"}>
        Practice
      </option>
      <option value="game" ?selected=${value === "game"}>Game</option>
    </select></label
  >`;
export const noteField = (value = "") =>
  html`<label
      >Internal note (optional)<textarea
        name="note"
        maxlength="2000"
        .value=${value}
      ></textarea>
    </label>
    <p class="small muted">Only organizers and coaches can see this note.</p>`;
export const spaceField = (split: boolean, value = "full") =>
  html`<label
    >Gym space<select name="space">
      <option value="full" ?selected=${value === "full"}>Full gym</option>
      ${split
        ? html`<option value="half_a" ?selected=${value === "half_a"}>
              Half A
            </option>
            <option value="half_b" ?selected=${value === "half_b"}>
              Half B
            </option>`
        : html``}
    </select></label
  >`;
export const scopeField = (series: string | null, value = "one") =>
  html`<label
      >Dates to change<select name="scope" .value=${value}>
        <option value="one">This date</option>
        ${series
          ? html`<option value="future">This date and future dates</option>
              <option value="remaining">All remaining dates</option>`
          : html``}
      </select></label
    ><gymtime-help-tip topic="recurring"></gymtime-help-tip>`;
export const slotLabel = (slot: Slot) =>
  `${dateLabel(slot.date)} · ${slot.start}–${slot.end} · ${spaceLabel(slot.space)}`;
export const teamField = (s: Schedule, eligible: (id: number) => boolean) =>
  html`<label
    >Team<select name="team" required>
      ${s.teams
        .filter((t) => eligible(t.id))
        .map((t) => html`<option value=${t.id}>${t.name}</option>`)}
    </select></label
  >`;
export const spaceInput = (f: FormData): "full" | "half_a" | "half_b" =>
  text(f, "space") === "half_a"
    ? "half_a"
    : text(f, "space") === "half_b"
      ? "half_b"
      : "full";
export const activityInput = (f: FormData): "game" | "practice" =>
  text(f, "activity") === "game" ? "game" : "practice";
export const scopeInput = (f: FormData): "one" | "future" | "remaining" =>
  text(f, "scope") === "future"
    ? "future"
    : text(f, "scope") === "remaining"
      ? "remaining"
      : "one";
