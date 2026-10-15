'use client';
import React from 'react';
import Link from 'next/link';
import { Camera, MapPin, Phone, Shield, Clock, ArrowUpRight } from 'lucide-react';
import { STORE_ADDRESS, STORE_CONTACT } from '../../data/seedData';

interface FooterProps {
  onNavigateTab?: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateTab }) => {
  const handleNavClick = (tab: string, hash?: string) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
      if (hash) {
        setTimeout(() => {
          const el = document.getElementById(hash);
          el?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else if (hash) {
      const el = document.getElementById(hash);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-white border-t border-zinc-200 text-zinc-600 py-12 mt-auto text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand & Purpose */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-bold shrink-0">
                <Camera className="w-4 h-4 stroke-[2]" />
              </div>
              <span className="text-base font-bold text-zinc-900 tracking-tight">IDIO</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 font-medium">
                Digital Camera Rental Management
              </span>
            </div>
            <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
              IDIO is a specialized digital-camera rental management platform designed to make discovering and reserving cameras simpler for creators, photographers, and studios in Butuan City, Agusan del Norte.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5 text-zinc-700">
                <Shield className="w-4 h-4 text-zinc-900 shrink-0" />
                Deposit Protected
              </span>
              <span className="flex items-center gap-1.5 text-zinc-700">
                <Camera className="w-4 h-4 text-zinc-900 shrink-0" />
                100% Digital Cameras
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-zinc-900 font-semibold text-xs tracking-wider uppercase">
              Explore
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => handleNavClick('home')}
                  className="hover:text-zinc-900 transition cursor-pointer"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavClick('catalog')}
                  className="hover:text-zinc-900 transition cursor-pointer"
                >
                  Cameras
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavClick('home', 'how-it-works')}
                  className="hover:text-zinc-900 transition cursor-pointer"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavClick('home', 'about')}
                  className="hover:text-zinc-900 transition cursor-pointer"
                >
                  About IDIO
                </button>
              </li>
            </ul>
          </div>

          {/* Customer & Account */}
          <div className="space-y-3">
            <h4 className="text-zinc-900 font-semibold text-xs tracking-wider uppercase">
              Account &amp; Access
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => handleNavClick('catalog')}
                  className="hover:text-zinc-900 transition cursor-pointer"
                >
                  Browse Camera Fleet
                </button>
              </li>
              <li>
                <Link href="/login" className="hover:text-zinc-900 transition">
                  Log In
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-zinc-900 transition">
                  Create Customer Account
                </Link>
              </li>
              <li>
                <span className="text-[11px] text-zinc-400 block pt-1">
                  Cash on Counter Pickup Only
                </span>
              </li>
            </ul>
          </div>

          {/* Store Hub & Hours */}
          <div className="space-y-3">
            <h4 className="text-zinc-900 font-semibold text-xs tracking-wider uppercase flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-700" />
              Service Area &amp; Hub
            </h4>
            <p className="text-xs text-zinc-600 leading-relaxed">
              {STORE_ADDRESS}
            </p>
            <div className="space-y-1 pt-1 text-xs text-zinc-500">
              <p className="flex items-center gap-1.5 text-zinc-700">
                <Clock className="w-3.5 h-3.5 text-zinc-900 shrink-0" />
                <span>Mon–Sat 8AM–7PM • Sun 9AM–5PM</span>
              </p>
              <p className="flex items-center gap-1.5 text-zinc-700">
                <Phone className="w-3.5 h-3.5 text-zinc-900 shrink-0" />
                <span>{STORE_CONTACT}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} IDIO Digital Camera Rental System • Butuan City, Agusan del Norte.</p>
          <p className="text-zinc-400">Engineering Defense Edition • Software Architecture Standard</p>
        </div>
      </div>
    </footer>
  );
};

