<script lang="ts">
	import Modal from './Modal.svelte';

	interface Props {
		open: boolean;
		onconfirm: () => void;
		oncancel: () => void;
		title?: string;
		message?: string;
		confirmLabel?: string;
		danger?: boolean;
	}

	let {
		open,
		onconfirm,
		oncancel,
		title = 'Confirmar',
		message = 'Esta acción no se puede deshacer.',
		confirmLabel = 'Eliminar',
		danger = true,
	}: Props = $props();
</script>

<Modal {open} onclose={oncancel}>
	<h3 class="modal-title">{title}</h3>
	<p class="confirm-message">{message}</p>
	<div class="detail-actions">
		<button class="btn-outline" onclick={oncancel}>Cancelar</button>
		<button class={danger ? 'btn-danger' : 'btn-primary'} onclick={onconfirm}>{confirmLabel}</button>
	</div>
</Modal>
