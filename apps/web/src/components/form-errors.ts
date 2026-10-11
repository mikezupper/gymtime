import { defineHook } from "@gyral/core";
import type { Issue } from "./props.js";
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const control = (node: unknown): node is Control =>
  node instanceof HTMLInputElement ||
  node instanceof HTMLSelectElement ||
  node instanceof HTMLTextAreaElement;
interface Entry {
  readonly control: Control;
  readonly message: HTMLSpanElement;
  readonly previous: string | null;
}
interface Applied {
  issues: ReadonlyArray<Issue>;
  corrected: Set<Control>;
  entries: ReadonlyArray<Entry>;
  readonly input: (event: Event) => void;
}
const applied = new WeakMap<HTMLFormElement, Applied>();
let nextErrorId = 0;
const clearEntry = (entry: Entry) => {
  entry.control.setCustomValidity("");
  entry.control.removeAttribute("aria-invalid");
  if (entry.previous === null)
    entry.control.removeAttribute("aria-describedby");
  else entry.control.setAttribute("aria-describedby", entry.previous);
  entry.message.remove();
};
const clear = (value: Applied) => {
  value.entries.forEach(clearEntry);
  value.entries = [];
};
/** A form owns native errors and correction listeners. Gyral disposes the hook on removal. */
export const formErrors = defineHook<[issues: ReadonlyArray<Issue>]>({
  client: (element, [issues]) => {
    if (!(element instanceof HTMLFormElement)) return;
    let value = applied.get(element);
    if (!value) {
      const initial: Applied = {
        issues,
        corrected: new Set(),
        entries: [],
        input: (event) => {
          const field = event.composedPath().find(control);
          if (!field) return;
          initial.corrected.add(field);
          initial.entries
            .filter((e) => e.control === field)
            .forEach(clearEntry);
          initial.entries = initial.entries.filter((e) => e.control !== field);
        },
      };
      value = initial;
      applied.set(element, value);
      element.addEventListener("input", value.input);
    }
    if (value.issues !== issues) {
      value.corrected.clear();
      value.issues = issues;
    }
    clear(value);
    const aliases: Readonly<Record<string, ReadonlyArray<string>>> = {
      dates: ["start_date", "end_date"],
      date: ["date", "start_date", "end_date"],
      time: ["start", "end"],
      email: ["email", "primary"],
    };
    const grouped = new Map<Control, ReadonlyArray<string>>();
    for (const issue of issues)
      for (const name of aliases[issue.field] ?? [issue.field]) {
        const field = element.elements.namedItem(name);
        if (control(field) && !value.corrected.has(field))
          grouped.set(field, [
            ...new Set([...(grouped.get(field) ?? []), issue.message]),
          ]);
      }
    for (const [field, messages] of grouped) {
      const message = document.createElement("span");
      message.id = `field-error-${++nextErrorId}`;
      message.className = "field-error";
      message.textContent = messages.join(" ");
      field.insertAdjacentElement("afterend", message);
      const previous = field.getAttribute("aria-describedby");
      field.setAttribute(
        "aria-describedby",
        `${previous ?? ""} ${message.id}`.trim(),
      );
      field.setAttribute("aria-invalid", "true");
      field.setCustomValidity(messages.join(" "));
      value.entries = [...value.entries, { control: field, message, previous }];
    }
  },
  dispose: (element) => {
    if (!(element instanceof HTMLFormElement)) return;
    const value = applied.get(element);
    if (value) {
      element.removeEventListener("input", value.input);
      clear(value);
      applied.delete(element);
    }
  },
});
