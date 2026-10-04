# Onboarding and contextual help

Gymtime provides an organizer setup checklist, a coach getting-started guide, parent calendar instructions, and help beside unfamiliar choices. The owner approved this work on October 4, 2026. This document describes the implemented interface and its limits. The [workflow walkthrough](workflows.md) explains scheduling tasks; [verification](verification.md) records the checks.

Guidance follows each person's role and team assignments. A dismissible welcome card opens the longer guide. **Help** keeps it available after dismissal, including in an existing instance and while preparing a future season. Optional explanations open from small help buttons; scheduling consequences remain visible in the existing confirmations.

## Organizer: prepare a season

The first organizer signs in with the deployment-configured email address and an email code. **Open setup guide** opens **Set up your season**. The workspace season selector controls which season the checklist describes.

The checklist links to seven tasks:

1. **Define your gym.** Save the name, timezone, opening hours, and full or divided spaces.
2. **Create a season.** Enter its name and date range. A draft can be prepared before requests open. Creating a season selects it immediately in the workspace.
3. **Add teams and coaches.** Assign a primary coach and optional assistants. Creating a team with a new coach sends an invitation while the season is still a draft.
4. **Review unavailable time.** Add holidays, school events, or maintenance. If none apply, choose **No closures to add**.
5. **Publish available slots.** Define dates, times, weekdays, and spaces; review the generated dates before saving. Opening hours alone do not create requestable time.
6. **Review and activate.** **Review saved setup** summarizes the gym, timezone, spaces, opening days, season dates and status, team names, and published-slot count. Follow the activation step to open coach requests. Only one season can be active.
7. **Share team schedules.** Send parents their team's webpage and subscription link, then acknowledge **I've shared the team links**. An empty confirmed calendar is expected before bookings are approved.

Progress follows saved configuration. Visiting a screen never completes a task. The gym step requires saved settings and at least one open day; the team and slot steps require records associated with the selected season. An active closure overlapping the season, or the explicit no-closures acknowledgment, completes the closure step. An active or closed season completes activation.

These are reminders, not additional scheduling restrictions. A completed team step means at least one team has been added; it does not certify that every team or holiday has been included. Review saved setup before activation. Guidance never activates a season or submits a mutation automatically.

## Coach: learn your team's workflow

**Open coach guide** and **Help** show **Getting started with your team**, including each assignment in the selected season. A primary coach can request and change that team's time. An assistant can view schedules and receives the same team notifications. Someone who is primary on one team and assistant on another sees both assignments and their different permissions.

The guide covers My teams and All gym, Find time, weekly repetition and excluded dates, request decisions, booking details, and parent links. It explains that pending requests do not reserve time, a requested change keeps the original confirmed until approval, cancellation releases time immediately, and a swap requires the other primary coach's acceptance.

For a primary coach in an active season with published slots, **Show me how to request time** opens the finder with three optional tips: choose the team and times; review the dates and repetition; check and send when ready. Advancing tips never selects time, sends a request, or confirms an action. The guide explains inactive seasons, unpublished time, and missing team assignments. Assistants receive viewing instructions without the request walkthrough action.

## Parents: view or subscribe

The shared team webpage has **New to this team calendar?** beside its subscription actions. Parents need no account. They see only their team's confirmed events, with the webpage's timezone stated above the actions. Internal notes, competing reasons, and pending requests remain in the authenticated workspace.

The guide explains that subscriptions follow future changes, while downloaded files are snapshots. It provides a selectable subscription URL, instructions for Apple and Google Calendar, and general instructions for other apps. Apple and Google instructions link to their [official Apple guide](https://support.apple.com/guide/iphone/iph3d1110d4/ios) and [official Google guide](https://support.google.com/calendar/answer/37100), checked when the copy was written.

Recovery instructions cover empty schedules, delayed refreshes, replaced links, and duplicate calendars. Calendar providers control refresh timing and may display events in their own timezone. Parents can refresh the webpage to check a recent saved change. A replaced link requires the new URL and a new subscription. Anyone with a current team link can view its schedule; search exclusion does not make the link private.

## Help beside controls

| Surface | Explanation |
| --- | --- |
| Landing and sign-in | Invited organizers and coaches use email codes; parents use their coach's team link |
| Calendar | Available, pending, confirmed, and unavailable time; full and half-gym occupancy |
| Find time | Published slots, team selection, approval, and competing reasons |
| Selection review | Weekly patterns, excluded dates, recurring scope, and internal-note visibility |
| Requests | Physical competition, cancellation of competing requests, compatible halves, and partial decisions |
| Booking details and swaps | Original time retained during changes, immediate cancellation, and reciprocal acceptance |
| Gym setup | Hours versus slots, timezone effects, season states, and closure consequences |
| People | Invitations and primary, assistant, and organizer permissions |
| Parent links | Sharing, subscriptions, replacing links, and a message to send with a team's URLs |
| Notifications and history | Delivery status and completed outcomes |

Help buttons have descriptive accessible names and use native popovers. Click, tap, or keyboard activation opens them; Escape dismisses them and keeps focus on the trigger. Longer instructions use expandable sections. The [W3C tooltip interaction guidance](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) informed keyboard dismissal; these help controls are explicitly opened popovers, rather than hover-only tooltips. W3C marks its tooltip pattern as a work in progress.

Shared short answers live in the frontend guidance model and appear in both popovers and guides. Internal-note fields state, “Only organizers and coaches can see this note.” Copy uses the reader-centered principles of the project's reader-centered writing conventions.

## Progress storage and permissions

Gym, season, team, slot, and closure progress comes from the shared server schedule. Welcome dismissal and the two manual checklist acknowledgments are account-scoped preferences saved in this browser. They survive reloads on the same browser and origin; they do not synchronize between devices or organizers. Clearing browser storage resets those preferences without changing the schedule. This is the implementation default for personal reminders, not an owner requirement for shared onboarding records.

Effect reads and writes preferences through an injected storage service and the existing browser runtime adapter. A schema validates stored values. If storage is unavailable or invalid, guides remain usable and the workspace explains that preferences could not be saved. Rust continues to authorize every schedule mutation; guides confer no permissions.

Verification covers a fresh instance, saved progress, first-season selection without refresh, mixed primary and assistant assignments, optional tips without requests, keyboard dismissal, mobile layout, and parent guidance. These checks establish behavior, not a usability study or successful refresh in a real calendar provider.
