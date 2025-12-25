import { page } from "$app/state";
import { SvelteDate } from "svelte/reactivity";

export function createDateNavigation() {
  const dateParam = page.url.searchParams.get('date');
  const date = new SvelteDate(dateParam ?? Date.now());

  const formatter = new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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
    }
  };
}
