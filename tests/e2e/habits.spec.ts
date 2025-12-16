import { test, expect } from '@playwright/test';

test.describe('Habits Page', () => {
  test('should display habits list', async ({ page }) => {
    await page.goto('/habits');

    await expect(page.locator('h1')).toContainText('All Habits');
  });
});
