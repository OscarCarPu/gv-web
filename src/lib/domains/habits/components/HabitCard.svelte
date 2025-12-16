<script lang="ts">
  import type { HabitTodayStats } from '../types/Habit.types';
  import { habitsApi } from '../api/habits.api';

  interface Props {
    habit: HabitTodayStats;
    onLogged?: () => void;
  }

  let { habit, onLogged }: Props = $props();
  let logging = $state(false);
  let value = $state('');

  const isCompleted = $derived(
    habit.current_period_value !== null && parseFloat(habit.current_period_value) > 0
  );

  function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  async function toggleBoolean() {
    if (logging) return;
    logging = true;
    try {
      const newValue = isCompleted ? '0' : '1';
      await habitsApi.upsertLog(habit.id, {
        log_date: getTodayDate(),
        value: newValue
      });
      onLogged?.();
    } catch {
      // Handle error silently
    } finally {
      logging = false;
    }
  }

  async function logNumericValue() {
    if (logging || !value) return;
    logging = true;
    try {
      const currentValue = parseFloat(habit.current_period_value || '0');
      const newValue = currentValue + parseFloat(value);
      await habitsApi.upsertLog(habit.id, {
        log_date: getTodayDate(),
        value: String(newValue)
      });
      value = '';
      onLogged?.();
    } catch {
      // Handle error silently
    } finally {
      logging = false;
    }
  }
</script>

<div
  class="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow border-l-4"
  style="border-left-color: {habit.color}"
>
  <div class="flex items-start justify-between">
    <div class="flex-1">
      <div class="flex items-center gap-2">
        <i class="{habit.icon} text-lg" style="color: {habit.color}"></i>
        <a href="/habits/{habit.id}" class="text-lg font-semibold text-gray-900 hover:text-blue-600">
          {habit.name}
        </a>
      </div>

      <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
        <span class="capitalize">{habit.frequency}</span>
        <span class="font-medium text-orange-500">
          {habit.current_streak} day streak
        </span>
      </div>
    </div>

    {#if habit.value_type === 'boolean'}
      <button
        onclick={toggleBoolean}
        disabled={logging}
        class="w-10 h-10 rounded-full flex items-center justify-center transition-colors {isCompleted
          ? 'bg-green-500 text-white'
          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}"
      >
        {#if logging}
          <i class="fas fa-spinner fa-spin"></i>
        {:else if isCompleted}
          <i class="fas fa-check"></i>
        {:else}
          <i class="far fa-circle"></i>
        {/if}
      </button>
    {:else}
      <div class="flex items-center gap-2">
        {#if habit.current_period_value}
          <span class="text-sm font-medium text-green-600">
            {habit.current_period_value}{habit.unit ? ` ${habit.unit}` : ''}{habit.target_value ? ` / ${habit.target_value}${habit.unit ? ` ${habit.unit}` : ''}` : ''}
          </span>
        {/if}
        <input
          type="number"
          bind:value
          placeholder="0"
          class="w-16 px-2 py-1 text-sm border rounded"
        />
        <button
          onclick={logNumericValue}
          disabled={logging || !value}
          class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {#if logging}
            <i class="fas fa-spinner fa-spin"></i>
          {:else}
            +
          {/if}
        </button>
      </div>
    {/if}
  </div>

  <div class="mt-3 flex items-center gap-4 text-xs text-gray-400">
    <span>Best: {habit.longest_streak} days</span>
    <span>Avg: {parseFloat(habit.average_completion_rate).toFixed(0)}%</span>
  </div>
</div>
