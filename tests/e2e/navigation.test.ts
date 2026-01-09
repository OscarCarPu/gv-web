import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should redirect from / to /login', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/login');
  });

});
