# Chart

## Overview

SVG chart system built on [LayerCake](https://layercake.graphics/) for rendering time-series history data. Used inside `HabitHistoryModal` (habit card chart icon) and `TimeHistoryModal` (task summary chart icon).

The chart renders time-series data as a line with a filled area below, interactive hover points with tooltips, and frequency-aware axis labels.

## Architecture

```
HabitHistoryModal / TimeHistoryModal
├── LayerCake (data, scales, padding, custom props)
│   └── Svg
│       ├── AxisY    — horizontal grid lines + value labels
│       ├── AxisX    — time labels, frequency-aware formatting
│       ├── Area     — filled area under the line
│       ├── Line     — stroke path connecting data points
│       └── Points   — interactive circles with hover tooltips
```

All chart sub-components live in `src/lib/shared/components/chart/` and access shared state (data, scales, accessors) via LayerCake's Svelte context (`getContext('LayerCake')`).

Custom props (like `frequency` and `formatValue`) are passed through LayerCake's `custom` prop and accessed as `$custom.frequency`, `$custom.formatValue`, etc.

## Components

### AxisX (`AxisX.svelte`)

Renders time-based tick labels along the bottom edge.

**Frequency-aware formatting:**

| Frequency | Format | Example |
|---|---|---|
| `daily` | `dd mon` (es-ES locale) | `27 oct` |
| `weekly` | `Sem. {ISO week}` | `Sem. 12` |
| `monthly` | Full month name (Spanish) | `Enero` |

**Boundary tick merging** — the component ensures the first and last data points always have labels. It computes d3's default ticks, then prepends/appends domain boundaries if they're far enough from existing ticks (>8% of chart width) to avoid overlap.

**Edge alignment** — labels near the left edge use `text-anchor: start`, near the right edge use `end`, and all others use `middle`. This prevents text from clipping outside the chart area.

### AxisY (`AxisY.svelte`)

Renders horizontal grid lines and value labels on the left side. Uses d3's default tick generation (5 ticks).

### Line (`Line.svelte`)

Builds an SVG `<path>` from all data points using `xGet`/`yGet` accessors. Stroke color is `--color-primary`, width 2, with round joins and caps.

### Area (`Area.svelte`)

Same path as Line but closed to the bottom of the chart, filled with `--color-primary` at 10% opacity.

### Points (`Points.svelte`)

Renders interactive data point circles with hover tooltips.

**Hit area pattern** — each point has two overlapping circles:
1. An invisible circle (`r=20`, `fill="transparent"`) that captures pointer events
2. A visible circle (`r=3`, `pointer-events: none`) that animates to `r=5` on hover

This ensures the hover target is large enough for both mouse and touch input.

**Tooltip** — on hover, a `<g>` group appears above the point containing:
- A rect background (`--color-bg` fill, muted border)
- Text showing `{value} · {formatted date}`

The date format in the tooltip matches the frequency (month name for monthly, `dd mon` otherwise).

**`formatValue` support** — Points accepts an optional `formatValue` function via LayerCake's `custom` prop. When provided in `custom={{ frequency, formatValue }}`, it formats the tooltip value. Default is `String(v)`. The time history modal passes `formatValue: formatHours` which formats `10.5` as `10h 30m`.

## Y-Domain

The Y-axis range is computed dynamically from the data with 10% margin:

```
min = Math.max(0, dataMin - range * 0.1)
max = dataMax + range * 0.1
```

This prevents the line from touching the top/bottom edges while keeping 0 as the floor when data values are positive.

## Data Flow

1. **Habits:** `HabitHistoryModal` calls `habitsApi.getHistory()` which returns `HabitHistoryResponse`:
   ```typescript
   { start_at: string, end_at: string, data: { date: string, value: number }[] }
   ```
2. **Tasks:** `TimeHistoryModal` calls `tasksApi.getTimeEntryHistory()` which returns the same shape:
   ```typescript
   { start_at: string, end_at: string, data: { date: string, value: number }[] }
   ```
3. `data` entries are mapped to `{ date: Date, value: number }` for LayerCake
4. LayerCake provides `xScale` (d3 `scaleTime`) and `yScale` (linear, from `yDomain`) via context
5. Each chart component reads `$data`, `$xGet`, `$yGet`, etc. from context and renders SVG elements

## Styling

Chart styles live in `src/styles/habits.css`:

- `.chart-container` — wrapper with top margin
- `.history-controls` — flex row containing frequency toggle and date inputs
- `.frequency-toggle` — segmented control with 3 icon buttons
- `.frequency-toggle button.active` — primary background for selected frequency
- `.history-dates` — date input pair with dash separator
