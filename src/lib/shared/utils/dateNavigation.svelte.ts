import { SvelteDate } from 'svelte/reactivity';

export function createDateNavigation(initialDate?: Date) {
	const date = new SvelteDate(initialDate ?? Date.now());

	const formatter = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});

	return {
		get formatted() {
			return formatter.format(date);
		},

		get current() {
			return date;
		},

		set current(newDate: Date) {
			date.setTime(newDate.getTime());
		},

		returnToday() {
			date.setTime(Date.now());
		},

		subOneDay() {
			date.setDate(date.getDate() - 1);
		},

		addOneDay() {
			date.setDate(date.getDate() + 1);
		},
	};
}
