import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/state', () => ({
  page: {
    url: new URL('http://localhost')
  }
}));

describe('createDateNavigation', () => {
  let dateNavigation: ReturnType<typeof import('$shared/utils/dateNavigation.svelte').createDateNavigation>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-12-26T12:00:00'));

    const module = await import('$shared/utils/dateNavigation.svelte');
    dateNavigation = module.createDateNavigation();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('should format the current date in Spanish', () => {
    expect(dateNavigation.formatted).toBe('jueves, 26 de diciembre de 2024');
  });

  it('should return the current date', () => {
    const current = dateNavigation.current;
    expect(current.getFullYear()).toBe(2024);
    expect(current.getMonth()).toBe(11);
    expect(current.getDate()).toBe(26);
  });

  it('should subtract one day', () => {
    dateNavigation.subOneDay();
    expect(dateNavigation.current.getDate()).toBe(25);
    expect(dateNavigation.formatted).toBe('miércoles, 25 de diciembre de 2024');
  });

  it('should add one day', () => {
    dateNavigation.addOneDay();
    expect(dateNavigation.current.getDate()).toBe(27);
    expect(dateNavigation.formatted).toBe('viernes, 27 de diciembre de 2024');
  });

  it('should return to today', () => {
    dateNavigation.subOneDay();
    dateNavigation.subOneDay();
    expect(dateNavigation.current.getDate()).toBe(24);

    dateNavigation.returnToday();
    expect(dateNavigation.current.getDate()).toBe(26);
  });

  it('should allow setting a new date', () => {
    const newDate = new Date('2024-01-15');
    dateNavigation.current = newDate;
    expect(dateNavigation.current.getMonth()).toBe(0);
    expect(dateNavigation.current.getDate()).toBe(15);
  });
});
