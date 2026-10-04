import { html } from "lit";
export const parentGuide = (calendarURL: string) =>
  html`<details class="parent-help">
    <summary>New to this team calendar?</summary>
    <div class="guide-content">
      <p>
        No account is needed. This page shows only this team's confirmed games
        and practices. Pending requests and internal notes are not shared.
      </p>
      <p>
        <strong>Subscribe for future changes.</strong> A subscription follows
        updates. Download calendar file gives you a snapshot and will not update
        automatically. Your calendar app controls refresh timing and may display
        events in its own timezone.
      </p>
      <label
        >Calendar subscription URL<input
          readonly
          .value=${calendarURL}
          @focus=${(event: FocusEvent) => {
            if (event.currentTarget instanceof HTMLInputElement)
              event.currentTarget.select();
          }}
      /></label>
      <details>
        <summary>iPhone and Apple Calendar</summary>
        <p>
          Open Subscribe to team calendar and confirm the subscription. You can
          also open the iPhone Calendar app, choose Calendars, then Add Calendar
          and Add Subscription Calendar. Paste the URL above and follow the
          prompts. Menu names may vary by iOS version.
        </p>
        <a
          href="https://support.apple.com/guide/iphone/iph3d1110d4/ios"
          target="_blank"
          rel="noopener noreferrer"
          >Apple's calendar instructions</a
        >
      </details>
      <details>
        <summary>Google Calendar</summary>
        <p>
          On a computer, open Google Calendar. Beside Other calendars, choose
          Add, then From URL. Paste the subscription URL above and add the
          calendar. It can then appear in the Google Calendar app signed in to
          that account. Google requires the website to add a URL subscription.
        </p>
        <a
          href="https://support.google.com/calendar/answer/37100"
          target="_blank"
          rel="noopener noreferrer"
          >Google's subscription instructions</a
        >
      </details>
      <details>
        <summary>Other calendar apps</summary>
        <p>
          Look for Subscribe, Add calendar from URL, or Subscribe from web.
          Paste the subscription URL above. Choose a subscription rather than
          importing a downloaded file.
        </p>
      </details>
      <details>
        <summary>Missing, delayed, or duplicate events?</summary>
        <ul>
          <li>
            An empty page means no confirmed events match the starting date. Try
            an earlier date or ask your coach whether times are confirmed.
          </li>
          <li>
            If a change has not reached your calendar app, refresh this webpage
            to check the latest schedule. Subscription refresh timing depends on
            your calendar provider.
          </li>
          <li>
            If your coach replaces the link, ask for the new one and subscribe
            again.
          </li>
          <li>
            If you imported a file and also subscribed, remove the imported
            copies or duplicate calendar in your calendar app. Keep one
            subscription.
          </li>
        </ul>
      </details>
      <p class="small muted">
        Anyone with this team link can view the schedule. Share it with your
        team; search exclusion does not make it private.
      </p>
    </div>
  </details>`;
