<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BottomSheet from '$lib/shared/components/BottomSheet.svelte';
	import { habitsApi } from '$habits/api/habits.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { addNotification } from '$lib/shared/stores/notification.svelte';
	import type { HabitWithLog } from '$habits/types/Habit.types';

	interface Props {
		open: boolean;
		onclose: () => void;
		habit?: HabitWithLog | null;
	}

	let { open, onclose, habit = null }: Props = $props();

	let name = $state('');
	let description = $state('');
	let frequency = $state<'daily' | 'weekly' | 'monthly'>('daily');
	let targetMin: number | null = $state(null);
	let targetMax: number | null = $state(null);
	let recordingRequired = $state(true);
	let saving = $state(false);
	let nameError = $state(false);
	let targetError = $state(false);

	$effect(() => {
		if (open) {
			name = habit?.name ?? '';
			description = habit?.description ?? '';
			frequency = (habit?.frequency as 'daily' | 'weekly' | 'monthly') ?? 'daily';
			targetMin = habit?.target_min ?? null;
			targetMax = habit?.target_max ?? null;
			recordingRequired = habit?.recording_required ?? true;
			nameError = false;
			targetError = false;
		}
	});

	async function save() {
		if (!name.trim()) {
			nameError = true;
			return;
		}
		const min = targetMin;
		const max = targetMax;
		if (min !== null && min < 0) {
			targetError = true;
			return;
		}
		if (max !== null && max < 0) {
			targetError = true;
			return;
		}
		if (min !== null && max !== null && min > max) {
			targetError = true;
			return;
		}

		saving = true;
		try {
			if (habit) {
				await habitsApi.updateHabit(habit.id, {
					name: name.trim(),
					description: description.trim() || null,
					frequency,
					target_min: min,
					target_max: max,
					recording_required: recordingRequired,
				});
				addNotification('Hábito actualizado', 'success');
			} else {
				await habitsApi.createHabit({
					name: name.trim(),
					description: description.trim() || null,
					frequency,
					target_min: min,
					target_max: max,
					recording_required: recordingRequired,
				});
				addNotification('Hábito creado', 'success');
			}
			onclose();
			await invalidateAll();
		} catch {
			addToast('Error al guardar el hábito', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet {open} {onclose} constrained>
	<h3 class="modal-title">{habit ? 'Editar hábito' : 'Nuevo hábito'}</h3>

	<div class="detail-form">
		<div class="detail-field">
			<label for="habit-name">Nombre</label>
			<input
				id="habit-name"
				type="text"
				bind:value={name}
				maxlength={40}
				class:field-error={nameError}
				oninput={() => (nameError = false)}
			/>
		</div>

		<div class="detail-field">
			<label for="habit-description">Descripción</label>
			<textarea id="habit-description" bind:value={description} rows="2"></textarea>
		</div>

		<div class="detail-inline-row">
			<div class="detail-field flex-1">
				<label for="habit-frequency">Frecuencia</label>
				<select id="habit-frequency" bind:value={frequency}>
					<option value="daily">Diaria</option>
					<option value="weekly">Semanal</option>
					<option value="monthly">Mensual</option>
				</select>
			</div>

			<div class="detail-field">
				<label for="habit-target-min">Objetivo mín</label>
				<input
					id="habit-target-min"
					type="number"
					min="0"
					step="any"
					bind:value={targetMin}
					class:field-error={targetError}
					oninput={() => (targetError = false)}
				/>
			</div>

			<div class="detail-field">
				<label for="habit-target-max">Objetivo máx</label>
				<input
					id="habit-target-max"
					type="number"
					min="0"
					step="any"
					bind:value={targetMax}
					class:field-error={targetError}
					oninput={() => (targetError = false)}
				/>
			</div>
		</div>

		<button
			class="start-now-toggle mr-auto"
			type="button"
			onclick={() => (recordingRequired = !recordingRequired)}
		>
			<div class="toggle toggle-sm" class:on={recordingRequired} class:off={!recordingRequired}>
				<div class="knob"></div>
			</div>
			Requiere registro
		</button>

		<div class="detail-actions">
			<button class="btn-primary" onclick={save} disabled={saving}>
				{habit ? 'Guardar' : 'Crear'}
			</button>
		</div>
	</div>
</BottomSheet>
