'use client';

import React, { useState } from 'react';
import { AdminSidebar, AdminTab } from './AdminSidebar';
import { AdminDashboard } from './AdminDashboard';
import { FleetManager } from './FleetManager';
import { ReservationMaster } from './ReservationMaster';
import { CounterQueue } from '../counter/CounterQueue';
import { PaymentsManager } from './PaymentsManager';
import { MaintenanceManager } from './MaintenanceManager';
import { CustomerManager } from './CustomerManager';
import { ReportsAnalytics } from './ReportsAnalytics';
import { ActivityLogsView } from './ActivityLogsView';
import { AdminSettings } from './AdminSettings';
import { useAuth } from '../../context/AuthContext';
import { useSystem } from '../../context/SystemContext';
import {
  Menu,
  MapPin,
  BookOpen
} from 'lucide-react';
import { AcademicDefenseGuide } from '../defense/AcademicDefenseGuide';

interface AdminShellProps {
  initialTab?: AdminTab;
}

export const AdminShell: React.FC<AdminShellProps> = ({ initialTab = 'dashboard' }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showDefenseGuide, setShowDefenseGuide] = useState(false);

  const { profile, signOut } = useAuth();
  const { currentUser } = useSystem();

  const adminName = profile?.full_name || currentUser.name || 'Dave Admin';
  const adminEmail = profile?.email || currentUser.email || 'admin@idio.ph';

  const tabTitles: Record<AdminTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Operations Overview',
      subtitle: 'Real-time telemetry, fleet availability, and operational KPIs'
    },
    cameras: {
      title: 'Camera Fleet Management',
      subtitle: 'Digital camera inventory, tariffs, serial numbers, and condition grades'
    },
    reservations: {
      title: 'Reservation Management',
      subtitle: 'Review booking requests, schedule approvals, and calendar availability'
    },
    rentals: {
      title: 'Rentals & Returns Management',
      subtitle: 'Physical checkout checklists, return condition inspections, and deposits'
    },
    payments: {
      title: 'Payments & Security Deposits',
      subtitle: 'Manual cash pickup verification, escrow tracking, and damage settlements'
    },
    customers: {
      title: 'Customer Directory & Verification',
      subtitle: 'Resident directory across Butuan City barangays and government ID checks'
    },
    maintenance: {
      title: 'Maintenance & Calibration',
      subtitle: 'Sensor cleaning, shutter calibration, and hardware service tickets'
    },
    reports: {
      title: 'Reports & Analytics',
      subtitle: 'Financial reconciliation, fleet demand metrics, and CSV exports'
    },
    settings: {
      title: 'Settings & Audit Logs',
      subtitle: 'Admin profile, branch operations, and immutable system audit trail'
    },
    activity: {
      title: 'Settings & Audit Logs',
      subtitle: 'Immutable system audit trail of administrator and customer actions'
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50/60 text-zinc-900 flex flex-col md:flex-row selection:bg-zinc-900 selection:text-white">
      {/* Responsive Admin Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Operational Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-sm font-bold text-zinc-900 leading-tight">
                {tabTitles[activeTab]?.title || 'Admin Console'}
              </h1>
              <p className="hidden sm:block text-[11px] text-zinc-500 leading-tight">
                {tabTitles[activeTab]?.subtitle || 'Butuan City Branch'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Butuan City Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-50 px-2.5 py-1 rounded-md border border-zinc-200">
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              <span>Butuan City, Agusan del Norte</span>
            </div>

            {/* Academic Defense Guide Button */}
            <button
              type="button"
              onClick={() => setShowDefenseGuide(true)}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-700 hover:text-zinc-900 font-medium px-2.5 py-1 rounded-md bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-600" />
              <span className="hidden sm:inline">Defense Guide</span>
            </button>

            {/* Authenticated Admin Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-zinc-900 leading-tight">{adminName}</p>
                <p className="text-[10px] text-zinc-500 leading-tight">{adminEmail}</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-zinc-900 text-white font-bold text-[10px]">
                ADMIN
              </span>
            </div>
          </div>
        </header>

        {/* Content View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && <AdminDashboard onNavigateTab={setActiveTab} />}
          {activeTab === 'cameras' && <FleetManager />}
          {activeTab === 'reservations' && <ReservationMaster />}
          {activeTab === 'rentals' && <CounterQueue />}
          {activeTab === 'payments' && <PaymentsManager />}
          {activeTab === 'customers' && <CustomerManager />}
          {activeTab === 'maintenance' && <MaintenanceManager />}
          {activeTab === 'reports' && <ReportsAnalytics />}
          {activeTab === 'settings' && <AdminSettings initialTab="settings" />}
          {activeTab === 'activity' && <AdminSettings initialTab="audit" />}
        </main>
      </div>

      {/* Defense Guide Dialog */}
      <AcademicDefenseGuide isOpen={showDefenseGuide} onClose={() => setShowDefenseGuide(false)} />
    </div>
  );
};
