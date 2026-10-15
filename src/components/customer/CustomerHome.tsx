'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSystem } from '../../context/SystemContext';
import { useAuth } from '../../context/AuthContext';
import { DigitalCamera } from '../../types';
import { formatPHP, getCameraImageUrl } from '../../lib/utils';
import { SEED_CAMERAS } from '../../data/seedData';
import { StatusBadge } from '../common/StatusBadge';
import { ReservationModal } from './ReservationModal';
import { CameraDetailModal } from './CameraDetailModal';
import {
  Camera,
  CalendarDays,
  CalendarCheck,
  MapPin,
  Clock,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Search,
  CheckCircle2,
  ChevronRight,
  Layers,
  Check,
  SlidersHorizontal,
  Compass,
  Building2,
  RotateCcw
} from 'lucide-react';

interface CustomerHomeProps {
  onNavigateTab: (tab: string) => void;
}

export const CustomerHome: React.FC<CustomerHomeProps> = ({ onNavigateTab }) => {
  const { cameras, reservations, currentUser } = useSystem();
  const { profile } = useAuth();
  const [selectedCameraForDetail, setSelectedCameraForDetail] = useState<DigitalCamera | null>(null);
  const [selectedCameraForReserve, setSelectedCameraForReserve] = useState<DigitalCamera | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Hero slideshow: Random cameras every 6 seconds
  const heroCameras = cameras && cameras.length > 0 ? cameras : SEED_CAMERAS;
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroFading, setIsHeroFading] = useState(false);

  useEffect(() => {
    if (heroCameras.length <= 1) return;

    const timer = setInterval(() => {
      setIsHeroFading(true);
      setTimeout(() => {
        setHeroIndex((prev) => {
          let next;
          do {
            next = Math.floor(Math.random() * heroCameras.length);
          } while (next === prev && heroCameras.length > 1);
          return next;
        });
        setIsHeroFading(false);
      }, 300);
    }, 6000);

    return () => clearInterval(timer);
  }, [heroCameras.length]);

  const currentHeroCamera = heroCameras[heroIndex] || heroCameras[0];

  // Customer's reservations and active rentals (scoped to authenticated customer)
  const myReservations = currentUser.id
    ? reservations.filter(
        r => r.customerId === currentUser.id || (currentUser.email && r.customerEmail === currentUser.email)
      )
    : [];
  const pendingApprovals = myReservations.filter(r => r.status === 'PENDING_APPROVAL');
  const activeRentals = myReservations.filter(r => r.status === 'CHECKED_OUT');
  const approvedUpcoming = myReservations.filter(r => r.status === 'APPROVED');

  // Featured cameras: Curated selection of 4 real digital cameras
  const availableCameras = cameras.filter(c => c.status === 'AVAILABLE');
  const featuredCameras = (availableCameras.length >= 4 ? availableCameras : cameras).slice(0, 4);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-white text-zinc-900 selection:bg-zinc-950 selection:text-white">
      {/* Active Customer Bookings Telemetry Pill (rendered only for logged-in users with bookings) */}
      {myReservations.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-zinc-950 text-white rounded-2xl p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs sm:text-sm font-medium">
                Active Rental Activity:{' '}
                <strong className="font-semibold text-zinc-100">
                  {pendingApprovals.length} Pending
                  {approvedUpcoming.length > 0 ? `, ${approvedUpcoming.length} Ready for Pickup` : ''}
                  {activeRentals.length > 0 ? `, ${activeRentals.length} In Field` : ''}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('my-reservations')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
            >
              <span>View My Reservations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          B. HERO SECTION — Two-column minimal editorial layout
          ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left side: Editorial typography & CTAs */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-900"></span>
                <span className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase">
                  RENT • SHOOT • CREATE
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-zinc-950 leading-[1.12]">
                Find the Right Camera for Your Next Story.
              </h1>

              {/* Supporting description */}
              <p className="text-base sm:text-lg text-zinc-600 leading-relaxed max-w-xl font-normal">
                Discover digital cameras for your next creative project, travel adventure, special occasion, or everyday moments. Explore your options and reserve a camera for your plans with IDIO.
              </p>

              {/* Action buttons & CTAs */}
              <div className="pt-2 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => onNavigateTab('catalog')}
                  aria-label="Browse Cameras"
                  className="inline-flex items-center gap-2 px-6 sm:px-7 py-3.5 min-h-[48px] rounded-full bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer group"
                >
                  <span>Explore Cameras</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="inline-flex items-center gap-2 px-5 sm:px-6 py-3.5 min-h-[48px] rounded-full bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-xs"
                >
                  <span>How It Works</span>
                </button>
              </div>

              {/* Small location label */}
              <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 pt-2 border-t border-zinc-100">
                <MapPin className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                <span>Serving Butuan City, Agusan del Norte</span>
              </div>
            </div>

            {/* Right side: Tasteful studio digital camera product visual (slideshow every 6s) */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl bg-zinc-50/80 border border-zinc-200/80 p-6 sm:p-8 flex flex-col items-center justify-center overflow-hidden shadow-xs">
                {/* Subtle neutral background shape */}
                <div className="absolute inset-0 bg-radial from-white via-zinc-50/50 to-zinc-100/40 pointer-events-none" />

                <div className="relative z-10 w-full flex flex-col items-center">
                  <div
                    onClick={() => setSelectedCameraForDetail(currentHeroCamera)}
                    className="w-full flex items-center justify-center cursor-pointer group"
                    title="Click to view camera specifications"
                  >
                    <img
                      src={getCameraImageUrl(currentHeroCamera.id, currentHeroCamera.imageUrl)}
                      alt={currentHeroCamera.name}
                      className={`w-full max-w-sm sm:max-w-md h-56 sm:h-64 md:h-72 object-contain select-none transition-all duration-500 ease-out group-hover:scale-[1.03] ${
                        isHeroFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                      }`}
                      loading="eager"
                    />
                  </div>

                  {/* Minimal camera showcase caption tag */}
                  <div
                    onClick={() => setSelectedCameraForDetail(currentHeroCamera)}
                    className={`mt-4 w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/95 border border-zinc-200/80 shadow-xs cursor-pointer hover:border-zinc-300 transition-all duration-500 ${
                      isHeroFading ? 'opacity-40' : 'opacity-100'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-xs text-zinc-950 leading-tight truncate">
                        {currentHeroCamera.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {currentHeroCamera.specs?.sensor || currentHeroCamera.specs?.megapixels || currentHeroCamera.category} • {formatPHP(currentHeroCamera.dailyRate)} / day
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {currentHeroCamera.status === 'AVAILABLE' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                          Available for Pickup
                        </span>
                      ) : (
                        <StatusBadge status={currentHeroCamera.status} size="sm" />
                      )}
                    </div>
                  </div>

                  {/* Slideshow pagination indicators */}
                  <div className="flex items-center justify-center gap-1.5 mt-3.5">
                    {heroCameras.map((cam, idx) => (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => {
                          setIsHeroFading(true);
                          setTimeout(() => {
                            setHeroIndex(idx);
                            setIsHeroFading(false);
                          }, 200);
                        }}
                        aria-label={`Show ${cam.name}`}
                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                          idx === heroIndex ? 'w-6 bg-zinc-900' : 'w-1.5 bg-zinc-300 hover:bg-zinc-400'
                        }`}
                        title={cam.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          C. CAMERA DISCOVERY CTA — Compact elegant browse area
          ========================================================================= */}
      <section className="border-y border-zinc-200/70 bg-zinc-50/60 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <h2 className="text-sm font-bold text-zinc-950">
                Explore the Complete Digital Camera Fleet
              </h2>
              <p className="text-xs text-zinc-500">
                Browse mirrorless, compact, DSLR, and creator kits ready for local counter pickup in Butuan City.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] uppercase font-bold text-zinc-400 hidden lg:inline-block pr-2">
                Categories:
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('catalog')}
                className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 text-xs font-medium hover:bg-zinc-100 transition cursor-pointer"
              >
                Mirrorless
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('catalog')}
                className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 text-xs font-medium hover:bg-zinc-100 transition cursor-pointer"
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('catalog')}
                className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 text-xs font-medium hover:bg-zinc-100 transition cursor-pointer"
              >
                DSLR
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('catalog')}
                className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 text-xs font-medium hover:bg-zinc-100 transition cursor-pointer"
              >
                Vlog &amp; Creator
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('catalog')}
                className="ml-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <span>Browse All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          D. TRUST AND SERVICE HIGHLIGHTS — Restrained row of four highlights
          ========================================================================= */}
      <section className="py-14 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Highlight 1 */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 hover:border-zinc-300 transition-colors shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 mb-4">
                <CalendarCheck className="w-5 h-5 stroke-[1.75]" />
              </div>
              <h3 className="text-sm font-bold text-zinc-950 mb-1.5">Easy Reservations</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Submit a camera reservation request through IDIO with transparent rental dates.
              </p>
            </div>

            {/* Highlight 2 */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 hover:border-zinc-300 transition-colors shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 mb-4">
                <Camera className="w-5 h-5 stroke-[1.75]" />
              </div>
              <h3 className="text-sm font-bold text-zinc-950 mb-1.5">Camera Collection</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Explore digital cameras for different creative needs, weddings, events, and travel.
              </p>
            </div>

            {/* Highlight 3 */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 hover:border-zinc-300 transition-colors shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 mb-4">
                <Clock className="w-5 h-5 stroke-[1.75]" />
              </div>
              <h3 className="text-sm font-bold text-zinc-950 mb-1.5">Clear Rental Process</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Follow the reservation, pickup, and return workflow with complete handover checklists.
              </p>
            </div>

            {/* Highlight 4 */}
            <div className="p-6 rounded-2xl bg-white border border-zinc-200/80 hover:border-zinc-300 transition-colors shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 mb-4">
                <MapPin className="w-5 h-5 stroke-[1.75]" />
              </div>
              <h3 className="text-sm font-bold text-zinc-950 mb-1.5">Local Service</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Dedicated digital camera rentals at our J.C. Aquino Ave hub in Butuan City.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          E. FEATURED CAMERAS — Preview of the collection
          ========================================================================= */}
      <section className="py-16 sm:py-20 bg-zinc-50/50 border-t border-zinc-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Heading */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold tracking-[0.18em] text-zinc-500 uppercase">
                  EXPLORE THE COLLECTION
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-zinc-200/70 text-zinc-700">
                  Featured Digital Cameras
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
                Find Your Next Camera
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-xl">
                Discover the cameras available for your next project. Inspected optics, sanitized sensors, and included batteries.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('catalog')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-900 transition cursor-pointer shrink-0 shadow-xs"
            >
              <span>View Full Fleet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredCameras.map((camera) => {
              const isAvailable = camera.status === 'AVAILABLE';
              return (
                <div
                  key={camera.id}
                  className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col group"
                >
                  {/* Camera Image Area */}
                  <div className="relative aspect-4/3 bg-zinc-50/70 border-b border-zinc-100 flex items-center justify-center p-5 overflow-hidden">
                    <img
                      src={getCameraImageUrl(camera.id, camera.imageUrl)}
                      alt={camera.name}
                      className="w-full h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Category pill */}
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/95 text-zinc-800 border border-zinc-200 shadow-2xs">
                      {camera.category}
                    </span>

                    {/* Status badge */}
                    <div className="absolute top-3 right-3">
                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Available
                        </span>
                      ) : (
                        <StatusBadge status={camera.status} size="sm" />
                      )}
                    </div>
                  </div>

                  {/* Camera Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                        {camera.brand}
                      </span>
                      <h3 className="font-bold text-sm text-zinc-950 truncate leading-snug" title={camera.name}>
                        {camera.name}
                      </h3>
                      <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                        {camera.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Daily Tariff</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-bold text-zinc-950">{formatPHP(camera.dailyRate)}</span>
                          <span className="text-[10px] text-zinc-400">/ day</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedCameraForDetail(camera)}
                          className="px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition cursor-pointer"
                        >
                          Specs
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCameraForReserve(camera)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>Reserve</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          F. HOW IT WORKS — Three concise steps
          ========================================================================= */}
      <section id="how-it-works" className="py-20 bg-white scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase block mb-2">
              RENTAL WORKFLOW
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
              How IDIO Works
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 mt-2">
              A simple, reliable local rental workflow designed for creators and storytellers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 01 */}
            <div className="p-8 rounded-2xl bg-zinc-50/70 border border-zinc-200/80 flex flex-col justify-between space-y-4 hover:border-zinc-300 transition-colors">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-mono font-extrabold text-zinc-300">01</span>
                  <div className="w-9 h-9 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-800">
                    <Compass className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-zinc-950">Explore</h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                  Browse the digital cameras and compare their details and rental rates.
                </p>
              </div>
              <span className="text-[11px] text-zinc-400 font-medium">Step 1 • Fleet discovery</span>
            </div>

            {/* Step 02 */}
            <div className="p-8 rounded-2xl bg-zinc-50/70 border border-zinc-200/80 flex flex-col justify-between space-y-4 hover:border-zinc-300 transition-colors">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-mono font-extrabold text-zinc-300">02</span>
                  <div className="w-9 h-9 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-800">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-zinc-950">Reserve</h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                  Choose your rental dates and submit a reservation request.
                </p>
              </div>
              <span className="text-[11px] text-zinc-400 font-medium">Step 2 • Date scheduling</span>
            </div>

            {/* Step 03 */}
            <div className="p-8 rounded-2xl bg-zinc-50/70 border border-zinc-200/80 flex flex-col justify-between space-y-4 hover:border-zinc-300 transition-colors">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-mono font-extrabold text-zinc-300">03</span>
                  <div className="w-9 h-9 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-800">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-zinc-950">Pick Up &amp; Return</h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                  Follow your reservation status and complete the rental process according to IDIO&apos;s existing workflow.
                </p>
              </div>
              <span className="text-[11px] text-zinc-400 font-medium">Step 3 • Counter handover</span>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-zinc-50 border border-zinc-200/70 text-center max-w-2xl mx-auto">
            <p className="text-xs text-zinc-500">
              Pickups and returns occur at our J.C. Aquino Ave counter in Butuan City. Payment and security deposit are settled in cash during physical equipment handover.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          G. ABOUT IDIO — Editorial brand presentation
          ========================================================================= */}
      <section id="about" className="py-20 bg-zinc-50/60 border-t border-zinc-200/70 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Story & Philosophy */}
            <div className="lg:col-span-7 space-y-4">
              <span className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase block">
                ABOUT IDIO
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-950 tracking-tight leading-tight">
                Made for People Who Love to Create
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 leading-relaxed pt-2">
                IDIO is a digital camera rental management platform designed to make discovering and reserving cameras simpler. Whether you&apos;re capturing a personal milestone, exploring photography, or working on a creative project, IDIO helps you discover camera options in one convenient place.
              </p>
              <div className="inline-flex items-center gap-2 pt-2 text-xs font-semibold text-zinc-700">
                <MapPin className="w-3.5 h-3.5 text-zinc-900" />
                <span>Serving Butuan City, Agusan del Norte.</span>
              </div>
            </div>

            {/* Core Values / Operational Standards */}
            <div className="lg:col-span-5 space-y-3">
              <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-2xs">
                <h4 className="text-xs font-bold text-zinc-950 uppercase tracking-wide">Dedicated to Digital Cameras</h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Exclusively focused on mirrorless, compact, DSLR, and creator cameras.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-2xs">
                <h4 className="text-xs font-bold text-zinc-950 uppercase tracking-wide">Local Counter Pickup</h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Convenient central pickup at J.C. Aquino Avenue, Butuan City.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-2xs">
                <h4 className="text-xs font-bold text-zinc-950 uppercase tracking-wide">Pre-Rental Inspection</h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Tested sensor cleanliness, fresh batteries, and included high-speed memory cards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          H. FINAL CALL TO ACTION — Clean minimalist closing section
          ========================================================================= */}
      <section className="py-20 sm:py-24 bg-white border-t border-zinc-200/70 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-zinc-950 tracking-tight">
            Ready for Your Next Shoot?
          </h2>

          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-xl mx-auto">
            Explore the collection and find a camera for your next creative adventure.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onNavigateTab('catalog')}
              className="inline-flex items-center gap-2 px-7 py-3.5 min-h-[48px] rounded-full bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer group"
            >
              <span>Browse Cameras</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 min-h-[48px] rounded-full bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 font-semibold text-xs sm:text-sm transition-all shadow-xs"
            >
              <span>Create an Account</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Specifications Details Dialog */}
      {selectedCameraForDetail && (
        <CameraDetailModal
          camera={selectedCameraForDetail}
          isOpen={!!selectedCameraForDetail}
          onClose={() => setSelectedCameraForDetail(null)}
          onReserve={(cam) => {
            setSelectedCameraForDetail(null);
            setSelectedCameraForReserve(cam);
          }}
        />
      )}

      {/* Authoritative Reservation Modal */}
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

