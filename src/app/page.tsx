'use client';

import React, { useState } from 'react';
import { SystemProvider, useSystem } from '../context/SystemContext';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { CustomerHome } from '../components/customer/CustomerHome';
import { CustomerCatalog } from '../components/customer/CustomerCatalog';
import { CustomerBookings } from '../components/customer/CustomerBookings';
import { CustomerRentalsAndPayments } from '../components/customer/CustomerRentalsAndPayments';
import { CustomerAccount } from '../components/customer/CustomerAccount';
import { AdminShell } from '../components/admin/AdminShell';

function AppContent() {
  const { currentRole } = useSystem();
  const [activeTab, setActiveTab] = useState<string>('home');

  // When logged in as verified ADMIN, present the master Admin Console
  if (currentRole === 'ADMIN') {
    return <AdminShell initialTab="dashboard" />;
  }

  // Customer Portal (Consolidated into exactly 5 primary sections)
  return (
    <div className="min-h-screen bg-zinc-50/60 text-zinc-900 flex flex-col selection:bg-zinc-900 selection:text-white">
      {/* Navigation Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      {(activeTab === 'home' || activeTab === 'dashboard') ? (
        <main className="flex-1 w-full">
          <CustomerHome onNavigateTab={(tab) => setActiveTab(tab)} />
        </main>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'catalog' && (
            <CustomerCatalog onReservationComplete={() => setActiveTab('my-reservations')} />
          )}
          {activeTab === 'my-reservations' && <CustomerBookings />}
          {(activeTab === 'rentals-payments' || activeTab === 'my-rentals' || activeTab === 'payments' || activeTab === 'deposits') && (
            <CustomerRentalsAndPayments
              initialSubTab={activeTab === 'payments' ? 'payments' : activeTab === 'deposits' ? 'deposits' : 'rentals'}
            />
          )}
          {(activeTab === 'account' || activeTab === 'profile' || activeTab === 'notifications') && (
            <CustomerAccount
              initialSubTab={activeTab === 'notifications' ? 'notifications' : 'profile'}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}
        </main>
      )}

      {/* Footer */}
      <Footer onNavigateTab={(tab) => setActiveTab(tab)} />
    </div>
  );
}

export default function HomePage() {
  return (
    <SystemProvider>
      <AppContent />
    </SystemProvider>
  );
}
