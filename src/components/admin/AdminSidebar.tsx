'use client';

import React from 'react';
import {
  LayoutDashboard,
  Camera,
  CalendarDays,
  SlidersHorizontal,
  CreditCard,
  Wrench,
  Users,
  BarChart3,
  Activity,
  Settings,
  Shield,
  ChevronRight,
  X
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';

export type AdminTab =
  | 'dashboard'
  | 'cameras'
  | 'reservations'
  | 'rentals'
  | 'payments'
  | 'customers'
  | 'maintenance'
  | 'reports'
  | 'settings'
  | 'activity'; // Backward compatibility alias for settings

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const { reservations, cameras, maintenanceLogs } = useSystem();

  const pendingReservationsCount = reservations.filter(r => r.status === 'PENDING_APPROVAL').length;
  const activeRentalsCount = reservations.filter(r => r.status === 'CHECKED_OUT').length;
  const maintenanceCount = cameras.filter(c => c.status === 'MAINTENANCE' || c.status === 'DAMAGED').length;

  const navItems: {
    id: AdminTab;
    label: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: string;
    section?: string;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Core Operations' },
    { id: 'cameras', label: 'Cameras', icon: Camera, section: 'Core Operations' },
    {
      id: 'reservations',
      label: 'Reservations',
      icon: CalendarDays,
      badge: pendingReservationsCount > 0 ? pendingReservationsCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
      section: 'Core Operations'
    },
    {
      id: 'rentals',
      label: 'Rentals & Returns',
      icon: SlidersHorizontal,
      badge: activeRentalsCount > 0 ? activeRentalsCount : undefined,
      badgeColor: 'bg-indigo-600 text-white',
      section: 'Counter Operations'
    },
    { id: 'payments', label: 'Payments & Deposits', icon: CreditCard, section: 'Counter Operations' },
    { id: 'customers', label: 'Customers', icon: Users, section: 'Asset & Client Care' },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: Wrench,
      badge: maintenanceCount > 0 ? maintenanceCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
      section: 'Asset & Client Care'
    },
    { id: 'reports', label: 'Reports', icon: BarChart3, section: 'Analytics & System' },
    { id: 'settings', label: 'Settings & Audit Logs', icon: Settings, section: 'Analytics & System' }
  ];

  const handleItemClick = (id: AdminTab) => {
    onSelectTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-zinc-200 text-zinc-900 w-72 sm:w-64 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-bold shadow-xs">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-zinc-900">IDIO ADMIN</span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-zinc-100 text-zinc-700 border border-zinc-200 rounded">
                Console
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Butuan City Branch</p>
          </div>
        </div>

        {/* Mobile Close X button */}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
            aria-label="Close admin menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
        {navItems.map((item, idx) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          const showSectionHeading = idx === 0 || navItems[idx - 1].section !== item.section;

          return (
            <React.Fragment key={item.id}>
              {showSectionHeading && item.section && (
                <div className="pt-3 pb-1 px-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {item.section}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        item.badgeColor || 'bg-zinc-200 text-zinc-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3 h-3 text-zinc-400" />}
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-zinc-100 bg-zinc-50/70 text-[11px] text-zinc-500">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-700">IDIO System v2.4</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500" title="System Online" />
        </div>
        <p className="text-[10px] text-zinc-400 mt-0.5">Agusan del Norte • 2-Role RBAC</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block shrink-0">{content}</aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
