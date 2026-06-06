<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { HabitForm } from '$habits/habitForm.svelte';
	import type { HabitWithLog } from '$habits/types/Habit.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		habit?: HabitWithLog | null;
	}

	let { open, onclose, habit = null }: Props = $props();

	const form = new HabitForm(undefined, { onclose: () => onclose(), refresh: invalidateAll });

	$effect(() => {
		if (open) {
			form.loadFrom(habit);
		}
	});
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{habit ? 'Edit habit' : 'New habit'}</h3>

	<div class="detail-form">
		<div class="detail-field">
			<label for="habit-name">Name</label>
			<input
				id="habit-name"
				type="text"
				bind:value={form.name}
				maxlength={40}
				class:field-error={form.nameError}
				oninput={() => (form.nameError = false)}
			/>
		</div>

		<div class="detail-field">
			<label for="habit-description">Description</label>
			<textarea id="habit-description" bind:value={form.description} rows="2"></textarea>
		</div>

		<div class="detail-inline-row">
			<div class="detail-field flex-1">
				<label for="habit-frequency">Frequency</label>
				<select id="habit-frequency" bind:value={form.frequency}>
					<option value="daily">Daily</option>
					<option value="weekly">Weekly</option>
					<option value="monthly">Monthly</option>
				</select>
			</div>

			<div class="detail-field">
				<label for="habit-target-min">Min target</label>
				<input
					id="habit-target-min"
					type="number"
					min="0"
					step="any"
					bind:value={form.targetMin}
					class:field-error={form.targetError}
					oninput={() => (form.targetError = false)}
				/>
			</div>

			<div class="detail-field">
				<label for="habit-target-max">Max target</label>
				<input
					id="habit-target-max"
					type="number"
					min="0"
					step="any"
					bind:value={form.targetMax}
					class:field-error={form.targetError}
					oninput={() => (form.targetError = false)}
				/>
			</div>
		</div>

		<button
			class="start-now-toggle mr-auto"
			type="button"
			onclick={() => (form.recordingRequired = !form.recordingRequired)}
		>
			<div
				class="toggle toggle-sm"
				class:on={form.recordingRequired}
				class:off={!form.recordingRequired}
			>
				<div class="knob"></div>
			</div>
			Recording required
		</button>

		<div class="detail-actions">
			<button class="btn-primary" onclick={() => form.save()} disabled={form.saving}>
				{habit ? 'Save' : 'Create'}
			</button>
		</div>
	</div>
</BottomSheet>
