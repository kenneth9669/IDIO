'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { BUTUAN_BARANGAYS, FIXED_CITY, FIXED_PROVINCE } from '../../data/seedData';
import { Camera, User, Lock, Mail, Phone, MapPin, CreditCard, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SignUpButton, useUser } from '@clerk/nextjs';

const PHILIPPINE_ID_TYPES = [
  'Philippine National ID (PhilSys)',
  'Driver\'s License',
  'UMID',
  'Passport',
  'Postal ID',
  'PRC License',
  'Voter\'s ID',
  'Student ID (Caraga State University / FSUU)'
];

export default function RegisterPage() {
  const router = useRouter();
  const { user, profile, signUp, signOut, isLoading } = useAuth();
  const { isSignedIn: isClerkSignedIn, isLoaded: isClerkLoaded } = useUser();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    barangay: BUTUAN_BARANGAYS[0],
    streetAddress: '',
    idType: PHILIPPINE_ID_TYPES[0],
    idNumber: ''
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    const result = await signUp({
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      phone: formData.phone,
      barangay: formData.barangay,
      streetAddress: formData.streetAddress,
      idType: formData.idType,
      idNumber: formData.idNumber
    });
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage('Registration successful! Redirecting to catalog...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
    } else {
      setErrorMessage(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50/60 text-zinc-900 flex flex-col justify-center items-center px-4 py-12 selection:bg-zinc-900 selection:text-white">
      <div className="max-w-xl w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs font-bold">
              <Camera className="w-5 h-5 stroke-[2]" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-zinc-900">IDIO</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Customer Registration</h1>
          <p className="text-xs text-zinc-500">
            Create your IDIO customer profile for digital camera rentals in Butuan City
          </p>
        </div>

        {/* Registration Form Card */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
          {/* Active Session Status Notice & Isolation */}
          {(user || (isClerkLoaded && isClerkSignedIn)) ? (
            <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto text-zinc-700">
                <User className="w-6 h-6 stroke-[1.75]" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-zinc-900">Active Session Detected</h2>
                <p className="text-xs text-zinc-600">
                  You are currently signed in as <strong>{profile?.full_name || user?.email || 'Authenticated User'}</strong>.
                </p>
                <p className="text-[11px] text-zinc-400">
                  To register a new customer account, please sign out first.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-1">
                <Link
                  href="/"
                  className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition"
                >
                  Go to Home
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold hover:bg-rose-100 transition"
                >
                  Sign Out to Register
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Clerk Quick Registration – only shown when NOT already signed in */}
              {isClerkLoaded && !isClerkSignedIn && (
                <div>
                  <SignUpButton mode="modal">
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold shadow-xs transition"
                    >
                      <Lock className="w-3.5 h-3.5 text-zinc-600" />
                      <span>Fast Sign Up with Clerk</span>
                    </button>
                  </SignUpButton>
                  <div className="relative my-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-200" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-white px-2 text-zinc-400 font-medium">or fill local Butuan registration</span>
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{successMessage}</span>
                </div>
              )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Full Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-zinc-700 font-medium text-xs">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="e.g. Jennelyn M. Santos"
                    className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-zinc-700 font-medium text-xs">
                  Mobile Phone Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="0919-123-4567"
                    className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Email & Passwords */}
            <div className="space-y-1.5">
              <label className="block text-zinc-700 font-medium text-xs">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="jennelyn.creates@gmail.com"
                  className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-zinc-700 font-medium text-xs">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min. 6 characters"
                    className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-zinc-700 font-medium text-xs">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter password"
                    className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Butuan City Location Details */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-700" /> Butuan City Barangay Verification
                </span>
                <span className="text-[10px] text-zinc-500">{FIXED_CITY}, {FIXED_PROVINCE}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-zinc-600 text-[11px] font-medium">Barangay *</label>
                  <select
                    name="barangay"
                    value={formData.barangay}
                    onChange={handleChange}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-900 focus:outline-none focus:border-zinc-900 text-xs"
                  >
                    {BUTUAN_BARANGAYS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-zinc-600 text-[11px] font-medium">Street / Purok / Landmark *</label>
                  <input
                    type="text"
                    name="streetAddress"
                    required
                    value={formData.streetAddress}
                    onChange={handleChange}
                    placeholder="Purok 5, Near CSU Main Gate"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-900 focus:outline-none focus:border-zinc-900 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Philippine ID Verification Details */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
              <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-zinc-700" /> Valid ID for In-Store Pickup
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-zinc-600 text-[11px] font-medium">ID Document Type *</label>
                  <select
                    name="idType"
                    value={formData.idType}
                    onChange={handleChange}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-900 focus:outline-none focus:border-zinc-900 text-xs"
                  >
                    {PHILIPPINE_ID_TYPES.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-zinc-600 text-[11px] font-medium">ID / Reference Number *</label>
                  <input
                    type="text"
                    name="idNumber"
                    required
                    value={formData.idNumber}
                    onChange={handleChange}
                    placeholder="e.g. CRN-0111-9876543-2"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-zinc-900 focus:outline-none focus:border-zinc-900 text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Creating Profile...' : 'Complete Customer Registration'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          </>
          )}

          <div className="text-center pt-2 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">
              Already have an account?{' '}
              <Link href="/login" className="text-zinc-900 hover:underline font-semibold ml-1">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
