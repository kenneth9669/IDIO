import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('IDIO — Minimalist White Feedback and Success Notifications', () => {
  const rootDir = path.resolve(__dirname, '../..');

  describe('1. Confetti Removal & Dependency Hygiene', () => {
    it('verifies canvas-confetti has been uninstalled from package.json dependencies', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      expect(packageJson.dependencies['canvas-confetti']).toBeUndefined();
      if (packageJson.devDependencies) {
        expect(packageJson.devDependencies['@types/canvas-confetti']).toBeUndefined();
      }
    });

    it('verifies ReservationModal does NOT import or call canvas-confetti', () => {
      const reservationModalPath = path.join(rootDir, 'src/components/customer/ReservationModal.tsx');
      const content = fs.readFileSync(reservationModalPath, 'utf8');

      expect(content).not.toContain("import confetti from 'canvas-confetti'");
      expect(content).not.toContain('confetti(');
    });

    it('verifies that no other source file in src imports canvas-confetti', () => {
      const srcDir = path.join(rootDir, 'src');
      const checkDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '__tests__') {
            checkDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) && !dir.includes('__tests__')) {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            expect(fileContent).not.toContain("from 'canvas-confetti'");
          }
        }
      };
      checkDir(srcDir);
    });
  });

  describe('2. Reservation Success Feedback Specification', () => {
    const successModalPath = path.join(rootDir, 'src/components/customer/ReservationSuccessModal.tsx');
    let modalCode = '';

    beforeEach(() => {
      modalCode = fs.readFileSync(successModalPath, 'utf8');
    });

    it('implements pure white background (#FFFFFF) with subtle border and rounded corners', () => {
      expect(modalCode).toContain('bg-white');
      expect(modalCode).toContain('border-zinc-200');
      expect(modalCode).toContain('rounded-2xl');
      expect(modalCode).toContain('shadow-xl');
    });

    it('includes small, simple success icon: thin green checkmark inside subtle circular outline', () => {
      expect(modalCode).toContain('rounded-full');
      expect(modalCode).toContain('border-emerald-300');
      expect(modalCode).toContain('text-emerald-600');
      expect(modalCode).toContain('<Check');
    });

    it('features exact minimalist typography: dark heading and neutral gray supporting text', () => {
      expect(modalCode).toContain('Reservation Successful');
      expect(modalCode).toContain('text-zinc-900');
      expect(modalCode).toContain('Your camera reservation has been confirmed.');
      expect(modalCode).toContain('text-zinc-500');
    });

    it('renders concise summary containing camera name, pickup date, return date & time, and reference number', () => {
      expect(modalCode).toContain('Camera');
      expect(modalCode).toContain('Pickup Date');
      expect(modalCode).toContain('Return Date & Time');
      expect(modalCode).toContain('Reference No.');
      expect(modalCode).toContain('(from 8:00 AM)');
      expect(modalCode).toContain('(by 6:00 PM)');
    });

    it('provides primary action "View My Reservations" and secondary action "Continue Browsing"', () => {
      expect(modalCode).toContain('View My Reservations');
      expect(modalCode).toContain('Continue Browsing');
    });

    it('ensures neutral subtle backdrop behind the modal', () => {
      expect(modalCode).toContain('bg-black/40');
      expect(modalCode).toContain('backdrop-blur-xs');
    });
  });

  describe('3. Reservation Confirmation Integration', () => {
    const reservationModalPath = path.join(rootDir, 'src/components/customer/ReservationModal.tsx');
    let modalContent = '';

    beforeEach(() => {
      modalContent = fs.readFileSync(reservationModalPath, 'utf8');
    });

    it('switches to ReservationSuccessModal only when backend returns success', () => {
      expect(modalContent).toContain('confirmedReservation');
      expect(modalContent).toContain('setConfirmedReservation({');
      expect(modalContent).toContain('<ReservationSuccessModal');
    });

    it('does not display success modal when reservation fails, displaying white error panel instead', () => {
      expect(modalContent).toContain('setErrorMessage(result.message)');
      expect(modalContent).toContain('Reservation Unsuccessful');
      expect(modalContent).toContain('bg-white border border-zinc-200');
    });

    it('supports user navigating to View My Reservations or Continuing Browsing', () => {
      expect(modalContent).toContain('handleViewReservations');
      expect(modalContent).toContain('handleContinueBrowsing');
    });
  });

  describe('4. Background Styling of All Centered Feedback & Dialog UIs', () => {
    it('verifies common Dialog uses pure white background and subtle neutral backdrop', () => {
      const dialogPath = path.join(rootDir, 'src/components/common/Dialog.tsx');
      const dialogContent = fs.readFileSync(dialogPath, 'utf8');

      expect(dialogContent).toContain('bg-white');
      expect(dialogContent).toContain('border-zinc-200');
      expect(dialogContent).toContain('bg-black/40');
    });

    it('verifies Centered Feedback Renderer uses pure white surface and neutral backdrop', () => {
      const feedbackPath = path.join(rootDir, 'src/context/FeedbackContext.tsx');
      const feedbackContent = fs.readFileSync(feedbackPath, 'utf8');

      expect(feedbackContent).toContain('bg-white');
      expect(feedbackContent).toContain('border-zinc-200');
      expect(feedbackContent).toContain('bg-black/25');
      expect(feedbackContent).not.toContain('dark:bg-zinc-900');
      expect(feedbackContent).not.toContain('dark:text-zinc-100');
      expect(feedbackContent).toContain("backgroundColor: '#FFFFFF'");
    });

    it('verifies CheckoutModal and ReturnInspectionModal alert panels use pure white backgrounds', () => {
      const checkoutPath = path.join(rootDir, 'src/components/counter/CheckoutModal.tsx');
      const returnPath = path.join(rootDir, 'src/components/counter/ReturnInspectionModal.tsx');

      const checkoutContent = fs.readFileSync(checkoutPath, 'utf8');
      const returnContent = fs.readFileSync(returnPath, 'utf8');

      expect(checkoutContent).toContain('p-3.5 bg-white border border-zinc-200 rounded-xl');
      expect(returnContent).toContain('p-3.5 bg-white border border-zinc-200 rounded-xl');
    });

    it('verifies FleetManager decommissioning dialog error panel uses pure white background', () => {
      const fleetPath = path.join(rootDir, 'src/components/admin/FleetManager.tsx');
      const fleetContent = fs.readFileSync(fleetPath, 'utf8');

      expect(fleetContent).toContain('deleteErrorMessage && (');
      expect(fleetContent).toContain('bg-white border border-zinc-200');
    });

    it('verifies AvailabilityCalendar error and unavailable banners use pure white backgrounds', () => {
      const calPath = path.join(rootDir, 'src/components/customer/AvailabilityCalendar.tsx');
      const calContent = fs.readFileSync(calPath, 'utf8');

      expect(calContent).toContain('rangeError && (');
      expect(calContent).toContain('p-2.5 bg-white border border-zinc-200');
      expect(calContent).toContain('cameraUnavailable && (');
      expect(calContent).toContain('p-3 bg-white border border-zinc-200');
    });
  });
});
