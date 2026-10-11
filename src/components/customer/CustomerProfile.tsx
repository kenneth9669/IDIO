'use client';
import React, { useState } from 'react';
import { useSystem } from '../../context/SystemContext';
import { BUTUAN_BARANGAYS, FIXED_CITY, FIXED_PROVINCE } from '../../data/seedData';
import { User, MapPin, ShieldCheck, CheckCircle2, Save } from 'lucide-react';

export const CustomerProfile: React.FC = () => {
  const { currentUser, updateCurrentUserProfile } = useSystem();

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone);
  const [barangay, setBarangay] = useState(currentUser.barangay || BUTUAN_BARANGAYS[0]);
  const [streetAddress, setStreetAddress] = useState(currentUser.streetAddress || '');
  const [idType, setIdType] = useState(currentUser.idType || 'Philippine National ID');
  const [idNumber, setIdNumber] = useState(currentUser.idNumber || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
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
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200">
        <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
          <User className="w-5 h-5 text-zinc-700" />
          Customer Profile &amp; Verification Details
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Manage your personal information, Butuan City residential address, and government identification.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Profile updated successfully! Information synced with IDIO counter verification.</span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6 shadow-xs">
        {/* Personal Details */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <User className="w-4 h-4 text-zinc-400" /> Personal Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Philippine Mobile No. *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0917-000-0000"
                required
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              />
            </div>
          </div>
        </div>

        {/* Address in Butuan City */}
        <div className="space-y-4 pt-4 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-zinc-400" /> Butuan City Local Residential Address
            </h3>
            <span className="text-[11px] text-zinc-400">Service Area: Butuan City</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Curated Barangay (Butuan City) *
              </label>
              <select
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              >
                {BUTUAN_BARANGAYS.map((bg) => (
                  <option key={bg} value={bg}>
                    Brgy. {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Street / Building / Unit / Purok *
              </label>
              <input
                type="text"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="e.g. Purok 5, Near CSU Campus"
                required
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">City (Fixed Scope)</label>
              <input
                type="text"
                value={FIXED_CITY}
                disabled
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-500 text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Province (Fixed Scope)</label>
              <input
                type="text"
                value={FIXED_PROVINCE}
                disabled
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-500 text-sm cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Identity Verification Details */}
        <div className="space-y-4 pt-4 border-t border-zinc-100">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-zinc-400" /> Primary Government ID
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">ID Type *</label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              >
                <option value="Philippine National ID">Philippine National ID (PhilID / ePhilID)</option>
                <option value="Driver's License">LTO Driver&apos;s License</option>
                <option value="Passport">Philippine Passport</option>
                <option value="UMID">Unified Multi-Purpose ID (UMID)</option>
                <option value="Voter's ID">Voter&apos;s Certificate / ID</option>
                <option value="Student ID">University / College Student ID (CSU / FSUU / SJIT)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">ID Serial / Card No. *</label>
              <input
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="e.g. 4821-9903-8821-4402"
                required
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition font-mono"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-zinc-100">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Profile Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
