# Svelte 5 Reactivity Guide

This document explains how reactivity works in Svelte 5 using **runes** - the new primitives that replaced Svelte 4's compiler-based reactivity.

## Table of Contents
- [Overview](#overview)
- [The Three Core Runes](#the-three-core-runes)
- [How It Works Under the Hood](#how-it-works-under-the-hood)
- [Deep Reactivity & Proxies](#deep-reactivity--proxies)
- [Common Pitfalls & Gotchas](#common-pitfalls--gotchas)
- [Passing Data Between Components](#passing-data-between-components)
- [Best Practices](#best-practices)

---

## Overview

Svelte 5 introduces **runes** - special primitives marked with a `$` prefix that enable fine-grained reactivity. Unlike Svelte 4's implicit reactivity (where `let` was automatically reactive), Svelte 5 requires explicit declarations.

```svelte
<!-- Svelte 4 (implicit) -->
<script>
  let count = 0; // automatically reactive
</script>

<!-- Svelte 5 (explicit) -->
<script>
  let count = $state(0); // explicitly reactive
</script>
```

**Key benefit**: Reactivity now works outside of `.svelte` files (in `.svelte.ts` or `.svelte.js` files).

---

## The Three Core Runes

### 1. `$state` - Reactive State

Creates reactive state that triggers UI updates when changed.

```ts
let count = $state(0);
let user = $state({ name: 'John', age: 30 });
let items = $state(['a', 'b', 'c']);

// Direct access - no .value or getter needed
console.log(count); // 0
count = 5; // triggers update
```

**Key points:**
- Access values directly (not like Vue's `.value` or React's setState)
- Objects and arrays are deeply reactive via Proxies
- Changes trigger automatic UI updates

### 2. `$derived` - Computed Values

Computes values that depend on reactive state. Automatically updates when dependencies change.

```ts
let count = $state(0);
let doubled = $derived(count * 2);
let isEven = $derived(count % 2 === 0);

// For complex logic:
let summary = $derived.by(() => {
  if (count > 10) return 'high';
  if (count > 5) return 'medium';
  return 'low';
});
```

**Key points:**
- **Lazy evaluation**: Only computed when actually read
- **Memoized**: Cached until dependencies change
- **No side effects**: Should be pure functions

### 3. `$effect` - Side Effects

Runs code when component mounts and when dependencies change.

```ts
let count = $state(0);

$effect(() => {
  console.log('Count changed to:', count);
  // Runs after mount, and whenever count changes
});

// With cleanup:
$effect(() => {
  const interval = setInterval(() => console.log(count), 1000);

  return () => {
    clearInterval(interval); // cleanup before re-run or unmount
  };
});
```

**Key points:**
- Runs after DOM updates (in a microtask)
- Only runs in browser, not during SSR
- Multiple state changes are batched into single re-run

---

## How It Works Under the Hood

Svelte 5 uses **signals** internally (similar to SolidJS, Preact Signals).

### Push-Pull Reactivity

1. **Push**: When state changes, all dependents are notified immediately
2. **Pull**: But derived values aren't recalculated until actually read

```
$state changes → Dependents notified (push) → $derived recomputed on access (pull)
```

### Dependency Tracking

Svelte automatically tracks which reactive values are read **synchronously** inside `$effect` or `$derived`:

```ts
$effect(() => {
  // These are tracked as dependencies:
  console.log(count);      // tracked
  console.log(user.name);  // tracked
  someFunction(items);     // tracked (if someFunction reads items)

  // These are NOT tracked:
  setTimeout(() => {
    console.log(count);    // NOT tracked (async)
  }, 1000);

  await fetch('/api');
  console.log(count);      // NOT tracked (after await)
});
```

---

## Deep Reactivity & Proxies

### Objects and Arrays

When you pass objects/arrays to `$state`, Svelte wraps them in a **Proxy**:

```ts
let user = $state({ name: 'John', age: 30 });

user.name = 'Jane';  // triggers update (proxy intercepts this)
user.age++;          // triggers update

let items = $state([1, 2, 3]);
items.push(4);       // triggers update
items[0] = 10;       // triggers update
```

### What Gets Proxied

| Type | Deeply Reactive? |
|------|-----------------|
| Plain objects `{}` | Yes |
| Arrays `[]` | Yes |
| Class instances | **No** |
| `Map`, `Set` | **No** (use `SvelteMap`, `SvelteSet`) |
| `Date` | **No** (use `SvelteDate`) |

### Class Fields

Classes are NOT automatically proxied. Use `$state` on individual fields:

```ts
class Counter {
  count = $state(0);  // reactive

  increment() {
    this.count++;
  }
}

let counter = new Counter();
// counter.count is reactive
```

### `$state.raw` - Opt Out of Deep Reactivity

For large data you won't mutate:

```ts
let bigData = $state.raw(fetchedData);

// Mutations won't trigger updates:
bigData.items.push(x);  // NO update

// Must reassign entirely:
bigData = { ...bigData, items: [...bigData.items, x] };  // triggers update
```

---

## Common Pitfalls & Gotchas

### 1. Destructuring Breaks Reactivity

```ts
let user = $state({ name: 'John', age: 30 });

// BAD - loses reactivity
let { name, age } = user;
console.log(name);  // 'John' forever, won't update

// GOOD - keep the reference
console.log(user.name);  // always current value
```

### 2. Async Code Isn't Tracked

```ts
$effect(() => {
  // Only this is tracked:
  const currentCount = count;

  // After await, nothing is tracked:
  await fetch('/api');
  console.log(count);  // NOT a dependency
});
```

**Solution**: Read all dependencies synchronously before async code:

```ts
$effect(() => {
  const currentCount = count;  // tracked
  const currentUser = user.name;  // tracked

  fetch(`/api?count=${currentCount}`).then(...);
});
```

### 3. Conditional Dependencies

Effects only track what was read in the **last execution**:

```ts
$effect(() => {
  if (showDetails) {
    console.log(details);  // only tracked when showDetails is true
  }
});
```

### 4. Props and Reactivity

Props are reactive, but be careful with how you use them:

```svelte
<script>
  let { data } = $props();

  // BAD - captures initial value only
  let items = $state(data.items);  // won't update when data changes

  // GOOD - derived stays in sync
  let items = $derived(data.items);

  // GOOD - for local mutations, copy explicitly
  let localItems = $state([...data.items]);
</script>
```

### 5. Passing Reactive Objects Between Components

**Problem**: Passing a reactive object as a prop doesn't automatically make the child reactive to internal changes.

```svelte
<!-- Parent -->
<script>
  const state = createSomeState();  // plain object with SvelteDate inside
</script>
<Child {state} />

<!-- Child's $effect might not see changes to state internals -->
```

**Solution**: Use callbacks instead of shared mutable state:

```svelte
<!-- Parent -->
<Child onSomethingChange={(value) => handleChange(value)} />

<!-- Child -->
<script>
  let { onSomethingChange } = $props();

  function doSomething() {
    // ... do work ...
    onSomethingChange?.(result);  // explicit communication
  }
</script>
```

### 6. `#each` Without Keys

Without keys, Svelte reuses DOM elements by index:

```svelte
<!-- BAD - components may not update when array contents change -->
{#each items as item}
  <Item {item} />
{/each}

<!-- GOOD - forces proper updates -->
{#each items as item (item.id)}
  <Item {item} />
{/each}
```

---

## Passing Data Between Components

### Option 1: Props (Parent → Child)

```svelte
<!-- Parent -->
<Child name={user.name} count={count} />

<!-- Child -->
<script>
  let { name, count } = $props();
</script>
```

### Option 2: Callbacks (Child → Parent)

```svelte
<!-- Parent -->
<Child onUpdate={(val) => count = val} />

<!-- Child -->
<script>
  let { onUpdate } = $props();
</script>
<button onclick={() => onUpdate(5)}>Set to 5</button>
```

### Option 3: Bindable Props (Two-way)

```svelte
<!-- Parent -->
<Child bind:value={count} />

<!-- Child -->
<script>
  let { value = $bindable() } = $props();
</script>
<input bind:value />
```

### Option 4: Shared State File (`.svelte.ts`)

```ts
// stores/counter.svelte.ts
let count = $state(0);

export function getCount() {
  return count;
}

export function increment() {
  count++;
}
```

```svelte
<!-- Any component -->
<script>
  import { getCount, increment } from './stores/counter.svelte';
</script>

<button onclick={increment}>{getCount()}</button>
```

---

## Best Practices

### Do:
- Use `$derived` for computed values (not `$effect`)
- Add keys to `#each` loops
- Use callbacks for child → parent communication
- Read all dependencies synchronously before async code
- Use `$state.raw` for large, immutable data

### Don't:
- Destructure reactive objects if you need reactivity
- Use `$effect` to sync state (use `$derived` instead)
- Expect class instances to be deeply reactive
- Mutate props directly (use `$bindable` or callbacks)
- Forget cleanup functions in `$effect`

---

## Quick Reference

| Rune | Purpose | Returns |
|------|---------|---------|
| `$state(value)` | Create reactive state | Reactive proxy |
| `$state.raw(value)` | Non-deep reactive state | Plain value |
| `$derived(expr)` | Computed value | Reactive value |
| `$derived.by(fn)` | Complex computed | Reactive value |
| `$effect(fn)` | Side effects | void |
| `$props()` | Component props | Props object |
| `$bindable()` | Two-way prop binding | Bindable prop |

---

## Resources

- [Official $state docs](https://svelte.dev/docs/svelte/$state)
- [Official $derived docs](https://svelte.dev/docs/svelte/$derived)
- [Official $effect docs](https://svelte.dev/docs/svelte/$effect)
- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [Fine-Grained Reactivity in Svelte 5](https://frontendmasters.com/blog/fine-grained-reactivity-in-svelte-5/)
