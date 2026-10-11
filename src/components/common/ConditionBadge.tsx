'use client';
import React from 'react';
import { CameraCondition } from '../../types';
import { cn } from '../../lib/utils';
import { Sparkles, Check, AlertCircle, AlertOctagon } from 'lucide-react';

interface ConditionBadgeProps {
  condition: CameraCondition;
  className?: string;
  showIcon?: boolean;
}

export const ConditionBadge: React.FC<ConditionBadgeProps> = ({
  condition,
  className,
  showIcon = true
}) => {
  switch (condition) {
    case 'Excellent':
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80', className)}>
          {showIcon && <Sparkles className="w-3 h-3 text-emerald-600" />}
          Excellent
        </span>
      );
    case 'Good':
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/80', className)}>
          {showIcon && <Check className="w-3 h-3 text-blue-600" />}
          Good
        </span>
      );
    case 'Fair':
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80', className)}>
          {showIcon && <AlertCircle className="w-3 h-3 text-amber-600" />}
          Fair
        </span>
      );
    case 'Damaged':
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/80', className)}>
          {showIcon && <AlertOctagon className="w-3 h-3 text-rose-600" />}
          Damaged
        </span>
      );
    default:
      return null;
  }
};
