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

export function amountSign(type: TransactionType): 'pos' | 'neg' | 'neu' {
	switch (type) {
		case 'income':
			return 'pos';
		case 'expense':
			return 'neg';
		case 'transfer':
			return 'neu';
	}
}
