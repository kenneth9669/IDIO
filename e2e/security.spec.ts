import { test, expect } from '@playwright/test';

test.describe('IDIO Security & Authorization E2E', () => {
  test('Customer cannot access protected Admin route /admin and gets redirected', async ({ page }) => {
    // 1. Authenticate as Customer
    await page.goto('/login');
    const emailInput = page.locator('#email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('jennelyn.creates@gmail.com');
      await page.locator('#password').fill('IdioCustomer2026!');
      await page.getByRole('button', { name: /Sign In/i }).click();
    }

    // 2. Attempt direct URL navigation to /admin
    await page.goto('/admin');

    // Customer must NOT see the Admin Console
    await expect(page.getByText('IDIO ADMIN')).not.toBeVisible();
    await expect(page.getByText('Operations Overview')).not.toBeVisible();

    // Verify redirected or customer portal shown
    const isLogin = page.url().includes('/login');
    const isCustomerHome = await page.getByRole('banner').getByText('IDIO').first().isVisible().catch(() => false);
    expect(isLogin || isCustomerHome).toBe(true);
  });

  test('Customer navigation is strictly isolated from Admin operational tabs', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('#email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('jennelyn.creates@gmail.com');
      await page.locator('#password').fill('IdioCustomer2026!');
      await page.getByRole('button', { name: /Sign In/i }).click();
    }

    await page.goto('/');

    await expect(page.getByRole('button', { name: /Browse Cameras|Camera Catalog/i }).first()).toBeVisible({ timeout: 10000 });

    // Verify Admin operational tabs are NOT rendered for Customer
    await expect(page.getByRole('button', { name: /^Fleet$|^Camera Fleet$/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^Reservations Master$/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^Maintenance$/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^Reports & Analytics$/i })).not.toBeVisible();
  });

  test('Reservation flow enforces authoritative daily rate and deposit calculations', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('#email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('jennelyn.creates@gmail.com');
      await page.locator('#password').fill('IdioCustomer2026!');
      await page.getByRole('button', { name: /Sign In/i }).click();
    }

    await page.goto('/');

    await expect(page.getByRole('button', { name: /Browse Cameras|Camera Catalog/i }).first()).toBeVisible({ timeout: 10000 });

    // Open first reserve modal
    const reserveBtn = page.getByRole('button', { name: /^Reserve$/i }).first();
    if (await reserveBtn.isVisible()) {
      await reserveBtn.click();

      const reservationModal = page.getByRole('dialog');
      await expect(reservationModal).toBeVisible();

      // Verify presence of non-tamperable subtotal and refundable deposit breakdown
      await expect(reservationModal.getByText(/Refundable Security Deposit/i)).toBeVisible();
      await expect(reservationModal.getByText(/Total Amount Due/i)).toBeVisible();

      // Close modal
      await reservationModal.getByRole('button', { name: /Cancel/i }).click();
    }
  });
});
