<script lang="ts">
  import Button from '$lib/shared/components/Button.svelte';
  import type { Habit, CreateHabitInput, ValueType, TargetFrequency } from '../types/Habit.types';

  interface Props {
    habit?: Habit;
    onSubmit: (data: CreateHabitInput) => Promise<void>;
    onCancel: () => void;
  }

  let { habit, onSubmit, onCancel }: Props = $props();

  let name = $state(habit?.name ?? '');
  let description = $state(habit?.description ?? '');
  let value_type = $state<ValueType>(habit?.value_type ?? 'boolean');
  let frequency = $state<TargetFrequency>(habit?.frequency ?? 'daily');
  let color = $state(habit?.color ?? '#3B82F6');
  let icon = $state(habit?.icon ?? 'fas fa-check');
  let is_required = $state(habit?.is_required ?? true);
  let submitting = $state(false);
  let error = $state('');

  const icons = [
    'fas fa-check',
    'fas fa-times',
    'fas fa-calendar',
    'fas fa-clock',
    'fas fa-bell',
    'fas fa-plus',
    'fas fa-minus',
    'fas fa-edit',
    'fas fa-info',
    'fas fa-question'
  ];

  const colors = [
    '#3B82F6',
    '#8B5CF6',
    '#EC4899',
    '#EF4444',
    '#F97316',
    '#EAB308',
    '#22C55E',
    '#14B8A6',
    '#06B6D4',
    '#6366F1'
  ];

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (submitting) return;

    error = '';
    submitting = true;

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        value_type,
        frequency,
        color,
        icon,
        is_required
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      submitting = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="space-y-4">
  {#if error}
    <div class="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
  {/if}

  <div>
    <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
    <input
      id="name"
      type="text"
      bind:value={name}
      required
      maxlength="25"
      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      placeholder="e.g., Exercise"
    />
  </div>

  <div>
    <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
      Description (optional)
    </label>
    <textarea
      id="description"
      bind:value={description}
      maxlength="500"
      rows="2"
      class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      placeholder="What is this habit about?"
    ></textarea>
  </div>

  <div class="grid grid-cols-2 gap-4">
    <div>
      <label for="value_type" class="block text-sm font-medium text-gray-700 mb-1">Type</label>
      <select
        id="value_type"
        bind:value={value_type}
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="boolean">Yes/No</option>
        <option value="numeric">Numeric</option>
      </select>
    </div>

    <div>
      <label for="frequency" class="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
      <select
        id="frequency"
        bind:value={frequency}
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
    </div>
  </div>

  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">Color</label>
    <div class="flex flex-wrap gap-2">
      {#each colors as c}
        <button
          type="button"
          onclick={() => (color = c)}
          class="w-8 h-8 rounded-full border-2 transition-transform {color === c
            ? 'scale-110 border-gray-800'
            : 'border-transparent hover:scale-105'}"
          style="background-color: {c}"
        ></button>
      {/each}
    </div>
  </div>

  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">Icon</label>
    <div class="flex flex-wrap gap-2">
      {#each icons as i}
        <button
          type="button"
          onclick={() => (icon = i)}
          class="w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-colors {icon ===
          i
            ? 'border-blue-500 bg-blue-50 text-blue-600'
            : 'border-gray-200 hover:border-gray-300'}"
        >
          <i class={i}></i>
        </button>
      {/each}
    </div>
  </div>

  <div class="flex items-center gap-2">
    <input
      type="checkbox"
      id="is_required"
      bind:checked={is_required}
      class="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
    />
    <label for="is_required" class="text-sm text-gray-700">
      Required (missing days break streak)
    </label>
  </div>

  <div class="flex gap-3 pt-2">
    <Button type="submit" disabled={submitting || !name.trim()}>
      {#if submitting}
        Saving...
      {:else}
        {habit ? 'Update' : 'Create'} Habit
      {/if}
    </Button>
    <Button type="button" variant="secondary" onclick={onCancel}>Cancel</Button>
  </div>
</form>
