import type { TransactionType } from '../types/Money.types';

export function getTypeLabel(type: TransactionType): string {
	switch (type) {
		case 'income':
			return 'Income';
		case 'expense':
			return 'Expense';
		case 'transfer':
			return 'Transfer';
	}
}

export function getTypeBadgeClass(type: TransactionType): string {
	switch (type) {
		case 'income':
			return 'finished';
		case 'expense':
			return 'expense';
		case 'transfer':
			return 'started';
	}
}

function amountSign(type: TransactionType): 'pos' | 'neg' | 'neu' {
	switch (type) {
		case 'income':
			return 'pos';
		case 'expense':
			return 'neg';
		case 'transfer':
			return 'neu';
	}
}

/** Display prefix for a signed amount: `+` for income, `−` for expense, `''` for transfer. */
export function amountPrefix(type: TransactionType): string {
	const s = amountSign(type);
	return s === 'pos' ? '+' : s === 'neg' ? '−' : '';
}

/** CSS class for a signed amount value. */
export function amountClass(type: TransactionType): string {
	const s = amountSign(type);
	return s === 'pos' ? 'amount-positive' : s === 'neg' ? 'amount-negative' : 'amount-neutral';
}
