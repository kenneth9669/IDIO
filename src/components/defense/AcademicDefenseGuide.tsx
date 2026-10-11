'use client';
import React from 'react';
import { Dialog } from '../common/Dialog';
import { 
  ShieldCheck, 
  Workflow, 
  MapPin, 
  Camera, 
  Layers, 
  Cpu
} from 'lucide-react';

interface AcademicDefenseGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AcademicDefenseGuide: React.FC<AcademicDefenseGuideProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-zinc-900">
          <Layers className="w-5 h-5 text-zinc-700" />
          <span>System Architecture &amp; Defense Reference</span>
        </div>
      }
      description="Engineering reference for panel defense: Domain modeling, state transitions, security, and Butuan City localized business rules."
      maxWidth="3xl"
    >
      <div className="space-y-6 text-sm text-zinc-700">
        {/* Abstract */}
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
          <h4 className="text-zinc-900 font-semibold flex items-center gap-2 mb-1.5 text-xs uppercase tracking-wider">
            <Camera className="w-4 h-4 text-zinc-500" />
            Product Scope &amp; Purpose
          </h4>
          <p className="leading-relaxed text-xs text-zinc-600">
            <strong>IDIO</strong> is a specialized <strong>Digital Camera Rental Management System</strong> engineered for 
            camera-rental operations in <strong>Butuan City, Agusan del Norte, Philippines</strong>. It automates 
            the end-to-end rental lifecycle: catalog discovery, server-enforced availability conflict resolution, 
            admin checkout inspection, condition grading, damage deposit deduction, and post-rental maintenance routing.
          </p>
        </div>

        {/* 1. Core State Machine */}
        <div>
          <h4 className="text-zinc-900 font-semibold flex items-center gap-2 mb-2 text-xs uppercase tracking-wider">
            <Workflow className="w-4 h-4 text-zinc-500" />
            1. Rental Lifecycle State Machine
          </h4>
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3 font-mono text-xs text-zinc-800">
            <div className="flex flex-wrap items-center gap-2 text-center text-[11px]">
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 font-semibold">AVAILABLE</span>
              <span className="text-zinc-400">→</span>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded border border-amber-200 font-medium">RESERVED (Pending)</span>
              <span className="text-zinc-400">→</span>
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200 font-medium">APPROVED</span>
              <span className="text-zinc-400">→</span>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-medium">CHECKED OUT</span>
              <span className="text-zinc-400">→</span>
              <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded border border-teal-200 font-medium">RETURNED</span>
              <span className="text-zinc-400">→</span>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 font-semibold">COMPLETED</span>
            </div>
            <div className="border-t border-zinc-200 pt-2 text-zinc-600 font-sans text-xs">
              <p className="font-semibold text-zinc-900">Exceptions:</p>
              <ul className="list-disc list-inside mt-1 space-y-1 text-zinc-600">
                <li><strong>MAINTENANCE</strong>: Triggered manually by Admin or upon return of Fair/Defective equipment. Locks availability.</li>
                <li><strong>DAMAGED</strong>: Handled with deposit deduction or forfeiture; locks camera out of availability until cleared.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 2. Availability Engine & Conflict Prevention */}
        <div>
          <h4 className="text-zinc-900 font-semibold flex items-center gap-2 mb-2 text-xs uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-zinc-500" />
            2. Server-Enforced Availability Algorithm
          </h4>
          <p className="text-zinc-600 mb-2 text-xs">
            Availability is determined by a strict time-interval intersection algorithm that prevents double-booking:
          </p>
          <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 font-mono text-xs text-zinc-800">
            HasConflict = (RequestedStart &lt;= ExistingEnd) &amp;&amp; (RequestedEnd &gt;= ExistingStart)<br />
            Where ExistingReservation.Status IN [&apos;PENDING_APPROVAL&apos;, &apos;APPROVED&apos;, &apos;CHECKED_OUT&apos;]
          </div>
        </div>

        {/* 3. Role-Based Access Control (RBAC) */}
        <div>
          <h4 className="text-zinc-900 font-semibold flex items-center gap-2 mb-2 text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-zinc-500" />
            3. Role-Based Access Matrix
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-zinc-200 rounded-lg overflow-hidden">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="p-2.5 border-b border-zinc-200 font-semibold">Capability / Action</th>
                  <th className="p-2.5 border-b border-zinc-200 text-center font-semibold">Customer</th>
                  <th className="p-2.5 border-b border-zinc-200 text-center font-semibold">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                <tr>
                  <td className="p-2 font-medium text-zinc-900">Browse Catalog &amp; Check Availability</td>
                  <td className="p-2 text-center text-emerald-600 font-bold">✓</td>
                  <td className="p-2 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-zinc-900">Submit Camera Reservation &amp; View Vouchers</td>
                  <td className="p-2 text-center text-emerald-600 font-bold">✓</td>
                  <td className="p-2 text-center text-zinc-300">—</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-zinc-900">Approve / Reject Customer Reservations</td>
                  <td className="p-2 text-center text-zinc-300">—</td>
                  <td className="p-2 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-zinc-900">Execute Checkout &amp; Record Handover Condition</td>
                  <td className="p-2 text-center text-zinc-300">—</td>
                  <td className="p-2 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-zinc-900">Execute Return Inspection &amp; Deposit Settlement</td>
                  <td className="p-2 text-center text-zinc-300">—</td>
                  <td className="p-2 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-zinc-900">Add/Edit Camera Fleet, Serials &amp; Daily Pricing</td>
                  <td className="p-2 text-center text-zinc-300">—</td>
                  <td className="p-2 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-zinc-900">Revenue &amp; Utilization Analytics</td>
                  <td className="p-2 text-center text-zinc-300">—</td>
                  <td className="p-2 text-center text-emerald-600 font-bold">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Butuan City Domain Customization */}
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
          <h4 className="text-zinc-900 font-semibold flex items-center gap-2 mb-1.5 text-xs uppercase tracking-wider">
            <MapPin className="w-4 h-4 text-zinc-500" />
            4. Localized Butuan City Service Area
          </h4>
          <p className="text-xs leading-relaxed text-zinc-600">
            Address verification is bound to 20 curated Butuan City barangays (Libertad, San Vicente, Ambago, Baan Km. 3, 
            Doongan, Ampayon, Villa Kananga, Holy Redeemer, etc.) with fixed province (Agusan del Norte) to enforce strict local counter pickup and verification.
          </p>
        </div>
      </div>
    </Dialog>
  );
};
