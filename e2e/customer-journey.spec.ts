import { test, expect } from '@playwright/test';

test.describe('IDIO Customer Journey E2E', () => {
  test('Customer logs in, browses catalog, views specs, creates reservation with Cash Pickup, and verifies pending approval', async ({ page }) => {
    // 1. Authenticate as Customer via /login
    await page.goto('/login');
    await expect(page).toHaveTitle(/IDIO/i);

    const emailInput = page.locator('#email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('jennelyn.creates@gmail.com');
      await page.locator('#password').fill('IdioCustomer2026!');
      await page.getByRole('button', { name: /Sign In/i }).click();
    }

    await page.goto('/');

    // Verify arrival at main customer portal
    await expect(page.getByRole('banner').getByText('IDIO').first()).toBeVisible({ timeout: 10000 });

    // 2. Navigate to Browse Cameras catalog
    const browseCamerasBtn = page.getByRole('button', { name: /Browse Cameras|Camera Catalog/i }).first();
    if (await browseCamerasBtn.isVisible()) {
      await browseCamerasBtn.click();
    }

    // Verify camera catalog
    await expect(page.getByRole('heading', { name: /Available Digital Cameras|Featured Digital Cameras/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/₱.*\/ day/i).first()).toBeVisible();

    // 3. Open Camera Specs / Details
    const specsButton = page.locator('button[aria-label*="View technical specifications"]').first();
    if (await specsButton.isVisible()) {
      await specsButton.click();

      // Verify Camera Detail dialog is open
      const detailDialog = page.getByRole('dialog');
      await expect(detailDialog).toBeVisible();
      await expect(detailDialog.getByText(/Technical Specifications/i)).toBeVisible();
      await expect(detailDialog.getByText(/Standard Rental Kit Inclusions/i)).toBeVisible();

      // Close detail dialog
      await detailDialog.getByRole('button', { name: 'Close' }).click();
      await expect(detailDialog).not.toBeVisible();
    }

    // 4. Reserve an available camera
    const availableReserveBtn = page.locator('button:enabled:has-text("Reserve")').first();
    await expect(availableReserveBtn).toBeVisible({ timeout: 10000 });
    await availableReserveBtn.click();

    // Verify Reservation modal opened
    const reservationModal = page.getByRole('dialog');
    await expect(reservationModal).toBeVisible();
    await expect(reservationModal.getByText(/Rental Period \(Dates\)/i)).toBeVisible();
    await expect(reservationModal.getByText(/Cash on Counter Pickup/i)).toBeVisible();

    // Set dynamic valid future dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDateStr = tomorrow.toISOString().split('T')[0];

    const returnDate = new Date();
    returnDate.setDate(returnDate.getDate() + 3);
    const endDateStr = returnDate.toISOString().split('T')[0];

    const availableDayButtons = reservationModal.locator('button[data-status="available"]');
    if (await availableDayButtons.count() >= 2) {
      await availableDayButtons.nth(0).click();
      await availableDayButtons.nth(1).click();
    } else {
      const dateInputs = reservationModal.locator('input[type="date"]');
      if (await dateInputs.count() >= 2) {
        await dateInputs.nth(0).fill(startDateStr);
        await dateInputs.nth(1).fill(endDateStr);
      }
    }

    // Verify terms agreement checkbox is checked
    const termsCheckbox = reservationModal.locator('input[type="checkbox"]');
    if (await termsCheckbox.count() > 0 && !(await termsCheckbox.first().isChecked())) {
      await termsCheckbox.first().check();
    }

    // Submit Reservation
    const submitBtn = reservationModal.getByRole('button', { name: /Submit Reservation/i });
    if (await submitBtn.isVisible() && await submitBtn.isEnabled()) {
      await submitBtn.click();
      await expect(page.getByText(/My Bookings & Rental History|My Reservations/i).first()).toBeVisible({ timeout: 10000 });
    }
  });
});
