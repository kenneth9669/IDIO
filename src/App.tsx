import React, { useState } from 'react';
import { SystemProvider, useSystem } from './context/SystemContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { CustomerCatalog } from './components/customer/CustomerCatalog';
import { CustomerBookings } from './components/customer/CustomerBookings';
import { CustomerProfile } from './components/customer/CustomerProfile';
import { AdminShell } from './components/admin/AdminShell';

const AppContent: React.FC = () => {
  const { currentRole } = useSystem();
  const [activeTab, setActiveTab] = useState<string>('catalog');

  if (currentRole === 'ADMIN') {
    return <AdminShell initialTab="dashboard" />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'catalog' && (
          <CustomerCatalog onReservationComplete={() => setActiveTab('my-reservations')} />
        )}
        {activeTab === 'my-reservations' && <CustomerBookings />}
        {activeTab === 'profile' && <CustomerProfile />}
      </main>
      <Footer />
    </div>
  );
};

export function App() {
  return (
    <SystemProvider>
      <AppContent />
    </SystemProvider>
  );
}

export default App;
