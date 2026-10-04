import { html, render } from "@lit-labs/ssr";
import { collectResultSync } from "@lit-labs/ssr/lib/render-result.js";

export const landingDocument = (origin: string, stylesheet: string) =>
  collectResultSync(
    render(
      html` <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
            <title>Gymtime — basketball gym scheduling for schools</title>
            <meta
              name="description"
              content="Plan shared basketball gym time for a season. Publish availability, review coach requests, and share confirmed team schedules with families."
            />
            <link rel="canonical" href=${`${origin}/`} />
            <link rel="stylesheet" href=${stylesheet} />
          </head>
          <body>
            <a class="skip" href="#main">Skip to content</a>
            <header class="site-header">
              <nav class="wrap" aria-label="Primary">
                <a class="wordmark" href="/" translate="no">Gymtime</a
                ><a href="/sign-in">Organizer &amp; coach sign-in</a>
              </nav>
            </header>
            <main id="main">
              <section class="wrap hero" aria-labelledby="intro">
                <div>
                  <p class="eyebrow">FOR THE TEAMS THAT SHARE YOUR GYM</p>
                  <h1 id="intro">One gym. Room for every team.</h1>
                  <p>
                    Give coaches a clear view of gym time. Plan the season,
                    handle requests in one place, and keep families connected to
                    their team's schedule.
                  </p>
                  <p class="actions">
                    <a class="button" href="/app">Preview Gymtime</a>
                  </p>
                  <p>In development · Built for one school or local gym</p>
                </div>
                <figure class="court-frame">
                  <div
                    class="court"
                    role="img"
                    aria-label="A gym divided into Half A and Half B"
                  >
                    <span>Half A</span><span>Half B</span>
                  </div>
                  <figcaption>
                    One team can use the full gym, or two teams can share
                    separate halves.
                  </figcaption>
                </figure>
              </section>
              <section class="wrap features" aria-labelledby="workflow">
                <h2 id="workflow">A season everyone can follow.</h2>
                <div class="feature-grid">
                  <article>
                    <h3>Define available time</h3>
                    <p>
                      Organizers set slots, opening hours, and closures, then
                      adjust them as the season changes.
                    </p>
                  </article>
                  <article>
                    <h3>Coordinate with coaches</h3>
                    <p>
                      Coaches request time for their teams. Organizers review
                      competing requests and keep the confirmed schedule clear.
                    </p>
                  </article>
                  <article>
                    <h3>Keep families informed</h3>
                    <p>
                      Each team gets a shared schedule and a calendar
                      subscription. Parents see their team's confirmed
                      activities.
                    </p>
                  </article>
                </div>
              </section>
            </main>
            <footer>
              <p class="wrap">
                Parents need no account. Ask your coach for your team’s calendar
                link.
              </p>
              <p class="wrap">
                Organizers manage gym access and invitations. Families follow
                their team through a shared calendar link.
              </p>
            </footer>
          </body>
        </html>`,
    ),
  );
