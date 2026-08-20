# Calendar

## Overview

Route `/calendar`, private. A view over the API's mirror of the user's Google calendars: month,
week and day, with create/edit/delete/move, per-calendar visibility, and account management.

The API owns everything that matters — the mirror, the sync, recurrence expansion, and the rules
about what may be written. This side renders occurrences and collects edits. In particular it
never expands a recurrence rule itself: `GET /calendar/events` already returns occurrences.

## Structure

```
src/lib/domains/calendar/
  api/calendar.api.ts, calendar.schemas.ts   — endpoints + Zod
  types/Calendar.types.ts
  calendarView.svelte.ts                     — the page controller (range, events, calendars, SSE)
  forms/eventForm.svelte.ts                  — the create/edit sheet's controller
  utils/datetime.ts                          — calendar-specific time conversion (see below)
  components/MonthGrid, TimeGrid, CalendarSidebar, AccountsSheet, EventFormSheet
src/routes/calendar/                         — page + SSR seed
src/routes/api/calendar/stream/+server.ts    — SSE proxy
src/styles/calendar.css
```

`TimeGrid` serves both week and day: a day is the same grid with one column.

## Non-obvious rules

- **Times are instants, not conceptual dates.** Use `localInputToISO` from
  `$lib/domains/calendar/utils/datetime`, **not** `toISOString` from `$shared/utils/datetime`.
  The shared one deliberately keeps the wall clock and swaps the zone (right for a task's
  `due_at`); using it here would move every appointment by the UTC offset. There is a unit test
  asserting the two differ.
- **An all-day event's end is exclusive**, as in Google and in the API. The form shows and
  collects the _last day covered_ and converts on the way in and out (`addDaysToDateInput`).
  A one-day event is `starts_at = D`, `ends_at = D+1`.
- **An occurrence is addressed by `instance_id`** (`12@2026-08-20T07:00:00Z` — the _original_
  start of that occurrence, not where an override moved it). Pass it straight back to
  `PATCH`/`DELETE`; never build a reference by hand.
- **`scope` on a recurring edit**: `instance` (default when the reference names an occurrence),
  `following`, or `all`. The recurrence rule itself can only be changed with `scope=all`, and the
  sheet disables the field otherwise. After a `following` split, the event id changes — the
  response describes the occurrence in its new series.
- **A rule that bounds itself is left alone.** `ruleToPreset` maps only plain `FREQ=…` rules onto
  the Daily/Weekly/Monthly/Yearly presets; anything with `COUNT`, `UNTIL` or `INTERVAL` shows as
  “Custom rule (kept as it is)” so saving cannot silently drop it.
- **Visibility is a server-side preference** (`PATCH /calendar/calendars/{id}`), not a local
  filter, so every device agrees. Events are fetched with `visible_only=true`.
- **Turning a calendar's sync on imports it in full** — the API cannot bound the initial import
  by date. That is why holiday and birthday calendars arrive switched off, and why the sidebar
  labels the toggle rather than hiding it.
- **Colours come from the API, not from Google.** `color` is what to paint with (gv's assigned
  palette entry, or the user's override); `background_color` is Google's own and identifies
  nothing — every primary calendar shares the same pale cyan. Which ink goes on top is decided
  here, per colour, by `chipInk` — hardcoding white text breaks the moment someone pins a pale
  colour. Chips pass both as `--chip` / `--chip-ink`.
- **The visibility toggle is the coloured dot**, not a native checkbox: a native one renders in
  the platform's colour scheme (a white box on the dark theme) and says nothing about which
  calendar it belongs to. Filled means shown, hollow means hidden; the real input is `sr-only`
  and keeps keyboard focus.
- **`editable: false`** covers read-only calendars, parked accounts and the event kinds Google
  generates (`birthday`, `fromGmail`, `workingLocation`). The sheet opens read-only rather than
  letting a write fail.

## Live updates

The API pushes `calendar.changed` over SSE; the controller refetches the visible range (coalesced
by 400 ms) instead of patching state, so a live update and a fresh page load take the same path.

`EventSource` cannot send an `Authorization` header, so the browser subscribes to
`/api/calendar/stream`, a SvelteKit endpoint that attaches the session token server-side and
pipes the API's stream through. The token never reaches the query string.

## Loading

`+page.server.ts` seeds the first paint with a range a little wider than the month grid (the
server and the browser can disagree about the local date by an hour, and the views filter by day
anyway). The client deliberately does **not** fetch on mount: the seed covers it, and the root
layout installs the client token in an effect that has not run yet at that point. Every later
change — navigating, toggling a calendar, an SSE event — goes through `CalendarView.load()`.
