'use client';
import React from 'react';
import { Reservation } from '../../types';
import { Dialog } from '../common/Dialog';
import { StatusBadge } from '../common/StatusBadge';
import { ConditionBadge } from '../common/ConditionBadge';
import { formatPHP, formatDate, getCameraImageUrl } from '../../lib/utils';
import { STORE_ADDRESS } from '../../data/seedData';
import { 
  Camera, 
  MapPin, 
  Printer, 
  ShieldCheck, 
  Calendar, 
  User
} from 'lucide-react';

interface RentalVoucherModalProps {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RentalVoucherModal: React.FC<RentalVoucherModalProps> = ({
  reservation,
  isOpen,
  onClose
}) => {
  if (!reservation) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between w-full pr-6">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-zinc-700" />
            <span>Rental Voucher &amp; Claim Slip</span>
          </div>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Voucher</span>
          </button>
        </div>
      }
      description={`Reference: ${reservation.referenceNo} • Issued in Butuan City`}
      maxWidth="2xl"
    >
      <div className="space-y-6 text-sm text-zinc-700">
        {/* Printable Voucher Shell */}
        <div className="p-6 bg-white border border-zinc-200 rounded-xl space-y-6 relative">
          {/* Header of Voucher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-zinc-900 text-white font-bold flex items-center justify-center text-xs">
                  ID
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 tracking-wider">IDIO DIGITAL CAMERAS</h3>
                  <p className="text-[11px] text-zinc-500">Butuan City Camera Rental Management</p>
                </div>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[11px] text-zinc-400 block">Voucher Reference</span>
              <span className="font-mono text-sm font-bold text-zinc-900 tracking-wide">
                {reservation.referenceNo}
              </span>
              <div className="mt-1">
                <StatusBadge status={reservation.status} type="rental" size="sm" />
              </div>
            </div>
          </div>

          {/* Rented Camera Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-zinc-50 p-4 rounded-xl border border-zinc-200">
            <div className="w-full h-28 sm:h-24 bg-white p-2 rounded-lg border border-zinc-200 flex items-center justify-center">
              <img
                src={getCameraImageUrl(reservation.cameraId, reservation.cameraImageUrl)}
                alt={reservation.cameraName}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {reservation.cameraBrand} • {reservation.cameraCategory}
              </span>
              <h4 className="text-sm font-semibold text-zinc-900">{reservation.cameraName}</h4>
              <p className="text-xs text-zinc-500 font-mono">
                Asset Serial: <span className="text-zinc-800">{reservation.cameraSerial}</span>
              </p>
              {reservation.checkoutCondition && (
                <div className="pt-1 flex items-center gap-1.5 text-xs text-zinc-600">
                  <span>Handover Condition:</span>
                  <ConditionBadge condition={reservation.checkoutCondition} showIcon={false} />
                </div>
              )}
            </div>
          </div>

          {/* Schedule & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
              <span className="text-zinc-500 flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Rental Schedule
              </span>
              <p className="text-zinc-800">
                Pickup: <strong className="font-semibold">{formatDate(reservation.startDate)}</strong> (from 8:00 AM)
              </p>
              <p className="text-zinc-800">
                Return: <strong className="font-semibold">{formatDate(reservation.endDate)}</strong> (by 6:00 PM)
              </p>
              <p className="text-zinc-600 mt-1">
                Duration: {reservation.totalDays} Day{reservation.totalDays > 1 ? 's' : ''}
              </p>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
              <span className="text-zinc-500 flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5 text-zinc-400" />
                Customer Record
              </span>
              <p className="text-zinc-900 font-medium">{reservation.customerName}</p>
              <p className="text-zinc-600">{reservation.customerPhone}</p>
              <p className="text-zinc-500 truncate">
                Brgy. {reservation.customerBarangay}, Butuan City
              </p>
              <p className="text-[11px] text-zinc-400">
                ID: {reservation.idType} ({reservation.idNumber})
              </p>
            </div>
          </div>

          {/* Payment & Deposit Breakdown */}
          <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 space-y-2 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Rental Fee ({formatPHP(reservation.dailyRate)} × {reservation.totalDays} days)</span>
              <span className="font-medium text-zinc-900">{formatPHP(reservation.subtotal)}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" /> Security Deposit (Refundable)
              </span>
              <span className="font-medium text-zinc-900">{formatPHP(reservation.securityDeposit)}</span>
            </div>
            <div className="flex justify-between text-zinc-600 pt-1 border-t border-zinc-200">
              <span>Payment Mode:</span>
              <span className="font-medium text-zinc-900">
                {reservation.paymentMethod === 'GCASH' ? `GCash (${reservation.paymentReference || 'Verified'})` : 'Cash on Counter Pickup'}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Deposit Status:</span>
              <StatusBadge status={reservation.depositStatus} type="deposit" size="sm" />
            </div>
            <div className="pt-2 border-t border-zinc-200 flex justify-between items-baseline text-sm">
              <span className="font-semibold text-zinc-900">Total Settlement</span>
              <span className="text-base font-bold text-zinc-900">{formatPHP(reservation.totalAmount)}</span>
            </div>
          </div>

          {/* Store Pickup Notice */}
          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg space-y-1 text-xs text-zinc-600">
            <p className="font-medium text-zinc-800 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-zinc-400" /> Counter Pickup Location:
            </p>
            <p className="text-zinc-600">{STORE_ADDRESS}</p>
            <p className="text-[11px] text-zinc-400">
              Please present 1 valid ID matching your profile for physical equipment verification.
            </p>
          </div>

          {/* Barcode Simulation */}
          <div className="text-center pt-2">
            <div className="inline-block px-6 py-2 bg-zinc-100 rounded border border-zinc-200">
              <div className="tracking-[0.35em] font-mono text-zinc-800 font-bold text-xs">
                ||| | |||| || ||| |||| | ||| ||||
              </div>
              <p className="text-[9px] font-mono text-zinc-500 font-medium tracking-wider mt-0.5">
                {reservation.referenceNo}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
};
