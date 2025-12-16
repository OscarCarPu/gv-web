<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Button from '$lib/shared/components/Button.svelte';
  import HabitForm from '$lib/domains/habits/components/HabitForm.svelte';
  import { habitsApi } from '$lib/domains/habits/api/habits.api';
  import type { Habit, CreateHabitInput } from '$lib/domains/habits/types/Habit.types';

  let habits = $state<Habit[]>([]);
  let loading = $state(true);
  let error = $state('');
  let showForm = $state(false);
  let page = $state(1);
  let totalPages = $state(1);

  async function loadHabits() {
    loading = true;
    error = '';
    try {
      const response = await habitsApi.getAll(page, 20);
      habits = response.items;
      totalPages = response.total_pages;
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

  async function deleteHabit(id: number) {
    if (!confirm('Are you sure you want to delete this habit?')) return;
    try {
      await habitsApi.delete(id);
      await loadHabits();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete habit');
    }
  }

  onMount(loadHabits);
</script>

<svelte:head>
  <title>All Habits - Gestor Vida</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">All Habits</h1>
      <p class="text-gray-500">Manage your habits</p>
    </div>
    {#if !showForm}
      <Button onclick={() => (showForm = true)}>
        <i class="fas fa-plus mr-2"></i>
        New Habit
      </Button>
    {/if}
  </div>

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
      <i class="fas fa-list text-4xl text-gray-300"></i>
      <h2 class="mt-4 text-lg font-medium text-gray-900">No habits yet</h2>
      <p class="mt-1 text-gray-500">Create your first habit to get started</p>
      <div class="mt-4">
        <Button onclick={() => (showForm = true)}>Create Habit</Button>
      </div>
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="text-left px-4 py-3 text-sm font-medium text-gray-500">Habit</th>
            <th class="text-left px-4 py-3 text-sm font-medium text-gray-500">Type</th>
            <th class="text-left px-4 py-3 text-sm font-medium text-gray-500">Frequency</th>
            <th class="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each habits as habit (habit.id)}
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3">
                <a href="/habits/{habit.id}" class="flex items-center gap-3 hover:text-blue-600">
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center"
                    style="background-color: {habit.color}20; color: {habit.color}"
                  >
                    <i class={habit.icon}></i>
                  </div>
                  <div>
                    <div class="font-medium text-gray-900">{habit.name}</div>
                    {#if habit.description}
                      <div class="text-sm text-gray-500 truncate max-w-xs">{habit.description}</div>
                    {/if}
                  </div>
                </a>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 capitalize">{habit.value_type}</td>
              <td class="px-4 py-3 text-sm text-gray-600 capitalize">{habit.frequency}</td>
              <td class="px-4 py-3 text-right">
                <a
                  href="/habits/{habit.id}"
                  class="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3"
                >
                  View
                </a>
                <button
                  onclick={() => deleteHabit(habit.id)}
                  class="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Delete
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="flex justify-center gap-2 mt-6">
        <Button
          variant="secondary"
          size="sm"
          disabled={page === 1}
          onclick={() => {
            page--;
            loadHabits();
          }}
        >
          Previous
        </Button>
        <span class="px-4 py-2 text-sm text-gray-600">Page {page} of {totalPages}</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page === totalPages}
          onclick={() => {
            page++;
            loadHabits();
          }}
        >
          Next
        </Button>
      </div>
    {/if}
  {/if}
</div>
