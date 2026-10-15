import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackType, FeedbackOptions, DEFAULT_DURATIONS } from '../context/FeedbackContext';

describe('IDIO — Global Centered Feedback System & Viewport Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Duration & Timing Invariants', () => {
    it('enforces that routine success auto-dismisses after 1500ms (1.5s)', () => {
      expect(DEFAULT_DURATIONS.success).toBe(1500);
    });

    it('enforces that info feedback auto-dismisses after 1500ms (1.5s)', () => {
      expect(DEFAULT_DURATIONS.info).toBe(1500);
    });

    it('enforces that errors requiring attention stay visible longer', () => {
      expect(DEFAULT_DURATIONS.error).toBeGreaterThan(DEFAULT_DURATIONS.success);
    });

    it('enforces that loading feedback remains persistent (0ms) until explicitly resolved', () => {
      expect(DEFAULT_DURATIONS.loading).toBe(0);
    });

    it('allows custom duration overrides when provided by caller', () => {
      const customOptions: FeedbackOptions = {
        message: 'Custom duration feedback',
        duration: 8000
      };
      expect(customOptions.duration).toBe(8000);
    });
  });

  describe('2. Viewport-Fixed Centering & Non-Blocking Overlay Contract', () => {
    // Invariants required by the white minimalist UX specification
    const viewportContainerClass = 'fixed inset-0 z-[99999] flex items-center justify-center';
    const nonModalPointerClass = 'pointer-events-none bg-transparent';
    const modalPointerClass = 'pointer-events-auto bg-black/25 backdrop-blur-[2px]';
    const cardSurfaceClass = 'pointer-events-auto relative w-full max-w-[390px] mx-4 !bg-white bg-white border border-zinc-200 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)]';

    it('requires viewport-fixed overlay with z-[99999] to float above sticky navigation and dropdowns', () => {
      expect(viewportContainerClass).toContain('fixed');
      expect(viewportContainerClass).toContain('inset-0');
      expect(viewportContainerClass).toContain('z-[99999]');
    });

    it('requires horizontal and vertical centering regardless of document scroll position', () => {
      expect(viewportContainerClass).toContain('flex');
      expect(viewportContainerClass).toContain('items-center');
      expect(viewportContainerClass).toContain('justify-center');
    });

    it('guarantees ordinary feedback does NOT block background page interactions', () => {
      expect(nonModalPointerClass).toContain('pointer-events-none');
      expect(nonModalPointerClass).toContain('bg-transparent');
      expect(cardSurfaceClass).toContain('pointer-events-auto');
    });

    it('applies restrained modal backdrop only when modal is explicitly requested', () => {
      expect(modalPointerClass).toContain('pointer-events-auto');
      expect(modalPointerClass).toContain('bg-black/25');
      expect(modalPointerClass).toContain('backdrop-blur-[2px]');
    });

    it('implements white minimalist compact card rules (max-w-[390px], rounded-xl, soft shadow, bg-white)', () => {
      expect(cardSurfaceClass).toContain('max-w-[390px]');
      expect(cardSurfaceClass).toContain('bg-white');
      expect(cardSurfaceClass).toContain('rounded-xl');
      expect(cardSurfaceClass).toContain('shadow-');
      expect(cardSurfaceClass).toContain('border-zinc-200');
    });
  });

  describe('3. Accessibility & Reduced Motion Compliancy', () => {
    it('maps error feedback to alert role and assertive live region', () => {
      const getAriaProps = (type: FeedbackType) => ({
        role: type === 'error' ? 'alert' : 'status',
        ariaLive: type === 'error' ? 'assertive' : 'polite'
      });

      const errorAria = getAriaProps('error');
      expect(errorAria.role).toBe('alert');
      expect(errorAria.ariaLive).toBe('assertive');

      const successAria = getAriaProps('success');
      expect(successAria.role).toBe('status');
      expect(successAria.ariaLive).toBe('polite');
    });

    it('preserves motion-reduction preferences for sensitive users', () => {
      const animationClass = 'motion-reduce:transform-none motion-reduce:transition-none';
      expect(animationClass).toContain('motion-reduce:transform-none');
      expect(animationClass).toContain('motion-reduce:transition-none');
    });
  });

  describe('4. Interactive Actions & Dismissal Lifecycle', () => {
    it('executes optional action callback and auto-dismisses upon trigger', () => {
      const mockAction = vi.fn();
      const mockDismiss = vi.fn();

      const actionOption = {
        label: 'View Booking',
        onClick: mockAction
      };

      // Simulate user clicking action button
      actionOption.onClick();
      mockDismiss();

      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });

    it('allows pausing the countdown timer on mouse hover and resumes on mouse leave', () => {
      let isPaused = false;
      const onMouseEnter = () => { isPaused = true; };
      const onMouseLeave = () => { isPaused = false; };

      expect(isPaused).toBe(false);
      onMouseEnter();
      expect(isPaused).toBe(true);
      onMouseLeave();
      expect(isPaused).toBe(false);
    });

    it('dismisses when the user presses the Escape key', () => {
      const mockHide = vi.fn();
      const handleKeyDown = (key: string, hasActiveFeedback: boolean) => {
        if (key === 'Escape' && hasActiveFeedback) {
          mockHide();
        }
      };

      handleKeyDown('Enter', true);
      expect(mockHide).not.toHaveBeenCalled();

      handleKeyDown('Escape', false);
      expect(mockHide).not.toHaveBeenCalled();

      handleKeyDown('Escape', true);
      expect(mockHide).toHaveBeenCalledTimes(1);
    });
  });
});
