'use client';
import React from 'react';
import { CameraStatus, RentalStatus, PaymentStatus, DepositStatus } from '../../types';
import { cn } from '../../lib/utils';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Wrench, 
  XCircle, 
  Camera, 
  CheckCheck,
  ShieldAlert,
  Coins
} from 'lucide-react';

interface StatusBadgeProps {
  status: CameraStatus | RentalStatus | PaymentStatus | DepositStatus;
  type?: 'camera' | 'rental' | 'payment' | 'deposit';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'camera',
  className,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs font-medium px-2.5 py-0.5 gap-1.5',
    lg: 'text-xs font-semibold px-3 py-1 gap-2'
  };

  // Camera Statuses
  if (type === 'camera' || ['AVAILABLE', 'MAINTENANCE', 'DAMAGED'].includes(status)) {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium', sizeClasses[size], className)}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Available for Rent
          </span>
        );
      case 'RESERVED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 font-medium', sizeClasses[size], className)}>
            <Clock className="w-3 h-3 text-amber-600" />
            Reserved
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 font-medium', sizeClasses[size], className)}>
            <Camera className="w-3 h-3 text-blue-600" />
            Checked Out / In Field
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-orange-50 text-orange-700 border border-orange-200/80 font-medium', sizeClasses[size], className)}>
            <Wrench className="w-3 h-3 text-orange-600" />
            In Maintenance
          </span>
        );
      case 'DAMAGED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 font-medium', sizeClasses[size], className)}>
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Damaged / Offline
          </span>
        );
      default:
        break;
    }
  }

  // Rental Statuses
  if (type === 'rental' || ['PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(status)) {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 font-medium', sizeClasses[size], className)}>
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Store Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-sky-50 text-sky-700 border border-sky-200/80 font-medium', sizeClasses[size], className)}>
            <CheckCircle2 className="w-3 h-3 text-sky-600" />
            Approved (Ready for Pickup)
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-medium', sizeClasses[size], className)}>
            <Camera className="w-3 h-3 text-indigo-600" />
            Active Rental (Handed Over)
          </span>
        );
      case 'RETURNED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 font-medium', sizeClasses[size], className)}>
            <Clock className="w-3 h-3 text-purple-600" />
            Returned (Awaiting Inspection)
          </span>
        );
      case 'COMPLETED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium', sizeClasses[size], className)}>
            <CheckCheck className="w-3 h-3 text-emerald-600" />
            Rental Completed
          </span>
        );
      case 'REJECTED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 font-medium', sizeClasses[size], className)}>
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejected
          </span>
        );
      case 'CANCELLED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200 font-medium', sizeClasses[size], className)}>
            <XCircle className="w-3 h-3 text-zinc-500" />
            Cancelled
          </span>
        );
    }
  }

  // Payment Statuses
  if (type === 'payment' || ['PAID', 'PENDING', 'REFUNDED'].includes(status)) {
    switch (status) {
      case 'PAID':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium', sizeClasses[size], className)}>
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Paid
          </span>
        );
      case 'PENDING':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 font-medium', sizeClasses[size], className)}>
            <Coins className="w-3 h-3 text-amber-600" />
            Pay on Pickup
          </span>
        );
      case 'REFUNDED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 font-medium', sizeClasses[size], className)}>
            Refunded
          </span>
        );
    }
  }

  // Deposit Statuses
  if (type === 'deposit' || ['HELD', 'REFUNDED', 'DEDUCTED', 'FORFEITED'].includes(status)) {
    switch (status) {
      case 'HELD':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 font-medium', sizeClasses[size], className)}>
            <ShieldAlert className="w-3 h-3 text-amber-600" />
            Deposit Held
          </span>
        );
      case 'REFUNDED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium', sizeClasses[size], className)}>
            <CheckCheck className="w-3 h-3 text-emerald-600" />
            Deposit Refunded
          </span>
        );
      case 'DEDUCTED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-orange-50 text-orange-700 border border-orange-200/80 font-medium', sizeClasses[size], className)}>
            <AlertTriangle className="w-3 h-3 text-orange-600" />
            Damage Deducted
          </span>
        );
      case 'FORFEITED':
        return (
          <span className={cn('inline-flex items-center rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 font-medium', sizeClasses[size], className)}>
            <XCircle className="w-3 h-3 text-rose-600" />
            Deposit Forfeited
          </span>
        );
    }
  }

  return (
    <span className={cn('inline-flex items-center rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200 font-medium', sizeClasses[size], className)}>
      {status}
    </span>
  );
};
