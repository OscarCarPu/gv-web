<script lang="ts">
	import type { LightInfo, LightState } from './api/lights.schemas';
	import type { LightsController } from './lights.svelte';
	import { PRESETS, fromHex, glowColor, toCss, toHex } from './color';

	interface Props {
		state: LightState;
		info: LightInfo;
		controller: LightsController;
	}

	let { state, info, controller }: Props = $props();

	const busy = $derived(controller.busy[state.id] ?? false);
	const glow = $derived(toCss(glowColor(state)));
	const hex = $derived(toHex(state.color));

	// Only one mode is meaningful on a bulb that does a single thing, so the toggle
	// only appears when there is actually a choice to make.
	const hasBothModes = $derived(info.supportsColor && info.supportsColorTemp);

	function isPreset(preset: { r: number; g: number; b: number }): boolean {
		return (
			state.mode === 'color' &&
			Math.abs(preset.r - state.color.r) < 6 &&
			Math.abs(preset.g - state.color.g) < 6 &&
			Math.abs(preset.b - state.color.b) < 6
		);
	}
</script>

<section
	class="light-card"
	class:is-on={state.power && state.online}
	class:is-offline={!state.online}
	style="--light-glow: {glow}"
>
	<div class="light-head">
		<div>
			<div class="light-title">
				<span
					class="light-dot"
					class:is-online={state.online}
					class:is-offline={!state.online}
					title={state.online ? 'Connected' : 'Unreachable'}
				></span>
				<h2>{state.name}</h2>
			</div>
			<p class="light-model">{state.model}</p>
		</div>

		<button
			type="button"
			class="light-switch"
			class:is-on={state.power}
			disabled={busy}
			aria-pressed={state.power}
			aria-label="{state.power ? 'Turn off' : 'Turn on'} {state.name}"
			onclick={() => controller.togglePower(state.id)}
		></button>
	</div>

	<div class="light-controls" class:is-off={!state.power}>
		<div class="light-field">
			<div class="light-field-head">
				<span class="light-field-label">Brightness</span>
				<span class="light-field-value">{Math.round(state.brightness)}%</span>
			</div>
			<input
				type="range"
				class="light-slider is-brightness"
				min="0"
				max="100"
				step="1"
				value={state.brightness}
				aria-label="{state.name} brightness"
				oninput={(e) => controller.setBrightness(state.id, Number(e.currentTarget.value))}
			/>
		</div>

		{#if hasBothModes}
			<div class="light-mode-toggle">
				<button
					type="button"
					class:active={state.mode === 'color'}
					onclick={() => controller.setMode(state.id, 'color')}>Color</button
				>
				<button
					type="button"
					class:active={state.mode === 'white'}
					onclick={() => controller.setMode(state.id, 'white')}>White</button
				>
			</div>
		{/if}

		{#if info.supportsColor && (!hasBothModes || state.mode === 'color')}
			<div class="light-field">
				<div class="light-field-head">
					<span class="light-field-label">Color</span>
					<span class="light-field-value">{hex.toUpperCase()}</span>
				</div>
				<div class="light-swatches">
					{#each PRESETS as preset (preset.name)}
						<button
							type="button"
							class="light-swatch"
							class:active={isPreset(preset.color)}
							style="background: {toCss(preset.color)}"
							title={preset.name}
							aria-label={preset.name}
							onclick={() => controller.setColor(state.id, preset.color)}
						></button>
					{/each}
					<input
						type="color"
						class="light-color-input"
						value={hex}
						aria-label="{state.name} custom color"
						oninput={(e) => controller.setColor(state.id, fromHex(e.currentTarget.value))}
					/>
				</div>
			</div>
		{/if}

		{#if info.supportsColorTemp && (!hasBothModes || state.mode === 'white')}
			<div class="light-field">
				<div class="light-field-head">
					<span class="light-field-label">Temperature</span>
					<span class="light-field-value">{Math.round(state.colorTemp)}K</span>
				</div>
				<input
					type="range"
					class="light-slider is-temp"
					min={info.minColorTemp}
					max={info.maxColorTemp}
					step="50"
					value={state.colorTemp}
					aria-label="{state.name} color temperature"
					oninput={(e) => controller.setColorTemp(state.id, Number(e.currentTarget.value))}
				/>
			</div>
		{/if}
	</div>

	{#if state.error}
		<p class="light-error">{state.error}</p>
	{/if}
</section>
