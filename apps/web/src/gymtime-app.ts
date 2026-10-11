import { define, html, prop, type PropsOf, type Stateless } from "@gyral/core";
import "./pages/gymtime-account.js";
import "./pages/gymtime-sign-in.js";
import "./pages/gymtime-team-calendar.js";
const props = {
  view: prop.string({ default: "app" }),
  token: prop.string({ default: "" }),
};
/** Light DOM keeps landmarks and native skip-link targets addressable. */
export const GymtimeApp = define<Stateless, never, PropsOf<typeof props>>()(
  "gymtime-app",
  {
    props,
    shadow: false,
    view: (_s, _i, { props: p }) =>
      html`<header>
          <a class="skip" href="#main">Skip to content</a>
          <nav aria-label="Primary">
            <a href="/"><strong translate="no">Gymtime</strong></a
            ><a href="/app">Gym workspace</a>
          </nav>
        </header>
        <main id="main" tabindex="-1">
          ${p.view === "sign-in"
            ? html`<gymtime-sign-in></gymtime-sign-in>`
            : p.view === "app"
              ? html`<gymtime-account></gymtime-account>`
              : html`<gymtime-team-calendar
                  .token=${p.token}
                ></gymtime-team-calendar>`}
        </main>`,
  },
);
