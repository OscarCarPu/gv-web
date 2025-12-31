import { SvelteDate } from "svelte/reactivity";

export type DateNavigation = ReturnType<typeof createDateNavigation>;

export function createDateNavigation(initialDate?: Date) {
  const date = new SvelteDate(initialDate ?? Date.now());

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
