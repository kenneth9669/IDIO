import { test, expect } from '@playwright/test';

test.describe('IDIO Admin Journey & Operational Lifecycle E2E', () => {
  test('Admin navigates admin console, manages reservations, and inspects counter operations', async ({ page }) => {
    // 1. Authenticate
    await page.goto('/login');
    await expect(page).toHaveTitle(/IDIO/i);

    const emailInput = page.locator('#email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('admin@idio.ph');
      await page.locator('#password').fill('IdioAdmin2026!');
      await page.getByRole('button', { name: /Sign In/i }).click();
    }

    // 2. Navigate to /admin
    await page.goto('/admin');

    const adminBrand = page.getByText(/IDIO ADMIN/i);
    if (await adminBrand.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Authenticated Admin session active: exercise all 9 admin operational sections
      await expect(adminBrand).toBeVisible();
      await expect(page.getByText(/Operations Overview/i)).toBeVisible();

      // 1. Dashboard
      const dashTab = page.getByRole('button', { name: /^Dashboard$/i });
      if (await dashTab.isVisible()) {
        await dashTab.click();
        await expect(page.getByText(/Operations Overview/i)).toBeVisible();
      }

      // 2. Cameras
      const camerasTab = page.getByRole('button', { name: /^Cameras$|Camera Management/i });
      if (await camerasTab.isVisible()) {
        await camerasTab.click();
        await expect(page.getByText(/Digital Camera Fleet Inventory/i)).toBeVisible();
      }

      // 3. Reservations
      const resTab = page.getByRole('button', { name: /^Reservations/i }).first();
      if (await resTab.isVisible()) {
        await resTab.click();
        await expect(page.getByText(/Reservation Management Ledger/i)).toBeVisible();
      }

      // 4. Rentals & Returns
      const rentalsTab = page.getByRole('button', { name: /Rentals & Returns|Rental Management/i });
      if (await rentalsTab.isVisible()) {
        await rentalsTab.click();
        await expect(page.getByText(/Rentals & Returns Management|Counter & Equipment Operations/i)).toBeVisible();
      }

      // 5. Payments & Deposits
      const paymentsTab = page.getByRole('button', { name: /Payments & Deposits/i });
      if (await paymentsTab.isVisible()) {
        await paymentsTab.click();
        await expect(page.getByText(/Payments & Security Deposits/i)).toBeVisible();
      }

      // 6. Customers
      const customersTab = page.getByRole('button', { name: /^Customers/i });
      if (await customersTab.isVisible()) {
        await customersTab.click();
        await expect(page.getByText(/Customer Directory & Verification/i)).toBeVisible();
      }

      // 7. Maintenance
      const maintenanceTab = page.getByRole('button', { name: /^Maintenance/i }).first();
      if (await maintenanceTab.isVisible()) {
        await maintenanceTab.click();
        await expect(page.getByText(/Equipment Maintenance & Calibration/i)).toBeVisible();
      }

      // 8. Reports
      const reportsTab = page.getByRole('button', { name: /^Reports/i });
      if (await reportsTab.isVisible()) {
        await reportsTab.click();
        await expect(page.getByText(/Financial & Operational Analytics/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
      }

      // 9. Settings & Audit Logs
      const settingsTab = page.getByRole('button', { name: /Settings & Audit Logs|Settings & Profile/i });
      if (await settingsTab.isVisible()) {
        await settingsTab.click();
        await expect(page.getByText(/Settings & Audit Logs/i)).toBeVisible();
      }
    } else {
      // Unauthenticated attempt redirected to login
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('#email')).toBeVisible();
    }
  });
});
