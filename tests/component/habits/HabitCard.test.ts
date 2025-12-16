import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import HabitCard from '$lib/domains/habits/components/HabitCard.svelte';
import type { HabitTodayStats } from '$lib/domains/habits/types/Habit.types';

describe('HabitCard', () => {
  it('renders habit information', () => {
    const habit: HabitTodayStats = {
      id: 1,
      name: 'Exercise',
      value_type: 'boolean',
      frequency: 'daily',
      target_value: null,
      comparison_type: null,
      is_required: true,
      color: '#3B82F6',
      icon: 'fas fa-check',
      current_streak: 5,
      longest_streak: 10,
      average_value: '0.8',
      average_completion_rate: '80.0',
      current_period_value: '1'
    };

    render(HabitCard, { props: { habit } });

    expect(screen.getByText('Exercise')).toBeInTheDocument();
    expect(screen.getByText('5 day streak')).toBeInTheDocument();
  });
});
