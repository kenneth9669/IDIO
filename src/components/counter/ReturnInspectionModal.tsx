'use client';
import React, { useState } from 'react';
import { Reservation, CameraCondition } from '../../types';
import { useSystem } from '../../context/SystemContext';
import { Dialog } from '../common/Dialog';
import { ConditionBadge } from '../common/ConditionBadge';
import { formatPHP } from '../../lib/utils';
import { 
  AlertTriangle, 
  Wrench, 
  RotateCcw,
  Layers,
  Coins,
  CheckCircle2
} from 'lucide-react';

interface ReturnInspectionModalProps {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReturnInspectionModal: React.FC<ReturnInspectionModalProps> = ({
  reservation,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { returnInspectionRental } = useSystem();

  const [returnCondition, setReturnCondition] = useState<CameraCondition>('Good');
  const [depositAction, setDepositAction] = useState<'REFUND_FULL' | 'DEDUCT_DAMAGE' | 'FORFEIT'>('REFUND_FULL');
  const [deductionAmount, setDeductionAmount] = useState<number>(0);
  const [deductionReason, setDeductionReason] = useState<string>('');
  const [flagMaintenance, setFlagMaintenance] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('All accessories accounted for. Sensor inspection clear.');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!reservation) return null;

  const handleConditionChange = (newCond: CameraCondition) => {
    setReturnCondition(newCond);
    if (newCond === 'Damaged') {
      setDepositAction('DEDUCT_DAMAGE');
      setDeductionAmount(reservation.securityDeposit);
      setDeductionReason('Physical damage detected during inspection.');
      setFlagMaintenance(true);
    } else if (newCond === 'Fair') {
      setFlagMaintenance(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (depositAction === 'DEDUCT_DAMAGE') {
      if (deductionAmount <= 0) {
        setErrorMessage('Please enter a valid deduction amount.');
        return;
      }
      if (deductionAmount > reservation.securityDeposit) {
        setErrorMessage(`Deduction cannot exceed total security deposit of ${formatPHP(reservation.securityDeposit)}.`);
        return;
      }
      if (!deductionReason.trim()) {
        setErrorMessage('Please state the specific reason for deposit deduction.');
        return;
      }
    }

    setIsProcessing(true);
    try {
      const result = await returnInspectionRental(
        reservation.id,
        returnCondition,
        notes,
        depositAction,
        depositAction === 'DEDUCT_DAMAGE' ? deductionAmount : depositAction === 'FORFEIT' ? reservation.securityDeposit : 0,
        deductionReason,
        flagMaintenance
      );
      setIsProcessing(false);

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(result.message);
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Error processing return inspection.');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-zinc-900">
          <RotateCcw className="w-5 h-5 text-zinc-700" />
          <span>Camera Return &amp; Condition Inspection</span>
        </div>
      }
      description={`Rental Ref: ${reservation.referenceNo} • Customer: ${reservation.customerName}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 text-sm text-zinc-700">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Camera Asset Header */}
        <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center gap-4">
          <img
            src={reservation.cameraImageUrl}
            alt={reservation.cameraName}
            className="w-14 h-14 rounded-lg object-cover border border-zinc-200 shrink-0 bg-white"
          />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {reservation.cameraBrand}
            </span>
            <h4 className="font-semibold text-zinc-900 text-sm truncate">{reservation.cameraName}</h4>
            <p className="text-xs text-zinc-500 font-mono">
              Serial No: <span className="text-zinc-800 font-medium">{reservation.cameraSerial}</span>
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              Held Security Deposit: <strong className="font-semibold text-zinc-900">{formatPHP(reservation.securityDeposit)}</strong>
            </p>
          </div>
        </div>

        {/* Condition Grading Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-zinc-400" />
            Return Physical Condition Grade *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['Excellent', 'Good', 'Fair', 'Damaged'] as CameraCondition[]).map((cond) => (
              <button
                key={cond}
                type="button"
                onClick={() => handleConditionChange(cond)}
                className={`py-2.5 px-2 rounded-lg border text-xs font-medium transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  returnCondition === cond
                    ? cond === 'Damaged'
                      ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-200'
                      : 'bg-zinc-900 border-zinc-900 text-white'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <ConditionBadge condition={cond} showIcon={false} />
                <span className={`text-[10px] mt-0.5 ${returnCondition === cond && cond !== 'Damaged' ? 'text-zinc-300' : 'text-zinc-400'}`}>
                  {cond === 'Excellent' && 'Pristine / Clean'}
                  {cond === 'Good' && 'Normal Wear'}
                  {cond === 'Fair' && 'Needs Clean/Tune'}
                  {cond === 'Damaged' && 'Defects / Broken'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Inspection Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
            Physical Inspection Findings &amp; Checklist Notes *
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            required
            placeholder="Document sensor test, shutter count check, LCD condition, and accessory return..."
            className="w-full bg-white border border-zinc-300 rounded-lg p-2.5 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
          />
        </div>

        {/* Security Deposit Settlement */}
        <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-zinc-400" />
              Security Deposit Settlement
            </h4>
            <span className="text-xs font-medium text-zinc-900">
              Held: {formatPHP(reservation.securityDeposit)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setDepositAction('REFUND_FULL');
                setDeductionAmount(0);
                setDeductionReason('');
              }}
              className={`p-3 rounded-lg border text-left text-xs transition cursor-pointer ${
                depositAction === 'REFUND_FULL'
                  ? 'bg-white border-zinc-900 text-zinc-900 shadow-xs ring-1 ring-zinc-900'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              <div className="font-semibold text-zinc-900">100% Full Refund</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Release {formatPHP(reservation.securityDeposit)}</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDepositAction('DEDUCT_DAMAGE');
                if (deductionAmount === 0) setDeductionAmount(500);
              }}
              className={`p-3 rounded-lg border text-left text-xs transition cursor-pointer ${
                depositAction === 'DEDUCT_DAMAGE'
                  ? 'bg-white border-zinc-900 text-zinc-900 shadow-xs ring-1 ring-zinc-900'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              <div className="font-semibold text-zinc-900">Partial Deduction</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Deduct damage / cleaning fee</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDepositAction('FORFEIT');
                setDeductionAmount(reservation.securityDeposit);
                setDeductionReason('Severe damage / non-functional equipment.');
              }}
              className={`p-3 rounded-lg border text-left text-xs transition cursor-pointer ${
                depositAction === 'FORFEIT'
                  ? 'bg-white border-rose-600 text-rose-900 shadow-xs ring-1 ring-rose-600'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              <div className="font-semibold text-zinc-900">Full Forfeiture</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Retain 100% of deposit</div>
            </button>
          </div>

          {/* Partial Deduction Details */}
          {depositAction === 'DEDUCT_DAMAGE' && (
            <div className="p-3 bg-white border border-zinc-200 rounded-lg space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-700 font-medium mb-1">
                    Deduction Penalty Amount (₱) *
                  </label>
                  <input
                    type="number"
                    value={deductionAmount}
                    max={reservation.securityDeposit}
                    min={1}
                    onChange={(e) => setDeductionAmount(Number(e.target.value))}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-zinc-900"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <p className="text-zinc-500 text-[11px]">
                    Remaining Refund to Customer:{' '}
                    <strong className="text-zinc-900 text-sm font-semibold">
                      {formatPHP(Math.max(0, reservation.securityDeposit - deductionAmount))}
                    </strong>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-zinc-700 font-medium mb-1">
                  Reason for Deduction / Penalty *
                </label>
                <input
                  type="text"
                  value={deductionReason}
                  onChange={(e) => setDeductionReason(e.target.value)}
                  placeholder="e.g. Scratched front lens filter, deep body scuff, missing lens cap"
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-zinc-900"
                />
              </div>
            </div>
          )}
        </div>

        {/* Maintenance Flag Option */}
        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={flagMaintenance}
              onChange={(e) => setFlagMaintenance(e.target.checked)}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
            />
            <span className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-zinc-500" />
              Route camera immediately to <strong>Maintenance Queue</strong> for cleaning / repairs
            </span>
          </label>
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
            disabled={isProcessing}
            className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isProcessing ? 'Finalizing...' : 'Complete Return'}</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
};
