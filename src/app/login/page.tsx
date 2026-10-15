'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Camera, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { SignInButton, useUser } from '@clerk/nextjs';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '';
  const errorParam = searchParams.get('error');

  const { user, profile, signIn, signOut, isLoading } = useAuth();
  const { isSignedIn: isClerkSignedIn, isLoaded: isClerkLoaded } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(
    errorParam === 'unauthorized_admin_access'
      ? 'Access Denied: You must be logged in as an ADMIN to access administrative operations.'
      : errorParam === 'auth_callback_failed'
      ? 'Authentication callback failed. Please try signing in again.'
      : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated and no security error is being displayed,
  // automatically route the user to their authorized destination without loops.
  useEffect(() => {
    if (!isLoading && user && profile && !errorParam) {
      if (profile.role === 'ADMIN') {
        const adminTarget = redirectPath && redirectPath.startsWith('/admin') ? redirectPath : '/admin';
        router.replace(adminTarget);
      } else {
        const custTarget = redirectPath && !redirectPath.startsWith('/admin') && redirectPath !== '/login' ? redirectPath : '/';
        router.replace(custTarget);
      }
    }
  }, [user, profile, isLoading, errorParam, redirectPath, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    const result = await signIn({ email, password });
    setIsSubmitting(false);

    if (result.success) {
      const userRole = result.role || 'CUSTOMER';
      if (userRole === 'ADMIN') {
        // Authorized ADMIN: direct to admin operations or requested admin sub-route
        const adminDestination = redirectPath && redirectPath.startsWith('/admin') ? redirectPath : '/admin';
        router.push(adminDestination);
      } else {
        // CUSTOMER: route to customer portal. If they tried accessing an admin URL, safely route to customer home.
        const custDestination = redirectPath && !redirectPath.startsWith('/admin') && redirectPath !== '/login' ? redirectPath : '/';
        router.push(custDestination);
      }
      router.refresh();
    } else {
      setErrorMessage(result.message);
    }
  };

  return (
    <div className="max-w-md w-full space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs font-bold">
            <Camera className="w-5 h-5 stroke-[2]" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-zinc-900">IDIO</span>
        </Link>
        <p className="text-xs text-zinc-500">
          Digital Camera Rental Management • Butuan City
        </p>
      </div>

      {/* Main Login Form */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xs">
        {/* Active Session Status Notice */}
        {(user || (isClerkLoaded && isClerkSignedIn)) && (
          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 text-xs">
            <p className="text-zinc-700">
              Active session detected: <strong>{profile?.full_name || user?.email || 'Authenticated User'}</strong>
              {profile?.role && <span className="ml-1 text-[10px] uppercase font-bold text-zinc-500">({profile.role})</span>}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Link
                href={profile?.role === 'ADMIN' ? '/admin' : '/'}
                className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition"
              >
                Go to Dashboard
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold hover:bg-zinc-50 transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Clerk SSO Authentication – only shown when NOT already signed in */}
        {isClerkLoaded && !isClerkSignedIn && (
          <div>
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-zinc-600" />
                <span>Continue with Clerk Account</span>
              </button>
            </SignInButton>
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white px-2 text-zinc-400 font-medium">or sign in with email</span>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-zinc-700 font-medium text-xs">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="email"
                type="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-white border border-zinc-200 rounded-lg pl-10 pr-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-zinc-700 font-medium text-xs">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-zinc-200 rounded-lg pl-10 pr-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="w-full py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Registration Prompt */}
        <div className="text-center pt-2 border-t border-zinc-100">
          <p className="text-xs text-zinc-500">
            New customer in Butuan City?{' '}
            <Link href="/register" className="text-zinc-900 hover:underline font-semibold ml-1">
              Register profile
            </Link>
          </p>
        </div>
      </div>

      {/* Security Notice */}
      <p className="text-[11px] text-center text-zinc-500">
        IDIO Role-Based Access Control (RBAC) is enforced at the database (RLS) &amp; server layer.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50/60 text-zinc-900 flex flex-col justify-center items-center px-4 py-12 selection:bg-zinc-900 selection:text-white">
      <Suspense fallback={<div className="text-zinc-500 text-xs">Loading authentication portal...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
