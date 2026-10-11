import { test, expect } from '@playwright/test';

const TARGET_VIEWPORTS = [
  { name: 'Small Mobile', width: 320, height: 568 },
  { name: 'Standard Mobile', width: 375, height: 812 },
  { name: 'Large Mobile', width: 430, height: 932 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'Desktop', width: 1920, height: 1080 },
];

test.describe('IDIO Responsive Design & Camera Studio Images Verification', () => {
  for (const vp of TARGET_VIEWPORTS) {
    test(`Verify layout, zero horizontal overflow, and camera catalog at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Verify page hero or cameras render
      await expect(page.getByText(/Featured Digital Cameras|Available Digital Cameras|IDIO/i).first()).toBeVisible({ timeout: 15000 });

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const bodyScrollWidth = document.body.scrollWidth;
        return {
          clientWidth: docWidth,
          scrollWidth: Math.max(scrollWidth, bodyScrollWidth),
          hasOverflow: Math.max(scrollWidth, bodyScrollWidth) > docWidth + 1
        };
      });

      expect(overflow.hasOverflow, `Detected horizontal overflow on ${vp.name}: clientWidth=${overflow.clientWidth}, scrollWidth=${overflow.scrollWidth}`).toBe(false);

      // Verify all camera cards have images loaded
      const cameraImages = page.locator('img[alt*="Sony"], img[alt*="Canon"], img[alt*="Fujifilm"], img[alt*="Nikon"], img[alt*="Ricoh"]');
      const count = await cameraImages.count();
      expect(count).toBeGreaterThan(0);

      // Check that image src uses local /cameras/CAM-00X.jpg assets
      for (let i = 0; i < Math.min(count, 4); i++) {
        const src = await cameraImages.nth(i).getAttribute('src');
        expect(src).toBeTruthy();
        expect(src).toMatch(/\/cameras\/CAM-00\d\.jpg|\/cameras\/placeholder\.jpg/);
      }

      // If on mobile/tablet viewports (< 1024px), verify mobile drawer
      if (vp.width < 1024) {
        const hamburgerBtn = page.getByRole('button', { name: /Open navigation menu/i });
        if (await hamburgerBtn.isVisible()) {
          await hamburgerBtn.click();
          await expect(page.getByText('IDIO Rental Hub')).toBeVisible();
          // Close drawer
          const closeBtn = page.getByRole('button', { name: /Close navigation menu/i });
          await closeBtn.click();
          await expect(page.getByText('IDIO Rental Hub')).not.toBeVisible();
        }
      }
    });
  }

  test('Verify camera modal dialogs fit within viewport on small mobile (320x568)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Navigate to Browse Cameras
    const catalogBtn = page.getByRole('button', { name: /Browse Cameras|Camera Catalog/i }).first();
    if (await catalogBtn.isVisible()) {
      await catalogBtn.click();
    }

    // Open first Details modal via aria-label
    const detailsBtn = page.locator('button[aria-label*="View technical specifications"]').first();
    if (await detailsBtn.isVisible()) {
      await detailsBtn.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify dialog does not overflow 320px screen width
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      if (dialogBox) {
        expect(dialogBox.width).toBeLessThanOrEqual(320);
      }

      // Verify dialog has close button
      const closeBtn = dialog.getByRole('button', { name: /Close/i }).first();
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test('Verify all 8 camera studio product photography assets resolve successfully', async ({ page }) => {
    const cameraIds = ['CAM-001', 'CAM-002', 'CAM-003', 'CAM-004', 'CAM-005', 'CAM-006', 'CAM-007', 'CAM-008'];
    for (const id of cameraIds) {
      const response = await page.request.get(`/cameras/${id}.jpg`);
      expect(response.status(), `Asset /cameras/${id}.jpg returned HTTP ${response.status()}`).toBe(200);
      const headers = response.headers();
      expect(headers['content-type']).toMatch(/image\/(jpeg|jpg)/);
    }
  });
});
