# Gymtime Requirements Draft

Gymtime helps one school or local gym organizer plan access to a shared basketball gym throughout a season. It replaces spreadsheet scheduling and verbal or email coordination with published availability, coach requests, approved bookings, and team calendars for parents.

This document is for the organizer, coaches, and the future development team. It records the first version agreed during requirements review. Supporting interface and engineering designs are linked below. The owner approved implementation after this review. Product rules in this document remain the acceptance boundary.

## First version scope

The app supports one gym with a full-gym space and divided spaces, such as Half A and Half B. An organizer defines seasons and available slots, invites coaches for specific teams, reviews competing requests, and controls the confirmed schedule. Coaches request time for their teams and manage cancellations and swaps within their permissions.

Parents receive a shareable team webpage and a subscription calendar. The app does not generate opponents, league schedules, or game matchups.

The first version also includes a searchable public landing page. Organizers and coaches sign in using a one-time code sent by email. Parent team schedules are excluded from search results; parent links do not require accounts.

Account access is invitation-only. The first organizer's email is supplied in deployment configuration. Organizers then invite other organizers and coaches. The landing page offers sign-in without public account signup.

## Roles and permissions

| Role | View | Actions |
| --- | --- | --- |
| Organizer | All scheduling information, availability, requests, and bookings | Set up seasons and spaces; define slots and closures; invite coaches; approve requests; update bookings and availability |
| Primary coach | The same scheduling information as the organizer, including other teams and pending requests | Request slots, cancel confirmed bookings, request changes, and propose or accept swaps for their own teams |
| Assistant coach | Scheduling information available to coaches | View only; receive the same notifications as their team's primary coach |
| Parent or team calendar visitor | Their team's confirmed schedule through its shared links | View the webpage and subscribe to the team calendar |

The gym may have multiple organizers with the same scheduling permissions. Organizers manage coach invitations and primary coach assignments.

An organizer invites a coach for a named team, such as School 4th Grade Basketball. One person may be the primary coach of multiple teams. A team may also have multiple assistant coaches. A person's permissions must follow the team they are acting for.

Coach visibility concerns scheduling information; it does not grant organizer editing permissions or access to account administration.

## Seasons and organizer setup

A season has a name, start date, and end date. One season is active at a time. Future seasons may be prepared as drafts, and past seasons remain available to view. Only organizers may activate or close a season. Coaches may request slots only in the active season.

Initial setup asks the organizer to define gym spaces, opening and closing hours, unavailable periods, available slots, and teams. The organizer can edit these throughout the season.

Open hours describe when the facility can be used. Published slots describe the specific periods coaches can request. Coaches choose organizer-defined slots rather than creating arbitrary start times and durations.

School events, maintenance, holidays, and other closures are entered manually by the organizer. The first version does not require an external school calendar integration.

## Gym spaces and conflict rules

- A full-gym booking occupies all of the gym's divided spaces for that time.
- Separate Half A and Half B bookings may run at the same time.
- Two confirmed bookings cannot overlap in the same space.
- Confirmed bookings must fit within the season and published availability.
- A closure prevents requests and bookings for the space and time it blocks.
- Requests may compete for the same space and time, but only compatible bookings may be approved.
- Approval must check current availability so that two approvals cannot create conflicting confirmed bookings.

Competing requests include overlapping full-gym and half-gym requests, not only requests for an identically named slot. Approving a full-gym request cancels conflicting requests for either half during that time. Approving a half-gym request cancels conflicting full-gym requests while leaving compatible requests for the other half pending.

Overlapping bookings for different teams managed by the same primary coach are allowed when the space bookings are compatible. The app warns the organizer about the coach overlap; it does not block approval solely because of that overlap.

## Slots and booking information

Each booking records the team, date, start and end time, gym space, and an optional note. Notes are visible only to organizers and coaches. An additional competing request also records the required reason for requesting an already-pending slot.

Practice and game categories and opponent fields are not required in the first version. The app manages gym access rather than matchups.

Availability and request status are separate concepts. A slot can be available with pending requests, booked after approval, or unavailable because the organizer blocked it. Request and booking records show pending, approved, declined, or canceled status as appropriate.

Canceled records should retain why they were canceled, such as coach cancellation, gym closure, or approval of a competing request.

## Booking requests and approval

1. A primary coach selects a team and an available slot or recurring set of slots.
2. The request appears as pending in the shared coach calendar. Pending requests do not reserve the slot exclusively.
3. Another primary coach may request the same slot. A competing request must include a reason.
4. The organizer reviews requests and approves one or declines requests.
5. Approval creates a confirmed booking and cancels competing requests for that slot. There is no waitlist in the first version.
6. The team schedule and notifications reflect the decision.

All coaches can see pending requests, requesting teams, and scheduling reasons available to the organizer. Parents see confirmed activities for their own team only.

Primary coaches can edit or withdraw pending requests for their own teams. Edits are checked against current slot availability and still require a competing-request reason when applicable. Withdrawn requests cannot subsequently be approved.

Coaches may request changes, with the organizer controlling the resulting schedule. The existing confirmed booking remains in place until the replacement is approved; approval changes the booking and releases the old slot together. A declined change request leaves the original booking unchanged.

## Recurring bookings

Individual and recurring requests are included in the first version. For example, a coach can request every Tuesday from 6 to 7 p.m. within the season.

Recurring bookings follow these rules:

- Each date is checked independently against closures and confirmed bookings.
- Unavailable dates are identified explicitly rather than silently omitted.
- The organizer can approve some requested dates and decline others.
- Coaches and organizers can apply an allowed change or cancellation to one date, this date and future dates, or all remaining dates in the series. Coach requests to change confirmed bookings still require organizer approval; coach cancellations take effect immediately.
- Changing or canceling one occurrence preserves the other dates.
- Dates already completed remain in the season history.
- A recurring action produces a summary of affected dates instead of a separate email for every date.

Example: an organizer approves ten Tuesday practices but declines the Tuesday of a school event. If the coach later cancels one approved Tuesday, that date becomes available while the other practices remain booked.

## Cancellations and unavailable gym time

When a primary coach confirms they will not use a booking, cancellation takes effect immediately. The released slot becomes available for new requests unless the organizer has separately blocked that space and time.

When the organizer marks an occupied slot unavailable, the affected booking is canceled, the slot becomes unavailable, and the team's primary and assistant coaches are notified. Finding a replacement time is a separate action; the app does not automatically move the booking.

Blocking a time range applies to all overlapping bookings in the affected spaces, including both halves when the whole gym is blocked. The frontend design previews affected bookings before the organizer commits an availability change.

## Coach swaps

1. A primary coach proposes exchanging a confirmed booking with another team's confirmed booking.
2. The other team's coaches are notified. Only its primary coach may accept or decline.
3. Acceptance completes the exchange without organizer approval.
4. The organizer and both teams' coaches receive notification of the completed swap.
5. Both team calendars reflect the exchanged bookings.

The original bookings stay confirmed while a swap is pending. Both changes happen together after acceptance. If either booking was canceled, changed, or made unavailable in the meantime, the swap cannot complete and the proposer must submit a new proposal. A declined swap leaves both bookings unchanged.

The proposing primary coach can withdraw an unaccepted swap. An unanswered swap expires automatically when the earlier of its two bookings begins. A withdrawn or expired swap cannot be accepted, and neither action cancels the original bookings.

Offering a slot to another team without receiving one in return is not yet a confirmed feature. In the first version, a coach can release it by canceling and another coach can request it.

## Notifications

Organizers and coaches receive both email and in-app notifications. Assistant coaches receive the same team notifications as the primary coach, but cannot use them to perform restricted actions.

| Event | Recipient |
| --- | --- |
| New booking request | Organizers |
| Additional competing request | Organizers |
| Request approved, declined, or canceled by competing approval | Requesting team's primary and assistant coaches |
| Confirmed booking changed by organizer | Affected teams' primary and assistant coaches |
| Gym closure cancels a booking | Affected team's primary and assistant coaches |
| Primary coach cancels a booking | Organizers and that team's primary and assistant coaches |
| Swap proposed | Receiving team's primary and assistant coaches |
| Swap accepted and completed | Organizers and both teams' primary and assistant coaches |
| Swap declined | Proposing team's primary and assistant coaches |
| New slot published or a canceled booking releases a slot | All coaches in the affected active season |

New availability emails can use a general message such as "New slot available" with a link to the gym calendar. Parents do not receive these emails.

Booking request emails go to organizers immediately. Confirmed schedule changes and swap requests are also sent immediately. Related dates or slots published or released by one action are grouped into one message per recipient rather than separate messages for each occurrence.

Event reminders and reminders about unanswered requests or swaps are deferred to version 2.

## Shared team calendars

Each team has a shareable webpage showing its confirmed schedule and a dynamic calendar subscription link for iPhone and other calendar applications that support subscriptions.

Coaches can download their team's schedule as well as subscribe to its calendar. The first-version design uses `.ics` downloads, as specified in [Architecture](../ARCHITECTURE.md).

- Parents see only the linked team's activities.
- Pending and unsuccessful requests are excluded.
- Confirmed additions, changes, cancellations, and swaps update the webpage and subscription feed.
- A canceled occurrence no longer appears as a current scheduled activity.
- Subscription feeds preserve each event's identity when a time or space changes, to avoid duplicate entries.
- Webpages show the gym's timezone. Subscription calendars preserve the correct event times; the receiving calendar controls the displayed timezone.
- Team webpages and subscription feeds include search exclusion directives and are omitted from the public sitemap.

The receiving calendar application controls how often it refreshes a subscription. The webpage provides the current published schedule.

Optional booking notes and competing request reasons are excluded from parent webpages and subscription feeds. Parents use the shared links without needing accounts.

## Acceptance scenarios

The completed first version should support these outcomes:

1. The organizer creates a season, sets hours, blocks a school event, and publishes requestable slots.
2. Two teams book separate halves simultaneously, while a full-gym booking prevents either half from being booked during its time.
3. A pending request is visible to coaches. A competing request cannot be submitted without a reason.
4. Approving one request confirms its booking and cancels conflicting competing requests.
5. One person manages multiple teams without losing the association between a request and its team.
6. An assistant can view schedules and receive notifications but cannot submit requests, cancel bookings, or accept swaps.
7. A primary coach cancels a confirmed booking and the slot becomes immediately requestable.
8. A second primary coach accepts a valid swap; both bookings update and the organizer is notified without an approval step.
9. The organizer blocks occupied gym time; affected bookings are canceled, coaches are notified, and that time cannot be requested.
10. A parent opens a team's shared webpage and subscribes to its calendar without seeing other teams or pending requests.
11. Coaches can view a past season but cannot request new slots in it.
12. A primary coach's two teams can book compatible spaces at overlapping times, with a warning shown to the organizer.
13. A note visible to coaches is excluded from the corresponding parent webpage and calendar feed.
14. The organizer receives an immediate email when a coach submits a booking request.
15. The organizer approves some dates in a recurring request and declines others, with each date checked for conflicts and clearly showing its outcome.
16. A coach cancels one date or all remaining dates of a recurring booking without changing completed season history. A notification summarizes the affected dates.
17. Multiple organizers can administer the same gym with identical scheduling permissions.
18. An organizer prepares a future season as a draft, but coaches cannot request its slots until it becomes the single active season.
19. A change request leaves the original booking confirmed until the organizer approves its replacement. A declined request does not release the original slot.
20. A pending swap cannot complete if either original booking has changed or become unavailable; neither side is exchanged on its own.
21. Approving a half-gym request cancels a conflicting full-gym request while preserving a compatible pending request for the other half.
22. A primary coach edits a pending request, with availability and any competing-request reason checked again, or withdraws it so it can no longer be approved.
23. A proposing coach withdraws an unaccepted swap, or an unanswered swap expires when the earlier booking begins. Neither original booking is canceled as a result.
24. An action affecting multiple recurring dates produces one summary per recipient rather than separate messages for every date.
25. The public landing page is eligible for search discovery, while team webpages and subscription feeds include search exclusion directives and are omitted from the public sitemap.
26. An organizer or coach signs in with an emailed one-time code rather than a password or email sign-in link.
27. The configured first organizer can sign in and invite other organizers and coaches. An uninvited visitor cannot create an account through the landing page.

## Review status

The product rules raised during this requirements review are resolved. The organizer, primary coach, assistant coach, and parent workflows are implemented. Use the [walkthrough](workflows.md) to review them.

The selected stack and workflow are recorded in [Engineering decisions](engineering.md). [Architecture](../ARCHITECTURE.md), [Frontend architecture](frontend.md), and [Scaffold specification](scaffold.md) now specify the implementation design, including screen behavior, affected-booking previews, and `.ics` downloads. These design choices are distinct from the agreed product rules. Product workflows are implemented; [verification](verification.md) distinguishes automated evidence, local runtime checks, and calendar-client checks that remain manual.

## Deferred features

Version 2 may add reminders. Automatic schedule generation, fairness quotas, priority allocation, waitlists, transfers without reciprocal swaps, and direct parent email subscriptions are outside the agreed first version unless later added explicitly.
