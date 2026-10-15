'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2, X } from 'lucide-react';

export type FeedbackType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface FeedbackAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface FeedbackOptions {
  id?: string;
  type?: FeedbackType;
  title?: string;
  message: string;
  duration?: number; // ms to auto-dismiss (0 or negative means persistent)
  modal?: boolean;   // if true, displays subtle backdrop and traps click
  action?: FeedbackAction;
  onDismiss?: () => void;
}

interface ActiveFeedback extends FeedbackOptions {
  id: string;
  type: FeedbackType;
  title: string;
  createdAt: number;
}

interface FeedbackContextType {
  showFeedback: (options: FeedbackOptions) => string;
  showSuccess: (message: string, title?: string, options?: Partial<FeedbackOptions>) => string;
  showError: (message: string, title?: string, options?: Partial<FeedbackOptions>) => string;
  showWarning: (message: string, title?: string, options?: Partial<FeedbackOptions>) => string;
  showInfo: (message: string, title?: string, options?: Partial<FeedbackOptions>) => string;
  showLoading: (message: string, title?: string) => string;
  hideFeedback: (id?: string) => void;
  activeFeedback: ActiveFeedback | null;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const DEFAULT_DURATIONS: Record<FeedbackType, number> = {
  success: 1500, // 1.5 seconds per user requirement
  info: 1500,    // 1.5 seconds
  warning: 3000,
  error: 4500,
  loading: 0 // persistent until updated or dismissed
};

const DEFAULT_TITLES: Record<FeedbackType, string> = {
  success: 'Changes saved',
  error: 'Something went wrong',
  warning: 'Attention required',
  info: 'Information',
  loading: 'Processing...'
};

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeFeedback, setActiveFeedback] = useState<ActiveFeedback | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const [mounted, setMounted] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const remainingTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const totalDurationRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearExistingTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const hideFeedback = useCallback((id?: string) => {
    if (id && activeFeedback && activeFeedback.id !== id) {
      return;
    }
    clearExistingTimers();
    setIsVisible(false);

    // Call onDismiss callback if defined
    if (activeFeedback?.onDismiss) {
      activeFeedback.onDismiss();
    }

    // Delay unmounting state slightly to allow exit animation to complete smoothly
    setTimeout(() => {
      setActiveFeedback(null);
      setProgress(100);
      setIsPaused(false);
    }, 200);
  }, [activeFeedback, clearExistingTimers]);

  const startDismissTimer = useCallback((durationMs: number) => {
    clearExistingTimers();
    if (durationMs <= 0) {
      setProgress(100);
      return;
    }

    totalDurationRef.current = durationMs;
    remainingTimeRef.current = durationMs;
    startTimeRef.current = Date.now();
    setProgress(100);

    const intervalMs = 25;
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, totalDurationRef.current - elapsed);
      const pct = (remaining / totalDurationRef.current) * 100;
      setProgress(pct);

      if (remaining <= 0) {
        clearInterval(progressIntervalRef.current!);
        progressIntervalRef.current = null;
      }
    }, intervalMs);

    timerRef.current = setTimeout(() => {
      hideFeedback();
    }, durationMs);
  }, [clearExistingTimers, hideFeedback]);

  const handleMouseEnter = useCallback(() => {
    if (totalDurationRef.current <= 0 || !activeFeedback) return;
    setIsPaused(true);
    clearExistingTimers();
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(500, remainingTimeRef.current - elapsed);
  }, [activeFeedback, clearExistingTimers]);

  const handleMouseLeave = useCallback(() => {
    if (totalDurationRef.current <= 0 || !activeFeedback) return;
    setIsPaused(false);
    if (remainingTimeRef.current > 0) {
      startTimeRef.current = Date.now();
      totalDurationRef.current = remainingTimeRef.current;

      const intervalMs = 25;
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, totalDurationRef.current - elapsed);
        const pct = (remaining / totalDurationRef.current) * 100;
        setProgress(pct);

        if (remaining <= 0) {
          clearInterval(progressIntervalRef.current!);
          progressIntervalRef.current = null;
        }
      }, intervalMs);

      timerRef.current = setTimeout(() => {
        hideFeedback();
      }, remainingTimeRef.current);
    }
  }, [activeFeedback, hideFeedback]);

  // Keyboard shortcut: Escape to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeFeedback) {
        hideFeedback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFeedback, hideFeedback]);

  const showFeedback = useCallback((options: FeedbackOptions): string => {
    clearExistingTimers();

    const id = options.id || `feedback-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const type = options.type || 'info';
    const title = options.title || DEFAULT_TITLES[type];
    const duration = options.duration !== undefined ? options.duration : DEFAULT_DURATIONS[type];

    const newFeedback: ActiveFeedback = {
      ...options,
      id,
      type,
      title,
      createdAt: Date.now()
    };

    setActiveFeedback(newFeedback);
    setIsVisible(true);
    setIsPaused(false);

    if (duration > 0) {
      startDismissTimer(duration);
    } else {
      setProgress(100);
    }

    return id;
  }, [clearExistingTimers, startDismissTimer]);

  const showSuccess = useCallback((message: string, title?: string, options?: Partial<FeedbackOptions>) => {
    return showFeedback({
      type: 'success',
      title: title || DEFAULT_TITLES.success,
      message,
      ...options
    });
  }, [showFeedback]);

  const showError = useCallback((message: string, title?: string, options?: Partial<FeedbackOptions>) => {
    return showFeedback({
      type: 'error',
      title: title || DEFAULT_TITLES.error,
      message,
      ...options
    });
  }, [showFeedback]);

  const showWarning = useCallback((message: string, title?: string, options?: Partial<FeedbackOptions>) => {
    return showFeedback({
      type: 'warning',
      title: title || DEFAULT_TITLES.warning,
      message,
      ...options
    });
  }, [showFeedback]);

  const showInfo = useCallback((message: string, title?: string, options?: Partial<FeedbackOptions>) => {
    return showFeedback({
      type: 'info',
      title: title || DEFAULT_TITLES.info,
      message,
      ...options
    });
  }, [showFeedback]);

  const showLoading = useCallback((message: string, title?: string) => {
    return showFeedback({
      type: 'loading',
      title: title || DEFAULT_TITLES.loading,
      message,
      duration: 0
    });
  }, [showFeedback]);

  // Context value
  const contextValue: FeedbackContextType = {
    showFeedback,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    hideFeedback,
    activeFeedback
  };

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}
      {mounted && typeof document !== 'undefined' && createPortal(
        <CenteredFeedbackRenderer
          feedback={activeFeedback}
          isVisible={isVisible}
          isPaused={isPaused}
          progress={progress}
          onDismiss={() => hideFeedback()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />,
        document.body
      )}
    </FeedbackContext.Provider>
  );
};

export function useFeedback(): FeedbackContextType {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
}

// -----------------------------------------------------------------------------
// Centered Viewport-Fixed Renderer (Clean White Minimalist SaaS Aesthetic)
// -----------------------------------------------------------------------------

interface RendererProps {
  feedback: ActiveFeedback | null;
  isVisible: boolean;
  isPaused: boolean;
  progress: number;
  onDismiss: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const CenteredFeedbackRenderer: React.FC<RendererProps> = ({
  feedback,
  isVisible,
  isPaused,
  progress,
  onDismiss,
  onMouseEnter,
  onMouseLeave
}) => {
  if (!feedback) return null;

  const isModal = Boolean(feedback.modal);
  const type = feedback.type;

  // Status configuration: small, restrained icons with soft accents on a clean white card
  const typeConfig: Record<FeedbackType, {
    icon: React.ReactNode;
    iconBg: string;
    progressBar: string;
  }> = {
    success: {
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.2]" />,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/60',
      progressBar: 'bg-emerald-500'
    },
    error: {
      icon: <AlertCircle className="w-4 h-4 text-rose-600 stroke-[2.2]" />,
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-200/60',
      progressBar: 'bg-rose-500'
    },
    warning: {
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 stroke-[2.2]" />,
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-200/60',
      progressBar: 'bg-amber-500'
    },
    info: {
      icon: <Info className="w-4 h-4 text-blue-600 stroke-[2.2]" />,
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-200/60',
      progressBar: 'bg-blue-500'
    },
    loading: {
      icon: <Loader2 className="w-4 h-4 animate-spin text-zinc-600 stroke-[2.2]" />,
      iconBg: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
      progressBar: 'bg-zinc-900'
    }
  };

  const config = typeConfig[type];

  return (
    <div
      className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 transition-all duration-200 ${
        isModal ? 'bg-black/25 backdrop-blur-[2px] pointer-events-auto' : 'bg-transparent pointer-events-none'
      }`}
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
      }}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {/* Background click listener when modal mode is requested */}
      {isModal && (
        <div
          className="fixed inset-0"
          onClick={onDismiss}
          aria-hidden="true"
        />
      )}

      {/* Floating Centered Card: Pure White Minimalist SaaS design */}
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`pointer-events-auto relative w-full max-w-[390px] mx-4 !bg-white bg-white border border-zinc-200 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden transition-all duration-200 ease-out transform ${
          isVisible
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-[0.98] -translate-y-1'
        } motion-reduce:transform-none motion-reduce:transition-none`}
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <div className="p-4 flex items-start gap-3 bg-white">
          {/* Status Icon: Small, restrained circular icon container */}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${config.iconBg}`}>
            {config.icon}
          </div>

          {/* Text Content: Dark charcoal title with muted gray message */}
          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-xs font-semibold text-zinc-900 tracking-tight leading-snug">
              {feedback.title}
            </h4>
            <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed break-words font-normal">
              {feedback.message}
            </p>

            {/* Optional Interactive Action */}
            {feedback.action && (
              <div className="mt-3 pt-2.5 border-t border-zinc-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    feedback.action?.onClick();
                    onDismiss();
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    feedback.action.variant === 'secondary'
                      ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800'
                  }`}
                >
                  {feedback.action.label}
                </button>
              </div>
            )}
          </div>

          {/* Dismiss Button: Small, unobtrusive X */}
          {type !== 'loading' && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 -mr-1 -mt-0.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss feedback"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Hairline Progress Bar for Auto-Dismissing Messages */}
        {feedback.duration && feedback.duration > 0 && type !== 'loading' && (
          <div className="h-[2px] w-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full ${config.progressBar} transition-[width] ease-linear duration-75`}
              style={{
                width: `${progress}%`,
                opacity: isPaused ? 0.6 : 1
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
