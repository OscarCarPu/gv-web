<script lang="ts">
	import Modal from '$lib/shared/components/Modal.svelte';
	import TimeInput from '$lib/shared/components/TimeInput.svelte';
	import { tasksApi } from '$lib/domains/tasks/api/tasks.api';
	import { planApi } from '$lib/domains/tasks/api/plan.api';
	import { addToast } from '$lib/shared/stores/toast.svelte';
	import { hhmmToISO, isoToHHmm, isValidHHmm } from '$lib/shared/utils/datetime';
	import type { TaskListItem } from '$lib/domains/tasks/types/Task.types';
	import type {
		CreatePlanBlockRequest,
		PlanBlockResponse,
	} from '$lib/domains/tasks/types/Plan.types';

	interface Props {
		open: boolean;
		block?: PlanBlockResponse | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let { open, block = null, onclose, onsaved }: Props = $props();

	let tasks = $state<TaskListItem[]>([]);
	let mode = $state<'task' | 'free'>('task');
	let taskId = $state<number | null>(null);
	let label = $state('');
	let startTime = $state('09:00');
	let endTime = $state('10:00');
	let note = $state('');
	let saving = $state(false);

	$effect(() => {
		if (!open) return;
		tasksApi.listTasksFast().then((t) => (tasks = t));
		if (block) {
			mode = block.task_id !== null ? 'task' : 'free';
			taskId = block.task_id;
			label = block.label;
			startTime = isoToHHmm(block.started_at);
			endTime = isoToHHmm(block.ended_at);
			note = block.note ?? '';
		} else {
			mode = 'task';
			taskId = null;
			label = '';
			startTime = defaultStart();
			endTime = defaultEnd();
			note = '';
		}
	});

	function defaultStart(): string {
		const d = new Date();
		const h = String(d.getHours()).padStart(2, '0');
		return `${h}:00`;
	}

	function defaultEnd(): string {
		const d = new Date();
		const h = String((d.getHours() + 1) % 24).padStart(2, '0');
		return `${h}:00`;
	}

	interface TaskGroup {
		label: string;
		tasks: TaskListItem[];
	}

	const grouped = $derived.by((): TaskGroup[] => {
		const map = new Map<number | null, TaskGroup>();
		for (const t of tasks) {
			const key = t.project_id;
			if (!map.has(key)) {
				map.set(key, { label: t.project_name ?? 'Sin proyecto', tasks: [] });
			}
			map.get(key)!.tasks.push(t);
		}
		return [...map.values()];
	});

	async function save() {
		if (saving) return;

		if (!isValidHHmm(startTime) || !isValidHHmm(endTime, true)) {
			addToast('Formato de hora inválido (HH:MM, fin admite 24:00)', 'error');
			return;
		}
		const startedAt = hhmmToISO(startTime);
		const endedAt = hhmmToISO(endTime);
		if (new Date(endedAt) <= new Date(startedAt)) {
			addToast('La hora final debe ser posterior a la inicial', 'error');
			return;
		}

		if (mode === 'task' && taskId === null) {
			addToast('Elige una tarea o cambia a tiempo libre', 'error');
			return;
		}
		if (mode === 'free' && label.trim() === '') {
			addToast('Escribe qué harás durante el tiempo libre', 'error');
			return;
		}

		saving = true;
		try {
			if (block) {
				await planApi.updateBlock(block.id, {
					started_at: startedAt,
					ended_at: endedAt,
					task_id: mode === 'task' ? taskId! : undefined,
					clear_task: mode === 'free',
					label: label.trim() || undefined,
					note: note.trim() ? note.trim() : undefined,
					clear_note: note.trim() === '',
				});
			} else {
				const payload: CreatePlanBlockRequest = {
					started_at: startedAt,
					ended_at: endedAt,
					task_id: mode === 'task' ? taskId : null,
					label: label.trim() || null,
					note: note.trim() || null,
				};
				await planApi.createBlock(payload);
			}
			onsaved();
			onclose();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Error al guardar';
			addToast(msg, 'error');
		} finally {
			saving = false;
		}
	}
</script>

<Modal {open} {onclose}>
	<div class="plan-editor">
		<h3 class="plan-editor-title">{block ? 'Editar bloque' : 'Nuevo bloque'}</h3>

		<div class="plan-editor-mode">
			<button class:active={mode === 'task'} onclick={() => (mode = 'task')}>Tarea</button>
			<button class:active={mode === 'free'} onclick={() => (mode = 'free')}>Tiempo libre</button>
		</div>

		<div class="plan-editor-times">
			<label>
				<span class="text-text-muted text-sm">Desde</span>
				<TimeInput bind:value={startTime} />
			</label>
			<label>
				<span class="text-text-muted text-sm">Hasta</span>
				<TimeInput bind:value={endTime} allowMidnight />
			</label>
		</div>

		{#if mode === 'task'}
			<label class="detail-field">
				<span class="text-text-muted text-sm font-medium">Tarea</span>
				<select
					bind:value={taskId}
					onchange={(e) => {
						const id = Number((e.target as HTMLSelectElement).value);
						const t = tasks.find((x) => x.id === id);
						if (t) label = t.name;
					}}
				>
					<option value={null}>Selecciona una tarea...</option>
					{#each grouped as g (g.label)}
						<optgroup label={g.label}>
							{#each g.tasks as t (t.id)}
								<option value={t.id}>{t.name}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</label>

			<label class="detail-field">
				<span class="text-text-muted text-sm font-medium">Etiqueta (opcional)</span>
				<input type="text" bind:value={label} placeholder="Por defecto el nombre de la tarea" />
			</label>
		{:else}
			<label class="detail-field">
				<span class="text-text-muted text-sm font-medium">Qué harás</span>
				<input type="text" bind:value={label} placeholder="comer, paseo, gym..." />
			</label>
		{/if}

		<label class="detail-field">
			<span class="text-text-muted text-sm font-medium">Nota (opcional)</span>
			<textarea bind:value={note} rows="2"></textarea>
		</label>

		<div class="plan-editor-actions">
			<button class="btn-outline" onclick={onclose} disabled={saving}>Cancelar</button>
			<button class="btn-primary" onclick={save} disabled={saving}>
				{block ? 'Guardar' : 'Crear'}
			</button>
		</div>
	</div>
</Modal>
