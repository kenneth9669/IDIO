'use client';
import React, { useState } from 'react';
import { Reservation, CameraCondition } from '../../types';
import { useSystem } from '../../context/SystemContext';
import { Dialog } from '../common/Dialog';
import { ConditionBadge } from '../common/ConditionBadge';
import { formatPHP, formatDate } from '../../lib/utils';
import { 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  PackageCheck
} from 'lucide-react';

interface CheckoutModalProps {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  reservation,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { checkoutRental } = useSystem();

  const [condition, setCondition] = useState<CameraCondition>('Excellent');
  const [checklist, setChecklist] = useState({
    idVerified: false,
    serialMatched: false,
    accessoriesComplete: false,
    paymentConfirmed: false
  });
  const [notes, setNotes] = useState('Camera inspected in working order. Sensor clean, battery fully charged.');
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!reservation) return null;

  const allChecked =
    checklist.idVerified &&
    checklist.serialMatched &&
    checklist.accessoriesComplete &&
    checklist.paymentConfirmed;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!allChecked) {
      setErrorMessage('Please complete all 4 mandatory physical checkout verification checks.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await checkoutRental(reservation.id, condition, notes);
      setIsProcessing(false);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(result.message);
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Error processing checkout.');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-zinc-900">
          <Camera className="w-5 h-5 text-zinc-700" />
          <span>Physical Checkout &amp; Handover</span>
        </div>
      }
      description={`Processing Reservation Ref: ${reservation.referenceNo} for ${reservation.customerName}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleCheckoutSubmit} className="space-y-6 text-sm text-zinc-700">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Customer & Asset Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-zinc-400" /> Customer Information
            </span>
            <p className="font-semibold text-zinc-900 text-sm">{reservation.customerName}</p>
            <p className="text-xs text-zinc-600">{reservation.customerPhone}</p>
            <p className="text-xs text-zinc-500">
              Brgy. {reservation.customerBarangay}, Butuan City
            </p>
            <p className="text-[11px] text-zinc-700">
              ID: {reservation.idType} ({reservation.idNumber})
            </p>
          </div>

          <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-zinc-400" /> Camera Asset
            </span>
            <p className="font-semibold text-zinc-900 text-sm">{reservation.cameraName}</p>
            <p className="text-xs font-mono text-zinc-700 font-medium">
              SN: {reservation.cameraSerial}
            </p>
            <p className="text-xs text-zinc-600">
              Period: {formatDate(reservation.startDate)} to {formatDate(reservation.endDate)}
            </p>
            <p className="text-xs text-zinc-800 font-medium">
              Deposit: {formatPHP(reservation.securityDeposit)} ({reservation.depositStatus})
            </p>
          </div>
        </div>

        {/* Mandatory Admin Inspection Checklist */}
        <div className="space-y-3 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4 text-zinc-600" />
            Mandatory Physical Handover Checklist
          </h4>

          <div className="space-y-2 text-xs text-zinc-700">
            <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-md bg-white hover:bg-zinc-50 border border-zinc-200 transition">
              <input
                type="checkbox"
                checked={checklist.idVerified}
                onChange={(e) => setChecklist({ ...checklist, idVerified: e.target.checked })}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <span>1. Customer presented valid ID ({reservation.idType}) matching profile</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-md bg-white hover:bg-zinc-50 border border-zinc-200 transition">
              <input
                type="checkbox"
                checked={checklist.serialMatched}
                onChange={(e) => setChecklist({ ...checklist, serialMatched: e.target.checked })}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <span>2. Camera physical serial number verified ({reservation.cameraSerial})</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-md bg-white hover:bg-zinc-50 border border-zinc-200 transition">
              <input
                type="checkbox"
                checked={checklist.accessoriesComplete}
                onChange={(e) => setChecklist({ ...checklist, accessoriesComplete: e.target.checked })}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <span>3. All package inclusions verified: Batteries, SD Card, Charger &amp; Bag</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-md bg-white hover:bg-zinc-50 border border-zinc-200 transition">
              <input
                type="checkbox"
                checked={checklist.paymentConfirmed}
                onChange={(e) => setChecklist({ ...checklist, paymentConfirmed: e.target.checked })}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <span>4. Rental fee ({formatPHP(reservation.subtotal)}) and deposit ({formatPHP(reservation.securityDeposit)}) collected/verified</span>
            </label>
          </div>
        </div>

        {/* Handover Condition Grade */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Handover Physical Condition Grade *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['Excellent', 'Good', 'Fair'] as CameraCondition[]).map((cond) => (
              <button
                key={cond}
                type="button"
                onClick={() => setCondition(cond)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  condition === cond
                    ? 'bg-zinc-900 border-zinc-900 text-white'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <ConditionBadge condition={cond} showIcon={false} />
              </button>
            ))}
          </div>
        </div>

        {/* Handover Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
            Handover Inspection Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-white border border-zinc-300 rounded-lg p-2.5 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!allChecked || isProcessing}
            className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isProcessing ? 'Processing...' : 'Complete Checkout'}</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
};
