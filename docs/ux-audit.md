# Gymtime scheduling UX audit

Reviewed October 3, 2026, for the owner, coaches, and the implementation team. The owner approved these recommendations on October 3. The redesign is implemented; this document preserves the original observations and design rationale. The approved [product rules](requirements.md) remain unchanged. See [frontend behavior](frontend.md#scheduling-workspace) and [verification](verification.md) for the resulting interface and checks.

Gymtime needs two focused experiences: an organizer's schedule and decision queue, and a coach's team schedule and time finder. The current screens put individual database occurrences, editing controls, and history directly into the main workflow. The result is excessive scrolling and difficult comparison. Improve these workflows first, then apply a consistent visual design to them.

## Evidence and limits

The review used the running example school preview in Chromium, signed in separately as the organizer and Jordan, who coaches two teams. Desktop size was 1440 × 1000; mobile size was 390 × 844. The reviewed week was October 5–11. The data contained six teams, 692 published slots, 321 booking records, and 228 request records. Eleven requests were pending, including seven requests to change existing bookings.

I inspected screenshots, navigated the calendar and request views, selected a free slot, and inspected the resulting form. No request, approval, cancellation, swap, or configuration change was submitted. Local screenshots and measurements are under `.local/ux-audit`; those files are inspection evidence, not required repository assets. This is an expert review with one owner's reported feedback, not a usability study with representative coaches or an accessibility certification.

| Observed problem | Evidence | Consequence |
| --- | --- | --- |
| Pending work is buried in request history | The badge says 11, but the page renders 228 cards. The first pending request is record 209; the first approval button is about 17,978 pixels below the top | The organizer must search through completed work before making a decision |
| Selecting time does not reveal a nearby next action | After a coach selected Monday's 4 p.m. slot, the request form began about 3,940 pixels below the current viewport top | A coach can select a time and miss the form that completes the request |
| A weekly calendar also contains the entire season's booking history | Both roles received 321 booking cards below the week. The organizer's desktop page measured about 62,469 pixels high | Week navigation does not constrain most of the content; past cancellations and distant dates overwhelm current work |
| Mobile stacks the same content | The organizer request page measured about 62,192 pixels high at 390 pixels wide | Responsive layout avoids horizontal overflow but still requires excessive vertical scrolling |
| Time is represented by independently sized cards | The reviewed week has 43 slot cards. Full-gym and half-gym alternatives repeat overlapping bookings; notes and controls change card heights | Times do not align across days, and a full-gym alternative can appear booked by a team that reserved only a half |
| Common actions compete with administration | Account information, sign-out, navigation, filters, explanations, and date controls precede the schedule; coach views initially show all teams | The interface's hierarchy does not reflect the user's immediate task |

The measured scroll lengths describe this fixture and these viewport sizes. They should not be treated as timings or estimates of real users' completion rates. No page errors or horizontal overflow occurred in the inspected views.

## Organizer: schedule and review queue

The organizer should enter a compact schedule workspace with a visible **Needs review** count. Calendar and request review remain one click apart. **Publish time**, **Assign time**, and **Block gym** are explicit actions; season settings, invitations, and delivery diagnostics live in administration.

### Show pending work first

Make **Needs review** the default request view. Keep completed decisions in a separate, searchable **History** view with pagination. Provide filters for team, request type, date, and competing requests. Sort pending work by its first affected date, with a visible competing-request flag. Selecting a filter must not discard existing selections without explaining the change.

Use compact rows with consistent columns: team, requested time, request type, occurrence count, and status. Display notes and reasons in the request's detail panel. Show a short indication that a reason exists when it matters to a decision.

Group recurring requests into one row per team, series, and request type, with a summary of the weekly pattern and date range. Expand the row to review individual occurrences and exceptions. A series with approved and declined dates must show the mixed outcome in history; grouping cannot hide it.

The fixture's eleven pending requests can be presented as five review items: one competing pair, one compatible Half B request, one October time change, one edited extra-practice request, and one January change series with six occurrences. Keep both counts explicit: **5 review items · 11 requests**.

An illustrative row for the existing January change series:

| Team | Requested change | Dates | Action |
| --- | --- | --- | --- |
| 8th Boys | Tue/Thu · Full gym · 6–7 p.m. → 5–6 p.m. | Jan 12–28 · 6 dates | Review dates |

### Compare competing requests together

Put physically conflicting requests in one review panel. For October 5, show the grade 8 boys' and girls' requests beside each other, with the same date, time, space, coach, and reason fields. The approval preview should name the competing requests that will be cancelled. A compatible Half B request must remain distinguishable from a full-gym conflict.

For changes, show **Current booking → Requested booking**. Keep the original's confirmed status visible. For a recurring request, offer **Approve selected dates** and **Decline selected dates**, with dates and consequences summarized before confirmation. Bulk selection must not suggest that incompatible requests can all be approved.

Swaps need their own actionable view or queue section, clearly stating **Waiting for the other coach**. The organizer observes swaps; acceptance belongs to the receiving primary coach under the existing rules.

## Coach: my teams and find time

Default to **My teams** and upcoming bookings. For a coach like Jordan, provide a clear switch between grade 6 boys and grade 7 boys, plus an option to view both. **All gym** remains available because coaches are entitled to see everyone's schedule. Assistant coaches receive the same viewing defaults and team context without mutation actions.

Make **Find time** the primary scheduling action. Start with the selected team, date or date range, and required gym space. Show available organizer-published times as compact buttons grouped by day. A pending request must be labeled **Available · another request pending**, rather than implying that it reserves the time. Booked and closed periods remain inspectable in the gym schedule.

After selection, keep a summary beside the time choices on desktop and a sticky **2 times selected · Review** bar on mobile. Review opens a panel or sheet with the dates, activity, repeat option, and submit action. Its layout must leave the currently focused control visible above mobile keyboards and sticky controls.

Make **Repeat weekly** an obvious choice in this panel. Describe the selected weekly pattern and end date, then show eligible occurrence count and excluded dates. A coach should be able to choose multiple weekly times, such as Monday and Wednesday, and understand which dates will be sent. Exclusions must be visible and reviewable before submission.

Reveal the competing reason field when a selected time actually conflicts with another pending request. Explain which request creates that requirement. Keep the optional internal note behind **Add a note**. After submission, show **Request sent · awaiting organizer approval** and a link to the coach's requests, rather than a generic “Schedule updated.”

## Calendar: show time and occupancy

On desktop, use a calendar with aligned time rows and day columns. Represent each actual booking once in its occupied space. Half A and Half B sit beside each other; a full-gym booking spans both. Show availability choices separately from confirmed occupancy so a full-gym option blocked by a half booking cannot look like a full-gym reservation.

Use compact event labels such as **6th Boys · Practice**, with full names and notes in a detail panel. Distinguish confirmed, pending, selected, and closed states using text and shape as well as restrained color. Clicking or keyboard-selecting an available published interval opens the request panel. Selecting a booking opens its details and role-appropriate change, cancellation, or swap actions.

Provide **Today**, **Day / Week / List**, and simple date navigation. The example school gym opens on Saturday, so games and their morning hours must remain discoverable. A day view should fit the chosen day's open hours; the week view needs a clear way to reach earlier or later hours. A month view may help season overview later, but is not the recommended slot-selection surface.

On mobile, default to a chosen-day agenda with a short date strip. Show time, team, space, and state in compact rows. Do not stack an entire week and the full season's history into one page. Put full history behind its own date filter and pagination.

Keep keyboard and screen-reader behavior part of the design. Native buttons and labeled forms remain suitable for a time list. An interactive ARIA grid requires deliberate focus management and arrow-key navigation; adding `role="grid"` alone is insufficient. The [W3C grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) explains those responsibilities.

## Visual direction

Use a compact header with the school, season, and account menu. Move sign-out into that menu. Make calendar tools visible near the schedule instead of spending most of the initial viewport on the account heading and explanatory paragraphs.

Use neutral surfaces, a single accent, consistent type sizes, and subtle row dividers. Reserve prominent buttons for the current primary action. Keep status labels small and aligned; avoid stretching badges and text to fill the height of a neighboring card. Show the school name once in the workspace and shorten team labels where space is tight, while retaining unambiguous full names in details and accessible labels.

The organizing principle is to keep common choices visible and make deeper detail easy to open. This applies [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) to Gymtime: notes, history, and specialized editing belong in clearly labeled secondary views, while dates, availability, conflicts, and the next action stay visible.

## Recommended sequence and validation

Start with the pending review queue, recurring grouping, and separate history. These address the owner's longest reading task directly. Next, build the coach's time finder and persistent selection summary. Design the calendar and visual system around these two flows, then extend the same patterns to changes, swaps, closures, and administration. The owner subsequently authorized this work, and the recommended workflows are now implemented.

Review a realistic prototype using the example school data before replacing the screens. Test whether an organizer can find and decide the October 5 competition, review six January change dates without overlooking exceptions, and preview a closure. Test whether Jordan can choose the correct team, request weekly practice, identify excluded dates, and cancel one occurrence. Include Casey accepting a swap and an assistant viewing the same calendar.

The proposed acceptance boundary is that pending work appears on the first request viewport, history does not populate the active queue, selections always have a visible next action, and recurring summaries expose per-date decisions. At 390 pixels, a coach should reach useful times without traversing account copy and the entire week. Confirm keyboard navigation, focus return, sticky-panel visibility, both themes, and unchanged parent privacy and scheduling permissions. Observe users' first attempts; measure errors and task completion before claiming the redesign is easier.

## Implementation review

The example school queue now presents five review items for eleven pending requests. Its initial view contains no completed records. Opening a competition compares its requests, and opening the January change group exposes all six dates. Completed request groups retain mixed decisions in History.

The weekly calendar renders current occupancy without the 321-record booking history beneath it. Coaches enter My teams; Find time exposes published availability, persistent selections, multiple weekly patterns, excluded dates, and a nearby review action. Mobile uses a chosen-day agenda and a native selection dialog. Organizer actions, administration, booking details, swaps, and supporting screens use the shared neutral visual system.

Automated and fixture checks are recorded in [Verification](verification.md). These demonstrate implemented behavior and preserved scheduling invariants. They do not measure real coaches' task completion or establish an accessibility certification; the owner's next testing session supplies the next usability evidence.
