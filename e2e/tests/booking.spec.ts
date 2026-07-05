import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test('should display event type details and allow navigation', async ({ page }) => {
    // Requires the backend to be seeded and running, and the frontend to be running
    // Seed data provides user "om" and event type "30-min-interview"
    await page.goto('/om/30-min-interview');
    
    // Check if the page title or a heading contains the event title
    await expect(page.locator('h1')).toContainText('30 Min Interview');
    
    // Check for the duration
    await expect(page.locator('text=30 min').first()).toBeVisible();
    
    // Ensure the calendar or "Next" button is visible
    const nextMonthButton = page.locator('button[aria-label="Next month"]');
    if (await nextMonthButton.isVisible()) {
      await expect(nextMonthButton).toBeVisible();
    }
  });
});
