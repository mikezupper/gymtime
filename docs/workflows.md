# Try Gymtime

This walkthrough is for the gym organizer and coaches testing the first version. Start the app using [Local development](development.md). Development captures all messages in the local email inbox; it does not send real invitations or notifications.

The [onboarding and contextual help guide](onboarding-and-help.md) describes the in-app organizer checklist, coach guide, and parent instructions. Open **Help** in the workspace to return to your role's guide. The welcome card can be dismissed; help buttons beside unfamiliar choices open short explanations by tap, click, or keyboard.

## Example mock season

A local evaluation used **School Basketball 2026–2027**, from October 1, 2026, through February 1, 2027. Its six teams cover grades 6–8, boys and girls. The gym opens Monday–Friday from 4–9 p.m. and Saturday from 9 a.m.–3 p.m., in `America/New_York`. These are sample hours that the organizer can edit.

Grade 6 teams practice Monday and Wednesday at 5 p.m., boys on Half A and girls on Half B. Grade 7 teams use those halves at 6 p.m. Grade 8 boys practice Tuesday and Thursday at 6 p.m., and grade 8 girls at 7 p.m., using the full gym. Saturday game reservations run hourly from 9 a.m. to 3 p.m., in team order: grade 6 boys, grade 6 girls, grade 7 boys, grade 7 girls, grade 8 boys, and grade 8 girls. Changes, cancellations, and school breaks create exceptions to this pattern.

Sign in with your configured organizer email to review your local schedule. Jordan Hayes (`jordan.hayes@school.example.test`) coaches both boys' grade 6 and grade 7 teams. Morgan Reed (`morgan.reed@school.example.test`) coaches both girls' grade 6 and grade 7 teams. Alex Carter (`alex.carter@school.example.test`) coaches grade 8 boys, and Casey Brooks (`casey.brooks@school.example.test`) coaches grade 8 girls. Their email codes appear in the same local inbox. Internal notes and closure reasons begin with **Mock:**.

| Date | Example to try |
| --- | --- |
| October 5, 7 p.m. | Two pending grade 8 requests compete for the full gym; approving either cancels the other |
| October 6, 5 p.m. | Grade 6 boys have approved Half A; the full-gym request was cancelled, and grade 6 girls still await approval for compatible Half B |
| October 7 | Grade 6 boys cancelled their 5 p.m. practice; Half A is available again. Grade 7 girls have a recurring extra-practice request with approved and declined dates |
| October 8 | Grade 8 boys await approval to move practice from 6 p.m. to 5 p.m.; the original remains confirmed |
| October 9, 5 p.m. | Jordan's two teams occupy separate halves at the same time; this demonstrates the coach-overlap warning |
| October 10 | Grade 6 boys and grade 8 girls have a pending game swap; sign in as Casey to accept or decline it |
| October 13 | Grade 8 girls' approved change moved practice from 7 p.m. to 8 p.m. |
| October 14, 5 p.m. | Half A maintenance cancelled the boys' practice while Half B remains booked by the girls |
| October 17 | An accepted swap exchanged grade 7 boys' and grade 8 boys' game times |
| October 24 and 31 | Declined and withdrawn swaps preserve the original games |
| November 7, 11 a.m. | A school assembly cancelled a game and invalidated its pending swap |
| November 25–28 and December 24–January 1 | School breaks block gym access and retain affected bookings as cancelled history |

The sample also includes edited and withdrawn requests, a closure-cancelled request, pending January changes across future dates, and cancellation of future dates in a recurring series. **Parent links** provides all six live team webpages and feeds. This example dataset is not distributed with the repository. A fresh database starts without teams, slots, or bookings.

## Set up the season

Sign in as the configured organizer using the six-digit email code. Open **Administration → Gym setup**, then enter the gym name, IANA timezone, open days, and opening hours. Enable the split-gym option if teams may use Half A and Half B independently. Changes to hours or timezone affect new slots; existing reservations keep their actual times.

For a fresh instance, start with **Open setup guide**. Follow its steps from gym settings through sharing team links. Progress follows saved settings; opening a form does not complete it. **No closures to add**, **I've shared the team links**, and welcome dismissal are remembered for your account in this browser. Use the workspace season selector when preparing a future draft. **Review saved setup** summarizes the selected season before activation.

Create a draft season with its date range. Create each team with its primary coach's email and season. The app invites new coaches automatically. You can assign assistant coaches, change the primary coach, and add an existing team to another season. **Administration → People** lets you invite another organizer or disable an account. All organizers have the same scheduling permissions; the last enabled organizer cannot be disabled.

Define slots by selecting a season, date range, weekdays, start and end time, and gym space. Preview the dates before saving. A one-day range creates one dated slot; a longer range creates matching weekly occurrences. Dates outside the season or opening hours, and ambiguous or nonexistent daylight-saving times, cannot be saved. Full-gym and half-gym slots may offer alternative choices at the same time.

Activate the season when coaches can request its slots. Only one season can be active. Future seasons stay in draft; closing a season preserves its published history and prevents scheduling changes in it.

## Request and approve gym time

Sign in as a team's primary coach. **Calendar** opens on **My teams**; switch to one team or **All gym** as needed. Choose **Find time**, then select the team, date range, and space. Clicking an available calendar interval also opens the finder with that time selected. Assistants can inspect schedules but do not receive these mutation actions.

**Open coach guide** lists your assignments and explains what each role can do. Primary coaches can choose **Show me how to request time** for three optional tips in the finder. Advancing tips does not send a request or change the schedule.

Choose published time buttons. Selections stay while you browse other dates or filters. On desktop, review them in the adjacent panel; on mobile, use the sticky **Review selection** button. Choose Practice or Game, and expand **Add a note** if needed. Notes remain internal. A competing request displays the other requesting team and requires a reason before submission; pending requests do not reserve time. Review the confirmation, then send the request. The success message links to Requests.

For a weekly pattern, select each desired weekday/time/space, expand **Repeat weekly**, and set **Repeat through**. **Select matching weekly slots** expands all selected patterns. Review the eligible count and excluded dates before submitting. Individual selections can also span several weeks. Selecting an overlapping full/half alternative replaces the earlier conflicting selection.

Organizers open **Requests** to see **Needs review**, grouped by recurring intent and physical competitions. Counts distinguish review items from requested dates. Expand a row to compare requests and see **Current · confirmed → Requested** for changes. Approve or decline one date, or select compatible dates for a grouped decision. Approval is disabled for a selection containing physically competing requests. Confirmation names the competing requests that will be cancelled; compatible halves remain pending. **Request history** shows completed outcomes, including mixed decisions, with search and pagination.

Organizers use **Assign time** to confirm published slots directly. Its review panel also offers submission for approval. **Publish time** and **Block gym** open their administration forms. Desktop **Day / Week / List** controls and the mobile date strip keep navigation near the schedule. **Show all hours** reveals earlier games when the weekly view starts at afternoon practice hours.

The same person may coach several teams. Compatible half-gym bookings are allowed even if their primary coach overlaps; the organizer receives a warning. Assistant coaches can view schedules and receive their team's notifications, but cannot request time or change bookings.

## Change, cancel, or swap

Open a booking from Calendar, or use **History → Booking details**. A primary coach can request replacement slots for one date, that date and future dates, or all remaining dates in a series. Select the same number of replacement dates as the chosen scope. The original bookings remain confirmed until each replacement is approved. Declined or withdrawn requests leave those bookings intact. Completed dates remain in history.

Cancellation takes effect immediately and makes the released time available again. Review the selected dates before confirming. Organizers can move a confirmed booking directly; coaches request approval for changes.

In booking details, expand **Propose a swap**, optionally filter by **Swap date**, then select another team's confirmed booking and send a proposal. The other team's primary coach opens **Swaps** to accept or decline it. **Swap history** shows completed proposals. Acceptance exchanges both bookings together and notifies the organizer without another approval step. The proposer can withdraw an unanswered proposal. A proposal expires when the earlier booking begins and cannot complete if an original booking has changed or the gym becomes unavailable.

In **Administration → Gym setup**, preview a closure with its times, space, and reason. The preview lists affected bookings and pending requests. Confirmation cancels every affected booking, blocks requests for that time, and notifies the affected coaches. Reopening time makes otherwise available published slots requestable; previous bookings remain cancelled. To edit or unpublish an unoccupied slot, choose a **Published date** under **Manage published slots** in Gym setup, then open **Edit slot**. Organizer move forms use a **Replacement date**; pending-request edits use a **Requested date**, so their selectors show one day rather than the entire season.

## Share with parents

In **Parent links**, copy the team's webpage or calendar subscription URL. Parents need no account. The webpage shows twenty confirmed events per page, with a starting-date filter and previous/next controls. It shows only that team's confirmed activities; it omits internal notes, competing reasons, and pending requests. Search engines receive `noindex` directives for these pages and feeds.

Parents can use **Subscribe to team calendar** on iPhone or add the HTTPS calendar URL as a subscription in another calendar app. **Download calendar file** provides a snapshot, rather than an ongoing subscription. Subscriptions keep event identities when bookings move and include cancellation records. The calendar app decides how often it refreshes. The webpage refreshes on demand and when a viewer returns to it.

**New to this team calendar?** explains subscriptions and offers Apple, Google, and other calendar-app instructions. Parents can select the subscription URL to copy it. The guide also explains empty schedules, delayed updates, replaced links, and duplicate calendars. **Parent links → Message to share with parents** gives coaches a short introduction to send with the team's URLs.

Replacing a sharing link invalidates both the old webpage and feed. Give parents the new link and ask subscribers to subscribe again. Anyone with a current link can view its team calendar; search exclusion does not make the link private.

## Check notifications

**Notifications** contains the signed-in person's messages and delivery status, twenty per page. Expand **Read message** for details. Primary and assistant coaches receive the same team updates. A single action groups its dates and messages per recipient, including for a coach assigned to several teams. Newly published or released slots notify coaches associated with the active season. Booking requests notify organizers immediately through the durable email queue.

Organizers can inspect failed deliveries and retry them after fixing the email service. Retries preserve the delivery identity. They can also inspect the audit history. Refreshing the workspace reads current data; live push updates and reminders are outside this version.
