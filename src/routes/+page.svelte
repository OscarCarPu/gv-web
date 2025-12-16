<script lang="ts">
  import { onMount } from 'svelte';
  import HabitCard from '$lib/domains/habits/components/HabitCard.svelte';
  import HabitForm from '$lib/domains/habits/components/HabitForm.svelte';
  import Button from '$lib/shared/components/Button.svelte';
  import { habitsApi } from '$lib/domains/habits/api/habits.api';
  import type { HabitTodayStats, CreateHabitInput } from '$lib/domains/habits/types/Habit.types';

  let habits = $state<HabitTodayStats[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showForm = $state(false);

  async function loadHabits() {
    loading = true;
    error = '';
    try {
      habits = await habitsApi.getToday();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load habits';
    } finally {
      loading = false;
    }
  }

  async function createHabit(data: CreateHabitInput) {
    await habitsApi.create(data);
    showForm = false;
    await loadHabits();
  }

  onMount(loadHabits);

  const completedCount = $derived(
    habits.filter((h) => h.current_period_value !== null && parseFloat(h.current_period_value) > 0)
      .length
  );

  const totalStreak = $derived(habits.reduce((sum, h) => sum + h.current_streak, 0));

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
</script>

<svelte:head>
  <title>Today - Gestor Vida</title>
</svelte:head>

<div class="max-w-2xl mx-auto">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Today</h1>
    <p class="text-gray-500">{formatDate(new Date())}</p>
  </div>

  {#if !loading && habits.length > 0}
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <div class="text-2xl font-bold text-blue-500">{completedCount}/{habits.length}</div>
        <div class="text-sm text-gray-500">Completed</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <div class="text-2xl font-bold text-green-500">
          {habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0}%
        </div>
        <div class="text-sm text-gray-500">Progress</div>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <div class="text-2xl font-bold text-orange-500">{totalStreak}</div>
        <div class="text-sm text-gray-500">Total Streak</div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="text-center py-12">
      <i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
      <p class="mt-2 text-gray-500">Loading habits...</p>
    </div>
  {:else if error}
    <div class="bg-red-50 text-red-600 p-4 rounded-lg">
      <p>{error}</p>
      <button onclick={loadHabits} class="mt-2 text-sm underline">Try again</button>
    </div>
  {:else if showForm}
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-lg font-semibold mb-4">New Habit</h2>
      <HabitForm onSubmit={createHabit} onCancel={() => (showForm = false)} />
    </div>
  {:else if habits.length === 0}
    <div class="text-center py-12 bg-white rounded-lg shadow">
      <i class="fas fa-seedling text-4xl text-gray-300"></i>
      <h2 class="mt-4 text-lg font-medium text-gray-900">No habits yet</h2>
      <p class="mt-1 text-gray-500">Start building better habits today</p>
      <div class="mt-4">
        <Button onclick={() => (showForm = true)}>Create Your First Habit</Button>
      </div>
    </div>
  {:else}
    <div class="space-y-3">
      {#each habits as habit (habit.id)}
        <HabitCard {habit} onLogged={loadHabits} />
      {/each}
    </div>

    <div class="mt-6 text-center">
      <Button variant="secondary" onclick={() => (showForm = true)}>
        <i class="fas fa-plus mr-2"></i>
        Add Habit
      </Button>
    </div>
  {/if}
</div>
