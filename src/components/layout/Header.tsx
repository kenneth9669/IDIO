'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useSystem } from '../../context/SystemContext';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import {
  Camera,
  MapPin,
  RotateCcw,
  BookOpen,
  Shield,
  User,
  LogOut,
  LogIn,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  Layers,
  CalendarDays,
  SlidersHorizontal,
  CreditCard,
  Bell
} from 'lucide-react';
import { useUser, UserButton } from '@clerk/nextjs';
import { AcademicDefenseGuide } from '../defense/AcademicDefenseGuide';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { resetToDefaults } = useSystem();
  const { user, profile, role: authRole, signOut, isLoading } = useAuth();
  const { isSignedIn, isLoaded: isClerkLoaded } = useUser();
  const [showDefenseGuide, setShowDefenseGuide] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Authenticated role is derived from the real Supabase session — cannot be mutated client-side
  const currentRole: UserRole = authRole || 'CUSTOMER';

  const isCustomerSignedIn = Boolean((isClerkLoaded && isSignedIn) || (user && profile));

  const handleMobileNavClick = (tab: string) => {
    setActiveTab(tab);
    setIsMobileDrawerOpen(false);
  };

  const scrollToSection = (sectionId: string) => {
    setIsMobileDrawerOpen(false);
    if (activeTab !== 'home') {
      setActiveTab('home');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const customerNavItems = [
    { id: 'home', label: 'Home', icon: Sparkles, desc: 'Overview, welcome & featured fleet' },
    { id: 'catalog', label: 'Browse Cameras', icon: Camera, desc: 'Digital camera fleet & booking' },
    { id: 'my-reservations', label: 'My Reservations', icon: CalendarDays, desc: 'Booking history & approvals' },
    { id: 'rentals-payments', label: 'My Rentals & Payments', icon: SlidersHorizontal, desc: 'Active gear, invoices & deposits' },
    { id: 'account', label: 'My Account', icon: User, desc: 'Profile, Butuan address & alerts' }
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 text-zinc-900">
        {/* Top Operational Bar */}
        <div className="bg-zinc-50 px-3 sm:px-4 py-1.5 border-b border-zinc-200 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs">
            <span className="flex items-center gap-1.5 text-zinc-800 font-medium truncate">
              <MapPin className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span className="truncate">Butuan City Branch (J.C. Aquino Ave)</span>
            </span>
            <span className="hidden md:inline-block text-zinc-300">|</span>
            <span className="hidden md:inline-block text-zinc-500">
              Hours: Mon–Sat 8:00 AM – 7:00 PM • Sun 9:00 AM – 5:00 PM
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setShowDefenseGuide(true)}
              className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-zinc-700 hover:text-zinc-900 font-medium px-2 py-1 min-h-[36px] rounded hover:bg-zinc-100 transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Engineering Defense</span>
              <span className="xs:hidden">Defense</span>
            </button>

            <button
              onClick={() => setShowResetConfirm(true)}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-zinc-500 hover:text-rose-600 px-2 py-1 min-h-[36px] rounded hover:bg-zinc-100 transition cursor-pointer"
              title="Reset all data to seed state"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Main Navbar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
            {/* Brand Logo */}
            <div
              className="flex items-center gap-2.5 cursor-pointer py-1"
              onClick={() => setActiveTab('home')}
            >
              <div className="w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-bold shadow-xs shrink-0">
                <Camera className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-lg font-bold tracking-tight text-zinc-900">IDIO</span>
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-200 rounded">
                    Digital Cameras
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 -mt-0.5 truncate">Butuan Rental Hub</p>
              </div>
            </div>

            {/* Desktop Navigation Links (>= xl) */}
            <nav className="hidden xl:flex items-center space-x-1">
              {currentRole === 'CUSTOMER' && (
                <>
                  <button
                    onClick={() => setActiveTab('home')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition min-h-[44px] inline-flex items-center cursor-pointer ${
                      activeTab === 'home' || activeTab === 'dashboard'
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    Home
                  </button>
                  <button
                    onClick={() => setActiveTab('catalog')}
                    aria-label="Browse Cameras"
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition min-h-[44px] inline-flex items-center cursor-pointer ${
                      activeTab === 'catalog'
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    Cameras
                  </button>
                  <button
                    onClick={() => scrollToSection('how-it-works')}
                    className="px-3 py-2 rounded-lg text-xs font-semibold transition min-h-[44px] inline-flex items-center cursor-pointer text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    How It Works
                  </button>
                  <button
                    onClick={() => scrollToSection('about')}
                    className="px-3 py-2 rounded-lg text-xs font-semibold transition min-h-[44px] inline-flex items-center cursor-pointer text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    About
                  </button>

                  {/* Additional tabs rendered when authenticated as a customer */}
                  {isCustomerSignedIn && (
                    <>
                      <button
                        onClick={() => setActiveTab('my-reservations')}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition min-h-[44px] inline-flex items-center cursor-pointer ${
                          activeTab === 'my-reservations'
                            ? 'bg-zinc-900 text-white shadow-xs'
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                        }`}
                      >
                        My Reservations
                      </button>
                      <button
                        onClick={() => setActiveTab('rentals-payments')}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition min-h-[44px] inline-flex items-center cursor-pointer ${
                          activeTab === 'rentals-payments' || activeTab === 'my-rentals' || activeTab === 'payments'
                            ? 'bg-zinc-900 text-white shadow-xs'
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                        }`}
                      >
                        My Rentals &amp; Payments
                      </button>
                      <button
                        onClick={() => setActiveTab('account')}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition min-h-[44px] inline-flex items-center cursor-pointer ${
                          activeTab === 'account' || activeTab === 'profile' || activeTab === 'notifications'
                            ? 'bg-zinc-900 text-white shadow-xs'
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                        }`}
                      >
                        My Account
                      </button>
                    </>
                  )}
                </>
              )}
            </nav>

            {/* Session Controls & Mobile Hamburger */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Authenticated Profile or Login & Sign Up Buttons */}
              {isClerkLoaded && isSignedIn ? (
                <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
                  <UserButton />
                </div>
              ) : user && profile ? (
                <div className="hidden sm:flex items-center gap-3 pl-2 border-l border-zinc-200">
                  <div className="text-left">
                    <p className="text-xs font-bold text-zinc-900 leading-tight flex items-center gap-1.5">
                      <span>{profile.full_name}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                        profile.role === 'ADMIN'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                      }`}>
                        {profile.role}
                      </span>
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-tight truncate max-w-[120px]">
                      {profile.barangay}, Butuan
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    title="Sign Out"
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-500 hover:text-rose-600 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-zinc-200">
                  <Link
                    href="/login"
                    className="px-3.5 py-2 min-h-[44px] inline-flex items-center text-xs font-semibold text-zinc-700 hover:text-zinc-950 transition"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition shadow-xs"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign Up</span>
                  </Link>
                </div>
              )}

              {/* Mobile Drawer Trigger (Hamburger) */}
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                className="xl:hidden p-2.5 min-h-[44px] min-w-[44px] rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition cursor-pointer"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tablet & Mobile Horizontal Fast-Pills */}
        <div className="xl:hidden px-3 py-2 border-t border-zinc-200 overflow-x-auto flex gap-1.5 bg-zinc-50/70 scrollbar-none">
          {isCustomerSignedIn ? (
            customerNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-label={item.label}
                className={`px-3 py-1.5 min-h-[38px] rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === item.id
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <span>{item.label}</span>
              </button>
            ))
          ) : (
            <>
              <button
                onClick={() => setActiveTab('home')}
                className={`px-3 py-1.5 min-h-[38px] rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'home'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => setActiveTab('catalog')}
                aria-label="Browse Cameras"
                className={`px-3 py-1.5 min-h-[38px] rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'catalog'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                Cameras
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="px-3 py-1.5 min-h-[38px] rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="px-3 py-1.5 min-h-[38px] rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
              >
                About
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile Full Navigation Drawer / Sheet */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative z-10 w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div>
              <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-bold">
                    <Camera className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-zinc-900">IDIO Rental Hub</span>
                    <p className="text-[10px] text-zinc-500">Butuan City, Philippines</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 cursor-pointer"
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile Bar inside drawer on mobile */}
              {user && profile ? (
                <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-zinc-900 truncate">{profile.full_name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{profile.barangay}, Butuan City</p>
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border bg-zinc-100 text-zinc-700 border-zinc-300">
                      {profile.role}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setIsMobileDrawerOpen(false);
                    }}
                    className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-rose-600 hover:bg-rose-50 text-xs font-semibold transition cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-zinc-50 border-b border-zinc-200 grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-lg border border-zinc-300 bg-white text-zinc-900 text-xs font-bold shadow-xs hover:bg-zinc-100 transition"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Log In</span>
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-lg bg-zinc-900 text-white text-xs font-bold shadow-xs hover:bg-zinc-800 transition"
                  >
                    <span>Sign Up</span>
                  </Link>
                </div>
              )}

              {/* Navigation Items */}
              <div className="py-3 px-3 space-y-1">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Navigation
                </div>

                <button
                  type="button"
                  onClick={() => handleMobileNavClick('home')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'home'
                      ? 'bg-zinc-900 text-white font-semibold'
                      : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Sparkles className={`w-4 h-4 shrink-0 ${activeTab === 'home' ? 'text-white' : 'text-zinc-500'}`} />
                    <div className="text-left">
                      <p className="leading-tight">Home</p>
                      <p className={`text-[10px] ${activeTab === 'home' ? 'text-zinc-300' : 'text-zinc-400'} truncate`}>
                        Overview, hero &amp; fleet
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${activeTab === 'home' ? 'text-zinc-300' : 'text-zinc-400'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => handleMobileNavClick('catalog')}
                  aria-label="Browse Cameras"
                  className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition cursor-pointer ${
                    activeTab === 'catalog'
                      ? 'bg-zinc-900 text-white font-semibold'
                      : 'text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Camera className={`w-4 h-4 shrink-0 ${activeTab === 'catalog' ? 'text-white' : 'text-zinc-500'}`} />
                    <div className="text-left">
                      <p className="leading-tight">Cameras</p>
                      <p className={`text-[10px] ${activeTab === 'catalog' ? 'text-zinc-300' : 'text-zinc-400'} truncate`}>
                        Browse full camera fleet
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${activeTab === 'catalog' ? 'text-zinc-300' : 'text-zinc-400'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition cursor-pointer text-zinc-700 hover:bg-zinc-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Layers className="w-4 h-4 shrink-0 text-zinc-500" />
                    <div className="text-left">
                      <p className="leading-tight">How It Works</p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        Explore, reserve, pickup &amp; return
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-zinc-400" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('about')}
                  className="w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition cursor-pointer text-zinc-700 hover:bg-zinc-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MapPin className="w-4 h-4 shrink-0 text-zinc-500" />
                    <div className="text-left">
                      <p className="leading-tight">About</p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        Local Butuan City rental hub
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-zinc-400" />
                </button>

                {isCustomerSignedIn && (
                  <>
                    <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Customer Portal
                    </div>
                    {customerNavItems.slice(2).map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleMobileNavClick(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition cursor-pointer ${
                            isActive
                              ? 'bg-zinc-900 text-white font-semibold'
                              : 'text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                            <div className="text-left">
                              <p className="leading-tight">{item.label}</p>
                              <p className={`text-[10px] ${isActive ? 'text-zinc-300' : 'text-zinc-400'} truncate`}>
                                {item.desc}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-300' : 'text-zinc-400'}`} />
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setShowDefenseGuide(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 min-h-[44px] rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-zinc-600" />
                <span>Engineering Defense Guide</span>
              </button>

              <div className="text-[10px] text-zinc-400 text-center pt-1">
                IDIO Butuan City • 100% Digital Cameras
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Defense Guide Dialog */}
      <AcademicDefenseGuide isOpen={showDefenseGuide} onClose={() => setShowDefenseGuide(false)} />

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 text-zinc-900 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-rose-600" />
              Reset Demo System State?
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              This will reset all digital cameras, reservations, inspections, and maintenance records back to the fresh seed data for Butuan City.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetToDefaults();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
