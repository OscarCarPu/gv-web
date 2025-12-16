<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Button from '$lib/shared/components/Button.svelte';
  import HabitForm from '$lib/domains/habits/components/HabitForm.svelte';
  import { habitsApi } from '$lib/domains/habits/api/habits.api';
  import type {
    Habit,
    HabitLog,
    HabitHistory,
    UpdateHabitInput
  } from '$lib/domains/habits/types/Habit.types';

  let habit = $state<Habit | null>(null);
  let logs = $state<HabitLog[]>([]);
  let history = $state<HabitHistory | null>(null);
  let loading = $state(true);
  let error = $state('');
  let editing = $state(false);
  let logsPage = $state(1);
  let logsTotalPages = $state(1);

  const habitId = $derived(Number($page.params.id));

  async function loadHabit() {
    loading = true;
    error = '';
    try {
      habit = await habitsApi.getById(habitId);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load habit';
    } finally {
      loading = false;
    }
  }

  async function loadLogs() {
    try {
      const response = await habitsApi.getLogs(habitId, logsPage, 10);
      logs = response.items;
      logsTotalPages = response.total_pages;
    } catch {
      // Silently fail logs load
    }
  }

  async function loadHistory() {
    try {
      // Get last 30 days of history
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      history = await habitsApi.getHistory(habitId, startDate, endDate);
    } catch {
      // Silently fail history load
    }
  }

  async function updateHabit(data: UpdateHabitInput) {
    await habitsApi.update(habitId, data);
    editing = false;
    await loadHabit();
  }

  async function deleteHabit() {
    if (!confirm('Are you sure you want to delete this habit? This cannot be undone.')) return;
    try {
      await habitsApi.delete(habitId);
      goto('/habits');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete habit');
    }
  }

  async function deleteLog(logId: number) {
    if (!confirm('Delete this log entry?')) return;
    try {
      await habitsApi.deleteLog(habitId, logId);
      await loadLogs();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete log');
    }
  }

  onMount(() => {
    loadHabit();
    loadLogs();
    loadHistory();
  });

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  function getCompletionRate(periods: HabitHistory['periods']): number {
    if (!periods.length) return 0;
    const completed = periods.filter((p) => parseFloat(p.total_value) > 0).length;
    return Math.round((completed / periods.length) * 100);
  }
</script>

<svelte:head>
  <title>{habit?.name ?? 'Habit'} - Gestor Vida</title>
</svelte:head>

<div class="max-w-3xl mx-auto">
  <div class="mb-6">
    <a href="/habits" class="text-sm text-gray-500 hover:text-gray-700">
      <i class="fas fa-arrow-left mr-1"></i>
      Back to habits
    </a>
  </div>

  {#if loading}
    <div class="text-center py-12">
      <i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
      <p class="mt-2 text-gray-500">Loading habit...</p>
    </div>
  {:else if error}
    <div class="bg-red-50 text-red-600 p-4 rounded-lg">
      <p>{error}</p>
      <a href="/habits" class="mt-2 text-sm underline">Back to habits</a>
    </div>
  {:else if habit}
    {#if editing}
      <div class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-lg font-semibold mb-4">Edit Habit</h2>
        <HabitForm {habit} onSubmit={updateHabit} onCancel={() => (editing = false)} />
      </div>
    {:else}
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
              style="background-color: {habit.color}20; color: {habit.color}"
            >
              <i class={habit.icon}></i>
            </div>
            <div>
              <h1 class="text-2xl font-bold text-gray-900">{habit.name}</h1>
              {#if habit.description}
                <p class="text-gray-500 mt-1">{habit.description}</p>
              {/if}
            </div>
          </div>
          <div class="flex gap-2">
            <Button variant="secondary" size="sm" onclick={() => (editing = true)}>
              <i class="fas fa-edit mr-1"></i>
              Edit
            </Button>
            <Button variant="danger" size="sm" onclick={deleteHabit}>
              <i class="fas fa-trash mr-1"></i>
              Delete
            </Button>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div>
            <div class="text-sm text-gray-500">Type</div>
            <div class="font-medium capitalize">{habit.value_type}</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">Frequency</div>
            <div class="font-medium capitalize">{habit.frequency}</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">Required</div>
            <div class="font-medium">{habit.is_required ? 'Yes' : 'No'}</div>
          </div>
          <div>
            <div class="text-sm text-gray-500">Created</div>
            <div class="font-medium">{formatDate(habit.created_at)}</div>
          </div>
        </div>
      </div>

      {#if history && history.periods.length > 0}
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 class="text-lg font-semibold mb-4">Last 30 Days</h2>
          <div class="flex items-center gap-4 mb-4">
            <div class="text-3xl font-bold text-blue-500">
              {getCompletionRate(history.periods)}%
            </div>
            <div class="text-gray-500">completion rate</div>
          </div>
          <div class="flex flex-wrap gap-1">
            {#each history.periods as period}
              {@const completed = parseFloat(period.total_value) > 0}
              <div
                class="w-6 h-6 rounded {completed ? 'bg-green-500' : 'bg-gray-200'}"
                title="{formatDate(period.period_start)}: {period.total_value}"
              ></div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-lg font-semibold mb-4">Recent Logs</h2>
        {#if logs.length === 0}
          <p class="text-gray-500 text-center py-4">No logs yet</p>
        {:else}
          <div class="space-y-2">
            {#each logs as log (log.id)}
              <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div class="flex items-center gap-3">
                  <div class="text-sm text-gray-500">{formatDate(log.log_date)}</div>
                  <div class="font-medium">
                    {#if habit.value_type === 'boolean'}
                      {parseFloat(log.value) > 0 ? 'Completed' : 'Not completed'}
                    {:else}
                      {log.value} {habit.unit ?? ''}
                    {/if}
                  </div>
                </div>
                <button
                  onclick={() => deleteLog(log.id)}
                  class="text-gray-400 hover:text-red-500 text-sm"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            {/each}
          </div>

          {#if logsTotalPages > 1}
            <div class="flex justify-center gap-2 mt-4 pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                disabled={logsPage === 1}
                onclick={() => {
                  logsPage--;
                  loadLogs();
                }}
              >
                Previous
              </Button>
              <span class="px-2 py-1 text-sm text-gray-500">
                {logsPage} / {logsTotalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={logsPage === logsTotalPages}
                onclick={() => {
                  logsPage++;
                  loadLogs();
                }}
              >
                Next
              </Button>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  {/if}
</div>
