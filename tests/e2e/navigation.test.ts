import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should redirect from / to /habits', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/habits');
  });

});
