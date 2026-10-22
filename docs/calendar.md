# Calendar

Route `/calendar`, private. Month, week and day views of the API's events (a name and a time
range) and of the plan blocks, with create/edit/delete.

## Source toggle

The toolbar switches what the grids draw (remembered in `localStorage`):

- **Events**: calendar events only. One with a plan block linked to it carries a check.
- **Plans**: plan blocks only.
- **Both**: events without a plan, plus every plan block. An event that has a plan is drawn
  once, as its plan block; clicking it opens the event.

Plan blocks without an event are read-only here; they are edited in Tasks.

## Structure

- `calendarView.svelte.ts`: `CalendarView` controller: range, data, `source`, and `items`
  (the merged, de-duplicated list the grids draw).
- `forms/eventForm.svelte.ts`: create/edit sheet. A new event can also create a linked plan
  (`event_ref` is the event id).
- `components/`: `MonthGrid`, `TimeGrid`, `EventFormSheet`, `CreatePlanFromEventWizard`,
  `CapacityPanel`.
