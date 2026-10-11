'use client';
import React from 'react';
import { DigitalCamera } from '../../types';
import { Dialog } from '../common/Dialog';
import { ConditionBadge } from '../common/ConditionBadge';
import { StatusBadge } from '../common/StatusBadge';
import { formatPHP, getCameraImageUrl } from '../../lib/utils';
import { 
  Camera, 
  Video, 
  Layers, 
  ShieldCheck, 
  Sparkles, 
  BatteryCharging, 
  Monitor, 
  Wifi, 
  Package, 
  CalendarDays,
  CheckCircle2,
  Info
} from 'lucide-react';

interface CameraDetailModalProps {
  camera: DigitalCamera | null;
  isOpen: boolean;
  onClose: () => void;
  onReserve: (camera: DigitalCamera) => void;
}

export const CameraDetailModal: React.FC<CameraDetailModalProps> = ({
  camera,
  isOpen,
  onClose,
  onReserve
}) => {
  if (!camera) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="text-zinc-900 font-bold">{camera.name}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono">
            {camera.serialNumber}
          </span>
        </div>
      }
      description={`Brand: ${camera.brand} • Category: ${camera.category}`}
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Top Image & Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-100/60 p-5 aspect-[4/3] flex items-center justify-center group shadow-xs">
            <img
              src={getCameraImageUrl(camera.id, camera.imageUrl)}
              alt={`${camera.brand} ${camera.name}`}
              className="w-full h-full object-contain filter drop-shadow-sm"
              loading="lazy"
            />
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              <StatusBadge status={camera.status} />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Overview</p>
              <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">{camera.description}</p>
            </div>

            {/* Pricing Details */}
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-zinc-500">Daily Rental Rate</span>
                <div className="text-right">
                  <span className="text-xl font-bold text-zinc-900">{formatPHP(camera.dailyRate)}</span>
                  <span className="text-xs text-zinc-500"> / 24 hrs</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-200 text-xs">
                <span className="text-zinc-600 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-700" />
                  Refundable Security Deposit
                </span>
                <span className="font-semibold text-zinc-900">{formatPHP(camera.securityDeposit)}</span>
              </div>
            </div>

            {/* Quick action button */}
            <button
              onClick={() => {
                onClose();
                onReserve(camera);
              }}
              disabled={camera.status === 'MAINTENANCE' || camera.status === 'DAMAGED'}
              className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <CalendarDays className="w-4 h-4" />
              <span>Reserve This Digital Camera</span>
            </button>
          </div>
        </div>

        {/* Technical Specifications Grid */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-zinc-700" />
            Technical Specifications
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-zinc-500 block mb-1 flex items-center gap-1">
                <Camera className="w-3 h-3 text-zinc-600" /> Sensor Type
              </span>
              <span className="font-semibold text-zinc-900">{camera.specs?.sensor || 'Full-Frame / APS-C'}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-zinc-500 block mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-zinc-600" /> Resolution
              </span>
              <span className="font-semibold text-zinc-900">{camera.specs?.megapixels || '24.0 MP'}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-zinc-500 block mb-1 flex items-center gap-1">
                <Video className="w-3 h-3 text-zinc-600" /> Video Resolution
              </span>
              <span className="font-semibold text-zinc-900">{camera.specs?.videoResolution || '4K UHD'}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-zinc-500 block mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-zinc-600" /> ISO Sensitivity
              </span>
              <span className="font-semibold text-zinc-900">{camera.specs?.isoRange || '100 - 25,600'}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-zinc-500 block mb-1 flex items-center gap-1">
                <Camera className="w-3 h-3 text-zinc-600" /> Lens / Mount Included
              </span>
              <span className="font-semibold text-zinc-900">{camera.specs?.lensMountOrKit || 'Kit Lens Included'}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-zinc-500 block mb-1 flex items-center gap-1">
                <Monitor className="w-3 h-3 text-zinc-600" /> Screen
              </span>
              <span className="font-semibold text-zinc-900">{camera.specs?.screen || '3.0-inch LCD'}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-zinc-500 block mb-1 flex items-center gap-1">
                <BatteryCharging className="w-3 h-3 text-zinc-600" /> Battery Life
              </span>
              <span className="font-semibold text-zinc-900">{camera.specs?.batteryLife || 'Approx. 400 shots'}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-zinc-500 block mb-1 flex items-center gap-1">
                <Wifi className="w-3 h-3 text-zinc-600" /> Connectivity
              </span>
              <span className="font-semibold text-zinc-900">{camera.specs?.connectivity || 'Wi-Fi / Bluetooth'}</span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <span className="text-zinc-500 block mb-1 flex items-center gap-1">
                <Info className="w-3 h-3 text-zinc-600" /> Weight (Body Only)
              </span>
              <span className="font-semibold text-zinc-900">{camera.specs?.weight || '500g'}</span>
            </div>
          </div>
        </div>

        {/* Inclusions Package */}
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-zinc-700" />
            Standard Rental Kit Inclusions
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {camera.packageIncludes.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-zinc-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-900 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
