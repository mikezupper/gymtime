import { css } from "lit";
export const plannerStyles = css`
  :host {
    display: block;
    container-type: inline-size;
  }
  .welcome-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    margin-block: 1rem;
    border: 1px solid var(--border);
    border-inline-start: 3px solid var(--accent);
    border-radius: 0.65rem;
    background: var(--surface-raised);
  }
  .info-box {
    display: grid;
    gap: 0.65rem;
    padding: 1rem;
    background: var(--accent-subtle);
    border: 1px solid var(--border);
    border-radius: 0.65rem;
  }
  .setup-checklist {
    display: grid;
    gap: 0.75rem;
    padding: 0;
    list-style: none;
  }
  .guide-step {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.8rem;
    border: 1px solid var(--border);
    border-radius: 0.7rem;
    background: var(--surface-raised);
    padding: 1rem;
  }
  .guide-step button:not(:first-of-type) {
    grid-column: 2 / -1;
    justify-self: start;
  }
  .guide-step p {
    margin-block-start: 0.4rem;
  }
  .guide-instructions {
    display: grid;
    gap: 0.8rem;
    line-height: 1.6;
  }
  .help-answers,
  .guide-content {
    display: grid;
    gap: 0.75rem;
  }
  .guide-content {
    margin-block-start: 0.75rem;
  }
  progress {
    inline-size: 100%;
    max-inline-size: 28rem;
    accent-color: var(--accent);
  }
  @container (max-width:45rem) {
    .guide-step {
      grid-template-columns: minmax(0, 1fr);
    }
    .guide-step button:not(:first-of-type) {
      grid-column: auto;
    }
    .guide-step button {
      justify-self: start;
    }
  }
  * {
    box-sizing: border-box;
  }
  h1,
  h2,
  h3,
  p {
    margin: 0;
  }
  h2 {
    font-size: clamp(1.25rem, 2.5cqi, 1.6rem);
    letter-spacing: -0.03em;
  }
  h3 {
    font-size: 1.08rem;
  }
  p {
    line-height: 1.6;
    max-inline-size: 70ch;
  }
  section {
    display: grid;
    gap: 1rem;
    margin-block: 1.2rem;
  }
  label {
    display: grid;
    gap: 0.35rem;
    min-inline-size: 0;
  }
  input,
  select,
  textarea,
  button {
    font: inherit;
    color: var(--text);
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.65rem 0.8rem;
    min-block-size: 44px;
    max-inline-size: 100%;
  }
  input,
  select,
  textarea {
    inline-size: 100%;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  button.primary {
    background: var(--accent);
    color: var(--surface);
    font-weight: 650;
  }
  a {
    color: var(--accent);
    overflow-wrap: anywhere;
  }
  :focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }
  legend {
    font-weight: 650;
    margin-block-end: 0.6rem;
  }
  .field-error {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
  }
  [aria-invalid="true"] {
    border-color: var(--accent);
    outline: 1px solid var(--accent);
  }
  .fields {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(min(12rem, 100%), 1fr));
  }
  .actions,
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem;
  }
  form {
    display: grid;
    gap: 1rem;
  }
  .card {
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.8rem;
    background: var(--surface-raised);
    display: grid;
    align-content: start;
    gap: 0.8rem;
    min-inline-size: 0;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
    gap: 1rem;
  }
  .muted {
    color: var(--muted);
  }
  .badge {
    display: inline-block;
    padding: 0.15rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 2rem;
    font-size: 0.8rem;
    font-weight: 600;
    inline-size: fit-content;
  }
  .status {
    border-inline-start: 3px solid var(--accent);
    padding: 0.8rem 1rem;
    background: var(--surface-raised);
  }
  .error {
    border-inline-start: 3px solid var(--text);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-block-size: 44px;
  }
  input[type="checkbox"] {
    inline-size: 1.2rem;
    block-size: 1.2rem;
    min-block-size: 0;
    accent-color: var(--accent);
    flex-shrink: 0;
  }
  textarea {
    resize: vertical;
    min-block-size: 5rem;
  }
  @supports (field-sizing: content) {
    textarea {
      field-sizing: content;
      max-block-size: 20rem;
    }
  }
  details {
    border: 1px solid var(--border);
    padding: 0.7rem;
    border-radius: 0.7rem;
  }
  summary {
    cursor: pointer;
    min-block-size: 32px;
    font-weight: 650;
  }
  details[open] > form,
  .fields {
    margin-block-start: 1rem;
  }
  ul {
    padding-inline-start: 1.4rem;
  }
  .plain-list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }
  dialog {
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 1rem;
    padding: clamp(1.2rem, 4vw, 2rem);
    max-inline-size: min(38rem, calc(100% - 2rem));
    max-block-size: 85dvh;
    overflow: auto;
  }
  dialog::backdrop {
    background: oklch(10% 0 0 / 0.55);
  }
  dialog h2 {
    margin-block-end: 1rem;
  }
  dialog .actions {
    margin-block-start: 1.2rem;
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: inherit;
    line-height: 1.5;
  }
  .week {
    display: grid;
    gap: 0.8rem;
  }
  .day {
    display: grid;
    gap: 0.65rem;
    align-content: start;
    min-inline-size: 0;
  }
  .day > h3 {
    padding-block: 0.6rem;
    border-block-end: 2px solid var(--border);
  }
  .slot {
    padding: 0.85rem;
    gap: 0.5rem;
  }
  .slot[data-state="booked"] {
    border-inline-start: 3px solid var(--accent);
  }
  .slot[data-state="unavailable"] {
    background: var(--surface);
  }
  .slot:has(input:checked) {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    gap: 0.25rem;
    margin-block: 1rem;
    border-block-end: 1px solid var(--border);
    padding-block-end: 0.65rem;
  }
  nav button[aria-current="page"] {
    color: var(--surface);
    background: var(--accent);
  }
  .availability {
    font-size: 0.85rem;
  }
  @container (min-width:55rem) {
    .week {
      grid-template-columns: repeat(7, minmax(0, 1fr));
    }
    .slot {
      padding: 0.65rem;
    }
  }
  @media (forced-colors: active) {
    .slot:has(input:checked) {
      outline: 2px solid Highlight;
    }
  }

  h1 {
    font-size: clamp(1.5rem, 3cqi, 2rem);
    letter-spacing: -0.035em;
  }
  button:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accent-subtle);
  }
  button.primary:hover:not(:disabled) {
    background: var(--accent);
    filter: brightness(1.08);
  }
  .eyebrow {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .small,
  small {
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .section-heading,
  .workspace-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .workspace-heading > label {
    font-size: 0.8rem;
    max-inline-size: 23rem;
  }
  .workspace-heading {
    margin-block: 1rem;
  }
  nav button {
    border-color: transparent;
    background: transparent;
    padding-inline: 0.8rem;
  }
  nav button[aria-current="page"] {
    color: var(--accent);
    background: var(--accent-subtle);
  }
  nav details {
    padding: 0;
    border: 0;
    margin-inline-start: auto;
  }
  nav summary {
    min-block-size: 44px;
    padding: 0.65rem 0.8rem;
    font-weight: 500;
  }
  nav details[open] {
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
  }
  nav details .actions {
    padding: 0.5rem;
  }
  .calendar-filters {
    margin: 0;
    align-items: end;
  }
  .calendar-filters label {
    font-size: 0.8rem;
  }
  .finder-layout {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: minmax(0, 1fr) minmax(17rem, 21rem);
    align-items: start;
  }
  .desktop-selection {
    position: sticky;
    inset-block-start: 1rem;
    max-block-size: calc(100dvh - 2rem);
    overflow: auto;
    scrollbar-gutter: stable;
  }
  .finder-filters {
    margin: 0 0 1rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    font-size: 0.85rem;
  }
  .availability-list {
    margin-block: 1rem;
  }
  .availability-day {
    gap: 0.65rem;
    margin-block: 1rem;
    border-block-start: 1px solid var(--border);
    padding-block-start: 0.8rem;
  }
  .availability-day h3 {
    font-size: 0.95rem;
  }
  .time-choices {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(auto-fill, minmax(min(10rem, 100%), 1fr));
  }
  .time-choice {
    display: grid;
    gap: 0.2rem;
    text-align: start;
    padding: 0.75rem;
  }
  .time-choice span,
  .time-choice small {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .time-choice[aria-pressed="true"] {
    outline: 2px solid var(--accent);
    background: var(--accent-subtle);
  }
  .selection-card {
    gap: 0.75rem;
  }
  .selection-card fieldset {
    display: grid;
    gap: 0.8rem;
  }
  .selection-card ul {
    max-block-size: 16rem;
    overflow: auto;
  }
  .selection-card li {
    margin-block-end: 0.6rem;
    font-size: 0.85rem;
  }
  .selection-card li button {
    min-block-size: 32px;
    padding: 0.2rem 0.45rem;
  }
  .selection-card .fields {
    margin: 0;
  }
  .selection-bar {
    position: sticky;
    inset-block-end: 0.5rem;
    z-index: 2;
    margin-block: 1rem;
    padding: 0.75rem;
    border: 1px solid var(--accent);
    border-radius: 0.65rem;
    background: var(--surface-raised);
    box-shadow: 0 4px 20px oklch(0% 0 0 / 0.12);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .review-list,
  .history-list {
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow: clip;
  }
  .review-item {
    padding: 0;
    border: 0;
    border-radius: 0;
    border-block-end: 1px solid var(--border);
  }
  .review-item:last-child {
    border: 0;
  }
  .review-item > summary {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    list-style: none;
  }
  .review-item > summary::before {
    content: "›";
    font-size: 1.3rem;
    color: var(--muted);
  }
  .review-item[open] > summary::before {
    content: "⌄";
  }
  .review-item > summary > span:first-of-type {
    display: grid;
    gap: 0.3rem;
    flex: 1;
  }
  .review-item small,
  .history-row small {
    display: block;
    color: var(--muted);
    font-weight: 400;
  }
  .review-cta {
    font-size: 0.85rem;
    color: var(--accent);
  }
  .review-dates {
    padding: 0 1rem 1rem;
    display: grid;
    gap: 0.75rem;
  }
  .request-date {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
  }
  .request-date h3 {
    font-size: 0.95rem;
  }
  .request-date p {
    font-size: 0.9rem;
  }
  .request-date details {
    margin-block-start: 0.5rem;
  }
  .change-comparison {
    padding: 0.65rem;
    background: var(--accent-subtle);
    margin-block: 0.6rem;
  }
  .decision-bar {
    position: sticky;
    inset-block-start: 0.5rem;
    background: var(--surface-raised);
    padding: 0.8rem;
    border: 1px solid var(--accent);
    z-index: 1;
    border-radius: 0.5rem;
  }
  .history-row {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 0.85rem 1rem;
    border-block-end: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .history-row > span:first-child {
    flex: 1;
    min-inline-size: min(20rem, 100%);
  }
  .history-row > details[open] {
    flex-basis: 100%;
  }
  dialog {
    inline-size: 38rem;
  }
  #booking-dialog .card {
    border: 0;
    padding: 1rem 0;
  }
  .selected-dates,
  .repeat-weekly {
    background: var(--surface);
  }
  @container (min-width:55rem) {
    .review-dates {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .review-dates > .status {
      grid-column: 1 / -1;
    }
    .request-date {
      align-content: start;
    }
  }
  @container (max-width:45rem) {
    .workspace-heading {
      align-items: start;
    }
    .workspace-heading > label {
      inline-size: 100%;
      max-inline-size: none;
    }
    .finder-layout {
      grid-template-columns: minmax(0, 1fr);
      padding-block-end: 4rem;
    }
    .desktop-selection {
      display: none;
    }
    .selection-bar {
      font-size: 0.85rem;
      inset-block-end: 0.25rem;
    }
    .selection-bar button {
      padding: 0.4rem 0.65rem;
    }
    .selection-bar button:last-child {
      display: none;
    }
    .review-item > summary {
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.85rem;
    }
    .review-item > summary > span:first-of-type {
      flex-basis: 80%;
    }
    .review-cta {
      margin-inline-start: auto;
    }
    .history-row {
      gap: 0.5rem;
    }
    .history-row > span:first-child {
      flex-basis: 100%;
    }
    nav {
      gap: 0.1rem;
    }
    nav button {
      font-size: 0.85rem;
      padding: 0.5rem 0.6rem;
    }
    nav details {
      margin-inline-start: 0;
    }
    .section-heading .actions {
      gap: 0.35rem;
    }
    .section-heading .actions button {
      font-size: 0.85rem;
      padding: 0.5rem 0.65rem;
    }
    dialog {
      max-inline-size: calc(100% - 1rem);
      max-block-size: 90dvh;
      padding: 1rem;
    }
  }
`;
