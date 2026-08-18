import { moneyApi } from '$lib/domains/money/api/money.api';
import { addToast } from '$lib/shared/stores/toast.svelte';
import { addNotification } from '$lib/shared/stores/notification.svelte';
import {
	buildCategoryOptions,
	collectDescendantIds,
	type CategoryOption,
} from '$lib/domains/money/utils/categoryTree';
import type {
	Category,
	CreateCategoryRequest,
	TransactionType,
	UpdateCategoryRequest,
} from '$lib/domains/money/types/Money.types';

interface CategoryFormApi {
	createCategory: (input: CreateCategoryRequest) => Promise<Category>;
	updateCategory: (id: number, input: UpdateCategoryRequest) => Promise<Category>;
}

interface CategoryFormCallbacks {
	/** Close the sheet (matches the component's `onclose` prop). */
	onclose: () => void;
	/** Revalidate page data after a mutation (the component passes `invalidateAll`). */
	refresh: () => Promise<void>;
}

/**
 * Owns `CategoryFormSheet`'s logic: the editable `$state` fields, create-vs-edit
 * seeding (`reset`), validation, and save (create / update then `invalidateAll`).
 * `categories` is injected as a getter so the controller reads live props; the
 * `parentOptions` getter excludes self + descendants (via `collectDescendantIds`)
 * to prevent cycles. The out-of-options cleanup stays as a component `$effect`
 * calling `clearParentIfInvalid()`.
 */
export class CategoryForm {
	// Injected (assigned in constructor; declared first so getters may reference them).
	#api: CategoryFormApi;
	#onclose: () => void;
	#refresh: () => Promise<void>;
	#getCategories: () => Category[];

	// The category currently being edited (null = create), set by `reset`.
	#category = $state<Category | null>(null);

	// Editable form fields (bound directly via `bind:` in the template).
	name = $state('');
	type = $state<TransactionType>('expense');
	parentId = $state<number | null>(null);

	// View-only flags.
	saving = $state(false);
	nameError = $state(false);

	constructor(
		getCategories: () => Category[],
		{ onclose, refresh }: CategoryFormCallbacks,
		api: CategoryFormApi = moneyApi
	) {
		this.#getCategories = getCategories;
		this.#onclose = onclose;
		this.#refresh = refresh;
		this.#api = api;
	}

	get category(): Category | null {
		return this.#category;
	}

	// ── derived options (getter: reactive when read in templates / effects) ──

	get parentOptions(): CategoryOption[] {
		const sameType = this.#getCategories().filter((c) => c.type === this.type);
		const category = this.#category;
		if (!category) return buildCategoryOptions(sameType);
		const banned = collectDescendantIds(sameType, category.id);
		return buildCategoryOptions(sameType.filter((c) => !banned.has(c.id)));
	}

	// ── seeding (mirrors the component's previous open $effect) ──────────────

	reset(category: Category | null): void {
		this.#category = category;
		this.name = category?.name ?? '';
		this.type = category?.type ?? 'expense';
		this.parentId = category?.parent_id ?? null;
		this.nameError = false;
	}

	/** Reset `parentId` when it is no longer in the (self/descendant-excluded) options. */
	clearParentIfInvalid(): void {
		if (this.parentId !== null && !this.parentOptions.some((c) => c.id === this.parentId)) {
			this.parentId = null;
		}
	}

	async save(): Promise<void> {
		if (!this.name.trim()) {
			this.nameError = true;
			return;
		}
		this.saving = true;
		try {
			const category = this.#category;
			if (category) {
				await this.#api.updateCategory(category.id, {
					name: this.name.trim(),
					type: this.type,
					parent_id: this.parentId,
				});
				addNotification('Category updated', 'success');
			} else {
				await this.#api.createCategory({
					name: this.name.trim(),
					type: this.type,
					parent_id: this.parentId ?? undefined,
				});
				addNotification('Category created', 'success');
			}
			this.#onclose();
			await this.#refresh();
		} catch {
			addToast('Error saving category', 'error');
		} finally {
			this.saving = false;
		}
	}
}
