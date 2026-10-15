'use client';

import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { useAuth } from '../../context/AuthContext';
import { BUTUAN_BARANGAYS, FIXED_CITY, FIXED_PROVINCE } from '../../data/seedData';
import { formatDate } from '../../lib/utils';
import {
  User,
  Bell,
  MapPin,
  ShieldCheck,
  Save,
  LogOut,
  ArrowRight,
  Filter
} from 'lucide-react';
import { useFeedback } from '../../context/FeedbackContext';

interface CustomerAccountProps {
  initialSubTab?: 'profile' | 'notifications';
  onNavigateTab?: (tab: string) => void;
}

export const CustomerAccount: React.FC<CustomerAccountProps> = ({
  initialSubTab = 'profile',
  onNavigateTab
}) => {
  const { currentUser, updateCurrentUserProfile, reservations } = useSystem();
  const { signOut } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'notifications'>(initialSubTab);

  // Profile Form State
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone);
  const [barangay, setBarangay] = useState(currentUser.barangay || BUTUAN_BARANGAYS[0]);
  const [streetAddress, setStreetAddress] = useState(currentUser.streetAddress || '');
  const [idType, setIdType] = useState(currentUser.idType || 'Philippine National ID');
  const [idNumber, setIdNumber] = useState(currentUser.idNumber || '');
  const { showSuccess } = useFeedback();

  // Notification Filter State
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const customerId = currentUser.id;

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCurrentUserProfile({
      name,
      email,
      phone,
      barangay,
      streetAddress,
      idType,
      idNumber
    });
    showSuccess('Profile updated successfully! Information synced with IDIO counter verification.', 'Profile Updated');
  };

  // Derive live customer notifications
  const myReservations = useMemo(() => {
    return reservations.filter(r => r.customerId === customerId);
  }, [reservations, customerId]);

  const allNotifications = useMemo(() => {
    const list: {
      id: string;
      category: 'APPROVAL' | 'RETURN_DUE' | 'PAYMENT' | 'DEPOSIT' | 'SYSTEM';
      title: string;
      message: string;
      date: string;
      severity: 'success' | 'warning' | 'info' | 'purple';
      actionLabel: string;
      actionTab: string;
    }[] = [];

    // 1. Approved Reservations
    myReservations
      .filter(r => r.status === 'APPROVED')
      .forEach(r => {
        list.push({
          id: `notif-app-${r.id}`,
          category: 'APPROVAL',
          title: 'Reservation Approved & Ready for Pickup',
          message: `Your booking for ${r.cameraName} (Ref: ${r.referenceNo}) has been approved. Pickup is scheduled at our J.C. Aquino Ave branch on ${formatDate(r.startDate)}.`,
          date: r.updatedAt || r.createdAt,
          severity: 'success',
          actionLabel: 'View Reservations',
          actionTab: 'my-reservations'
        });
      });

    // 2. Active field rentals return notice
    myReservations
      .filter(r => r.status === 'CHECKED_OUT')
      .forEach(r => {
        list.push({
          id: `notif-ret-${r.id}`,
          category: 'RETURN_DUE',
          title: 'Camera In-Field — Return Notice',
          message: `${r.cameraName} (Ref: ${r.referenceNo}) is due for return on ${formatDate(r.endDate)} before 7:00 PM at IDIO Butuan. Please include all kit accessories.`,
          date: r.startDate,
          severity: 'warning',
          actionLabel: 'View Field Rentals',
          actionTab: 'rentals-payments'
        });
      });

    // 3. Pending review
    myReservations
      .filter(r => r.status === 'PENDING_APPROVAL')
      .forEach(r => {
        list.push({
          id: `notif-pen-${r.id}`,
          category: 'SYSTEM',
          title: 'Reservation Request Received',
          message: `Your request for ${r.cameraName} (${formatDate(r.startDate)} – ${formatDate(r.endDate)}) has been queued for admin verification.`,
          date: r.createdAt,
          severity: 'info',
          actionLabel: 'View Status',
          actionTab: 'my-reservations'
        });
      });

    // 4. Completed rentals
    myReservations
      .filter(r => r.status === 'COMPLETED')
      .forEach(r => {
        list.push({
          id: `notif-comp-${r.id}`,
          category: 'DEPOSIT',
          title: 'Rental Completed & Deposit Settled',
          message: `Thank you for returning ${r.cameraName} (Ref: ${r.referenceNo}). Condition inspection passed and security deposit settled.`,
          date: r.updatedAt || r.createdAt,
          severity: 'purple',
          actionLabel: 'View Receipt',
          actionTab: 'rentals-payments'
        });
      });

    return list;
  }, [myReservations]);

  const filteredNotifications = useMemo(() => {
    if (filterCategory === 'ALL') return allNotifications;
    return allNotifications.filter(n => n.category === filterCategory);
  }, [allNotifications, filterCategory]);

  // Unauthenticated visitors browsing as guest
  if (!customerId) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-zinc-200 p-8 space-y-4 max-w-xl mx-auto shadow-xs">
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
          <User className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-zinc-900">Sign in to your account</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            You are currently browsing as a guest. Please sign in or register to manage your Butuan City resident profile, ID verification, and notifications.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <a
            href="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition shadow-xs"
          >
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="/register"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition shadow-xs"
          >
            <span>Register</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <User className="w-5 h-5 text-zinc-800" />
            My Account &amp; Verification
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage your Butuan City residential address, government ID verification, and system notifications.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center p-1 bg-zinc-100 rounded-lg border border-zinc-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('profile')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'profile'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Profile &amp; ID
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('notifications')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'notifications'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Notifications ({allNotifications.length})
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PROFILE & VERIFICATION */}
      {activeSubTab === 'profile' && (
        <div className="space-y-6">
          <form onSubmit={handleProfileSubmit} className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6 shadow-xs">
            {/* Personal Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <User className="w-4 h-4 text-zinc-400" />
                Personal Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Philippine Mobile No. *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0917-000-0000"
                    required
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
                  />
                </div>
              </div>
            </div>

            {/* Residential Address in Butuan City */}
            <div className="space-y-4 pt-4 border-t border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-zinc-400" />
                Residential Address (Butuan City Scope)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Barangay (Butuan City) *</label>
                  <select
                    value={barangay}
                    onChange={e => setBarangay(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
                  >
                    {BUTUAN_BARANGAYS.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Street / House No. / Landmark *</label>
                  <input
                    type="text"
                    value={streetAddress}
                    onChange={e => setStreetAddress(e.target.value)}
                    placeholder="e.g. Purok 3A, Near City Hall"
                    required
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">City / Municipality</label>
                  <input
                    type="text"
                    value={FIXED_CITY}
                    disabled
                    className="w-full bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-500 text-xs cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Province</label>
                  <input
                    type="text"
                    value={FIXED_PROVINCE}
                    disabled
                    className="w-full bg-zinc-100 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-500 text-xs cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Government ID Verification */}
            <div className="space-y-4 pt-4 border-t border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-zinc-400" />
                Government Identification (Handover Verification)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Valid ID Type *</label>
                  <select
                    value={idType}
                    onChange={e => setIdType(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
                  >
                    <option value="Philippine National ID">Philippine National ID (PhilSys)</option>
                    <option value="Driver's License">Driver's License (LTO)</option>
                    <option value="Passport">Philippine Passport (DFA)</option>
                    <option value="UMID">UMID (SSS/GSIS)</option>
                    <option value="Student ID (Butuan)">Student ID (CSU / FSUU / SJIT / SJEC)</option>
                    <option value="Postal ID">Philippine Postal ID</option>
                    <option value="Voter's ID">COMELEC Voter's ID / Certification</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">ID Card / Serial Number *</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={e => setIdNumber(e.target.value)}
                    placeholder="e.g. 1234-5678-9012-3456"
                    required
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => signOut()}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 hover:bg-rose-50 text-zinc-600 hover:text-rose-600 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>

              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs inline-flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Profile</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-TAB 2: NOTIFICATIONS */}
      {activeSubTab === 'notifications' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-white border border-zinc-200 rounded-xl flex items-center justify-between gap-3 shadow-xs">
            <span className="text-xs text-zinc-500">
              Showing <strong>{filteredNotifications.length}</strong> notification{filteredNotifications.length !== 1 ? 's' : ''}
            </span>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
              >
                <option value="ALL">All Categories</option>
                <option value="APPROVAL">Approvals</option>
                <option value="RETURN_DUE">Return Due</option>
                <option value="SYSTEM">System Requests</option>
                <option value="DEPOSIT">Deposit &amp; Returns</option>
              </select>
            </div>
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="p-12 bg-white border border-zinc-200 rounded-xl text-center space-y-2">
              <Bell className="w-8 h-8 text-zinc-300 mx-auto" />
              <p className="text-xs text-zinc-500">No notifications found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map(notif => (
                <div
                  key={notif.id}
                  className="p-4 bg-white border border-zinc-200 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-300 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-zinc-900">{notif.title}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{notif.date}</span>
                    </div>
                    <p className="text-xs text-zinc-600">{notif.message}</p>
                  </div>

                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab(notif.actionTab)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer self-start sm:self-auto shrink-0"
                    >
                      <span>{notif.actionLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
