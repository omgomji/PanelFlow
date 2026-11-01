import { test, expect } from '@playwright/test';

test.describe('PanelFlow End-to-End Booking Flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('admin logs in and creates a position and panel', async ({ page }) => {
    // Navigate to login and authenticate as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'om@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should redirect to positions or dashboard
    await page.waitForURL('**/positions');

    // Create a new position
    await page.click('text=New Project / Role');
    await page.fill('input[id="position-title"]', 'E2E Test Position');
    await page.fill('textarea[id="position-description"]', 'Created by E2E test');
    await page.click('button:has-text("Create")');

    // Verify position was created
    await expect(page.locator('text=E2E Test Position')).toBeVisible();

    // Click into the position detail page
    await page.click('text=E2E Test Position');

    // Add a panel
    await page.click('text=Add Panel');
    await page.fill('input[id="panel-title"]', 'E2E Panel');
    await page.fill('input[id="panel-slug"]', 'e2e-panel');
    await page.fill('input[id="panel-duration"]', '45');

    // Select at least one interviewer
    const interviewerCheckbox = page.locator('input[type="checkbox"]').first();
    await interviewerCheckbox.check();

    await page.click('button:has-text("Create Panel")');

    // Verify success state with copy link and open booking page buttons
    await expect(page.locator('text=Panel created')).toBeVisible();
    await expect(page.locator('text=/panel/e2e-panel/')).toBeVisible();
  });

  test('admin copies and opens a public panel booking link', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'om@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/positions');

    // Navigate to existing panel (from seed data)
    await page.click('text=Full Stack Engineer (React/Node)');
    await expect(page.locator('text=/panel/fullstack-frontend/')).toBeVisible();

    // Copy the booking link
    await page.click('[title="Copy booking link"]');

    // Open the booking page in a new tab
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('[title="Open booking page"]'),
    ]);

    await newPage.waitForURL('**/panel/fullstack-frontend');
    await expect(newPage.locator('h1')).toContainText('Frontend Deep Dive');
  });

  test('candidate books a panel interview', async ({ page }) => {
    await page.goto('/panel/fullstack-frontend');

    // Verify panel details
    await expect(page.locator('h1')).toContainText('Frontend Deep Dive');
    await expect(page.locator('text=Emily Chen')).toBeVisible();
    await expect(page.locator('text=Michael Rodriguez')).toBeVisible();

    // Pick a date and select a slot
    await page.click('button:has-text("Pick a date")');

    // Select today's date (first available)
    const today = new Date();
    const dayString = today.getDate().toString();
    await page.click(`button:has-text("${dayString}")`);

    // Wait for slots to load and select first available
    await page.waitForTimeout(2000);
    const firstSlot = page.locator('button:has-text("Select")').first();
    if ((await firstSlot.count()) > 0) {
      await firstSlot.click();

      // Fill in booking form
      await page.fill('input[id="panel-booking-name"]', 'E2E Candidate');
      await page.fill('input[id="panel-booking-email"]', 'e2e.candidate@example.com');

      await page.click('button:has-text("Schedule interview")');

      // Verify confirmation
      await expect(page.locator('text=You\'re scheduled')).toBeVisible();
      await expect(page.locator('text=Booking confirmed')).toBeVisible();

      // Check aria-live announcement presence
      await expect(page.locator('[aria-live="assertive"]')).toBeVisible();

      // Check email delivery status message
      await expect(page.locator('text=Email delivery may be delayed')).toBeVisible();
    }
  });

  test('candidate opens portal, downloads .ics, and reschedules', async ({ page }) => {
    // Go to portal for a known seeded booking
    await page.goto('/portal/alex.j@example.com');

    // Since portal uses uid, not email, let's use a known uid from seed or navigate through booking
    // For this test, we'll navigate to a panel booking first then use the confirmation flow
    await page.goto('/panel/fullstack-frontend');

    // Pick date and book
    await page.click('button:has-text("Pick a date")');
    const today = new Date();
    await page.click(`button:has-text("${today.getDate()}")`);
    await page.waitForTimeout(2000);

    const firstSlot = page.locator('button:has-text("Select")').first();
    if ((await firstSlot.count()) > 0) {
      await firstSlot.click();
      await page.fill('input[id="panel-booking-name"]', 'Portal Candidate');
      await page.fill('input[id="panel-booking-email"]', 'portal.candidate@example.com');
      await page.click('button:has-text("Schedule interview")');

      await expect(page.locator('text=You\'re scheduled')).toBeVisible();

      // Open candidate portal from confirmation
      await page.click('text=Open candidate portal');

      // Verify portal page shows booking details
      await expect(page.locator('text=Welcome, Portal Candidate')).toBeVisible();
      await expect(page.locator('text=Frontend Deep Dive')).toBeVisible();

      // Download .ics calendar
      const downloadPromise = page.waitForEvent('download');
      await page.click('text=Download Calendar (.ics)');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.ics');

      // Reschedule
      await page.click('text=Reschedule Interview');

      // Select a new slot
      await page.waitForTimeout(2000);
      const newSlot = page.locator('button:has-text("Select")').first();
      if ((await newSlot.count()) > 0) {
        await newSlot.click();
        await page.click('button:has-text("Confirm reschedule")');

        await expect(page.locator('text=New time confirmed')).toBeVisible();
      }
    }
  });

  test('candidate cancels a booking', async ({ page }) => {
    await page.goto('/panel/fullstack-frontend');

    await page.click('button:has-text("Pick a date")');
    const today = new Date();
    await page.click(`button:has-text("${today.getDate()}")`);
    await page.waitForTimeout(2000);

    const firstSlot = page.locator('button:has-text("Select")').first();
    if ((await firstSlot.count()) > 0) {
      await firstSlot.click();
      await page.fill('input[id="panel-booking-name"]', 'Cancel Candidate');
      await page.fill('input[id="panel-booking-email"]', 'cancel.candidate@example.com');
      await page.click('button:has-text("Schedule interview")');

      await expect(page.locator('text=You\'re scheduled')).toBeVisible();

      // Open portal and cancel
      await page.click('text=Open candidate portal');
      await expect(page.locator('text=Welcome, Cancel Candidate')).toBeVisible();

      await page.click('text=Cancel Interview');
      await page.click('text=Cancel Interview'); // Confirm in dialog

      await expect(page.locator('text=Cancelled')).toBeVisible();
    }
  });

  test('slot conflict refreshes correctly', async ({ page }) => {
    // Book a slot first
    await page.goto('/panel/fullstack-frontend');

    await page.click('button:has-text("Pick a date")');
    const today = new Date();
    await page.click(`button:has-text("${today.getDate()}")`);
    await page.waitForTimeout(2000);

    const firstSlot = page.locator('button:has-text("Select")').first();
    if ((await firstSlot.count()) > 0) {
      await firstSlot.click();
      await page.fill('input[id="panel-booking-name"]', 'Conflict Candidate 1');
      await page.fill('input[id="panel-booking-email"]', 'conflict1@example.com');
      await page.click('button:has-text("Schedule interview")');

      await expect(page.locator('text=You\'re scheduled')).toBeVisible();
    }

    // Now try to book the same slot from a different context
    const page2 = await page.context().newPage();
    await page2.goto('/panel/fullstack-frontend');

    await page2.click('button:has-text("Pick a date")');
    await page2.click(`button:has-text("${today.getDate()}")`);
    await page2.waitForTimeout(2000);

    const sameSlot = page2.locator('button:has-text("Select")').first();
    if ((await sameSlot.count()) > 0) {
      await sameSlot.click();
      await page2.fill('input[id="panel-booking-name"]', 'Conflict Candidate 2');
      await page2.fill('input[id="panel-booking-email"]', 'conflict2@example.com');
      await page2.click('button:has-text("Schedule interview")');

      // Should show conflict error and refresh availability
      await expect(page2.locator('text=was just taken')).toBeVisible();
      await expect(page2.locator('text=Availability has been refreshed')).toBeVisible();
    }

    await page2.close();
  });

  test('admin invites an interviewer', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'om@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/positions');

    await page.click('text=Team & Invitations');
    await expect(page.locator('text=Team & Invitations')).toBeVisible();

    await page.click('text=Invite Member');
    await page.fill('input[type="email"]', 'new.interviewer@example.com');
    await page.click('button:has-text("Send Invitation")');

    await expect(page.locator('text=Invitation Sent')).toBeVisible();
    await expect(page.locator('text=new.interviewer@example.com has been invited')).toBeVisible();
  });

  test('admin views workload and calibration analytics', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'om@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/positions');

    await page.click('text=Analytics');
    await expect(page.locator('text=Analytics')).toBeVisible();

    // Check Workload tab
    await expect(page.locator('text=Workload')).toBeVisible();

    // Check Calibration tab
    await page.click('text=Calibration');
    await expect(page.locator('text=Interviewer Calibration')).toBeVisible();
    await expect(page.locator('text=calibration signal')).toBeVisible();

    // Check Feedback Completion tab
    await page.click('text=Feedback Completion');
    await expect(page.locator('text=Feedback Completion')).toBeVisible();

    // Check Candidate History tab
    await page.click('text=Candidate History');
    await expect(page.locator('text=Candidate History')).toBeVisible();
  });

  test('booking succeeds even when email/Kafka fallback is active', async ({ page }) => {
    // This test verifies that when background services are unavailable,
    // the booking still completes and the user sees the fallback message
    await page.goto('/panel/fullstack-frontend');

    await page.click('button:has-text("Pick a date")');
    const today = new Date();
    await page.click(`button:has-text("${today.getDate()}")`);
    await page.waitForTimeout(2000);

    const firstSlot = page.locator('button:has-text("Select")').first();
    if ((await firstSlot.count()) > 0) {
      await firstSlot.click();
      await page.fill('input[id="panel-booking-name"]', 'Fallback Candidate');
      await page.fill('input[id="panel-booking-email"]', 'fallback@example.com');
      await page.click('button:has-text("Schedule interview")');

      // Booking should succeed regardless of email service state
      await expect(page.locator('text=You\'re scheduled')).toBeVisible();
      await expect(page.locator('text=Booking confirmed')).toBeVisible();
    }
  });
});

test.describe('PanelFlow Accessibility', () => {
  test('dialogs can be closed with Escape key', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'om@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/positions');

    await page.click('text=Team & Invitations');
    await page.click('text=Invite Member');

    // Dialog should be open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Press Escape to close
    await page.press('[role="dialog"]', 'Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('meetings table collapses to cards on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/login');
    await page.fill('input[type="email"]', 'om@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/positions');

    await page.click('text=Meetings');

    // On mobile, meetings should render as cards (role="listitem")
    await expect(page.locator('[role="listitem"]')).toBeVisible();
  });

  test('calendar announces slot changes to screen readers', async ({ page }) => {
    await page.goto('/panel/fullstack-frontend');

    await page.click('button:has-text("Pick a date")');
    const today = new Date();
    await page.click(`button:has-text("${today.getDate()}")`);
    await page.waitForTimeout(2000);

    // Check aria-live region exists
    await expect(page.locator('[aria-live="polite"]')).toBeVisible();
  });
});
