'use client';
import React from 'react';
import { Camera, MapPin, Phone, Shield, Clock } from 'lucide-react';
import { STORE_ADDRESS, STORE_CONTACT } from '../../data/seedData';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-zinc-200 text-zinc-600 py-10 mt-auto text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Purpose */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-bold">
                <Camera className="w-4 h-4 stroke-[2]" />
              </div>
              <span className="text-base font-bold text-zinc-900 tracking-tight">IDIO</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 font-medium">
                Digital Camera Rental Management
              </span>
            </div>
            <p className="text-xs text-zinc-500 max-w-md leading-relaxed">
              IDIO is a specialized digital-camera rental management platform engineered for creators, photographers,
              and visual storytellers in Butuan City, Agusan del Norte. Simple, reliable, and production-ready.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5 text-zinc-700">
                <Shield className="w-4 h-4 text-zinc-900" />
                Deposit Protected
              </span>
              <span className="flex items-center gap-1.5 text-zinc-700">
                <Camera className="w-4 h-4 text-zinc-900" />
                Inspected Fleet (Grades A &amp; B)
              </span>
            </div>
          </div>

          {/* Hub Location */}
          <div className="space-y-2">
            <h4 className="text-zinc-900 font-semibold text-xs tracking-wider uppercase flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-700" />
              Store Location
            </h4>
            <p className="text-xs text-zinc-600 leading-relaxed">
              {STORE_ADDRESS}
            </p>
            <p className="text-xs text-zinc-500 font-medium pt-1">
              Counter Pickups &amp; In-Person Inspections Only
            </p>
          </div>

          {/* Contact & Hours */}
          <div className="space-y-2">
            <h4 className="text-zinc-900 font-semibold text-xs tracking-wider uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-700" />
              Operating Hours
            </h4>
            <p className="text-xs text-zinc-600">
              Mon – Sat: 8:00 AM – 7:00 PM<br />
              Sunday: 9:00 AM – 5:00 PM
            </p>
            <div className="pt-2 flex items-center gap-1.5 text-xs text-zinc-700">
              <Phone className="w-3.5 h-3.5 text-zinc-900" />
              <span>{STORE_CONTACT}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} IDIO Digital Camera Rental System • Butuan City, Agusan del Norte.</p>
          <p className="text-zinc-400">Engineering Defense Edition • Software Architecture Standard</p>
        </div>
      </div>
    </footer>
  );
};
