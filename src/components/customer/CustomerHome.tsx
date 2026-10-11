'use client';

import React, { useState } from 'react';
import { useSystem } from '../../context/SystemContext';
import { useAuth } from '../../context/AuthContext';
import { DigitalCamera } from '../../types';
import { formatPHP, formatDate, getCameraImageUrl } from '../../lib/utils';
import { StatusBadge } from '../common/StatusBadge';
import { ReservationModal } from './ReservationModal';
import {
  Camera,
  CalendarDays,
  CreditCard,
  MapPin,
  Clock,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  Coins
} from 'lucide-react';

interface CustomerHomeProps {
  onNavigateTab: (tab: string) => void;
}

export const CustomerHome: React.FC<CustomerHomeProps> = ({ onNavigateTab }) => {
  const { cameras, reservations, currentUser } = useSystem();
  const { profile } = useAuth();
  const [selectedCameraForReserve, setSelectedCameraForReserve] = useState<DigitalCamera | null>(null);

  const customerName = profile?.full_name || currentUser.name || 'Photographer';

  // Customer's reservations and active rentals
  const myReservations = reservations.filter(
    r => r.customerId === currentUser.id || r.customerEmail === currentUser.email
  );
  const pendingApprovals = myReservations.filter(r => r.status === 'PENDING_APPROVAL');
  const activeRentals = myReservations.filter(r => r.status === 'CHECKED_OUT');
  const approvedUpcoming = myReservations.filter(r => r.status === 'APPROVED');

  // Featured available cameras (first 3 available, or first 3 overall)
  const availableCameras = cameras.filter(c => c.status === 'AVAILABLE');
  const featuredCameras = (availableCameras.length >= 3 ? availableCameras : cameras).slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden bg-white border border-zinc-200 text-zinc-900 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-xs">
        {/* Subtle decorative background pattern */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-zinc-100/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-48 h-48 bg-zinc-100/40 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-[11px] font-semibold text-zinc-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Butuan City Premier Digital Camera Rental</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-zinc-900 leading-tight">
            Digital Camera Rentals
          </h1>

          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
            Reserve premium digital mirrorless, DSLR, and compact cameras with instant availability checks and simple cash payment on pickup at our J.C. Aquino Ave hub.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('catalog')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs sm:text-sm shadow-xs transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Browse Cameras</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('my-reservations')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 font-semibold text-xs sm:text-sm transition cursor-pointer shadow-xs"
            >
              <CalendarDays className="w-4 h-4 text-zinc-500" />
              <span>My Reservations ({myReservations.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Operational Highlights & Location */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-zinc-200 rounded-xl flex items-start gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900">Butuan City Hub</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">J.C. Aquino Ave (Downtown)</p>
          </div>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-xl flex items-start gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900">Operating Hours</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Mon–Sat 8AM–7PM • Sun 9AM–5PM</p>
          </div>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-xl flex items-start gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800 shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900">Cash on Pickup</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Pay &amp; verify during equipment release</p>
          </div>
        </div>
      </div>

      {/* Active Customer Bookings / Telemetry Summary */}
      {myReservations.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-zinc-700" />
              <h2 className="text-sm font-bold text-zinc-900">Current Booking Status</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('my-reservations')}
              className="text-xs text-zinc-600 hover:text-zinc-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-100 space-y-1">
              <span className="text-[11px] font-medium text-zinc-500">Pending Approvals</span>
              <p className="text-xl font-bold text-amber-600">{pendingApprovals.length}</p>
              <span className="text-[10px] text-zinc-400">Awaiting admin review</span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-100 space-y-1">
              <span className="text-[11px] font-medium text-zinc-500">Ready for Pickup</span>
              <p className="text-xl font-bold text-emerald-600">{approvedUpcoming.length}</p>
              <span className="text-[10px] text-zinc-400">Approved for scheduled dates</span>
            </div>

            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-100 space-y-1">
              <span className="text-[11px] font-medium text-zinc-500">Active Field Rentals</span>
              <p className="text-xl font-bold text-indigo-600">{activeRentals.length}</p>
              <span className="text-[10px] text-zinc-400">Equipment in your care</span>
            </div>
          </div>
        </div>
      )}

      {/* Featured Digital Cameras Fleet Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Featured Digital Cameras</h2>
            <p className="text-xs text-zinc-500">Curated high-performance cameras available for immediate booking</p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('catalog')}
            className="text-xs text-zinc-700 hover:text-zinc-900 font-bold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition cursor-pointer"
          >
            <span>View Full Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredCameras.map(camera => (
            <div
              key={camera.id}
              className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="relative aspect-4/3 bg-zinc-100 border-b border-zinc-100 overflow-hidden flex items-center justify-center p-4">
                <img
                  src={getCameraImageUrl(camera.id, camera.imageUrl)}
                  alt={camera.name}
                  className="w-full h-full object-contain mix-blend-multiply"
                  loading="lazy"
                />
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/90 text-zinc-800 border border-zinc-200 backdrop-blur-xs">
                  {camera.category}
                </span>
                <span className="absolute top-3 right-3">
                  <StatusBadge status={camera.status} size="sm" />
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 truncate">{camera.name}</h3>
                  <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{camera.description}</p>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Daily Tariff</span>
                    <span className="text-sm font-bold text-zinc-900">{formatPHP(camera.dailyRate)}</span>
                    <span className="text-[10px] text-zinc-400"> / day</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCameraForReserve(camera)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>Reserve</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reservation Modal */}
      {selectedCameraForReserve && (
        <ReservationModal
          camera={selectedCameraForReserve}
          isOpen={!!selectedCameraForReserve}
          onClose={() => setSelectedCameraForReserve(null)}
          onSuccess={() => {
            setSelectedCameraForReserve(null);
            onNavigateTab('my-reservations');
          }}
        />
      )}
    </div>
  );
};
