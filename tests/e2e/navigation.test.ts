import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should redirect unauthenticated user from / to /login', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/login');
  });

  test('should redirect unauthenticated user from /habits to /login', async ({ page }) => {
    await page.goto('/habits');

    await expect(page).toHaveURL('/login');
  });
});
