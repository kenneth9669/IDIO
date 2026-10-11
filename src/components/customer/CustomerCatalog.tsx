'use client';
import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { DigitalCamera, CameraCategory } from '../../types';
import { CameraCard } from './CameraCard';
import { CameraDetailModal } from './CameraDetailModal';
import { ReservationModal } from './ReservationModal';
import { checkCameraAvailability } from '../../lib/availabilityEngine';
import { 
  Camera, 
  Search, 
  Filter, 
  CalendarDays, 
  Sparkles, 
  SlidersHorizontal,
  CheckCircle2,
  ShieldCheck,
  MapPin
} from 'lucide-react';

interface CustomerCatalogProps {
  onReservationComplete?: (referenceNo: string) => void;
}

export const CustomerCatalog: React.FC<CustomerCatalogProps> = ({ onReservationComplete }) => {
  const { cameras, reservations } = useSystem();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedCameraForDetail, setSelectedCameraForDetail] = useState<DigitalCamera | null>(null);
  const [selectedCameraForReserve, setSelectedCameraForReserve] = useState<DigitalCamera | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const categories: { label: string; value: string }[] = [
    { label: 'All Digital Cameras', value: 'ALL' },
    { label: 'Mirrorless', value: 'Mirrorless' },
    { label: 'Digital Compact', value: 'Compact' },
    { label: 'Digital DSLR', value: 'DSLR' },
    { label: 'Vlog & Creator', value: 'Vlog & Creator' }
  ];

  const brands = ['ALL', 'Sony', 'Canon', 'Fujifilm', 'Nikon', 'Ricoh'];

  // Filter cameras based on search, category, brand, and date availability
  const filteredCameras = useMemo(() => {
    return cameras.filter((cam) => {
      // Search
      const matchesSearch =
        cam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cam.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cam.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cam.model.toLowerCase().includes(searchQuery.toLowerCase());

      // Category
      const matchesCategory = selectedCategory === 'ALL' || cam.category === selectedCategory;

      // Brand
      const matchesBrand = selectedBrand === 'ALL' || cam.brand === selectedBrand;

      return matchesSearch && matchesCategory && matchesBrand;
    });
  }, [cameras, searchQuery, selectedCategory, selectedBrand]);

  const handleReservationSuccess = (refNo: string) => {
    setToastMessage(`Reservation ${refNo} placed successfully! You can track its status in "My Bookings".`);
    setTimeout(() => setToastMessage(null), 6000);
    if (onReservationComplete) onReservationComplete(refNo);
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-zinc-900 text-white font-medium text-xs rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-white shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden bg-white border border-zinc-200 p-8 sm:p-10 shadow-xs">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5" />
            <span>Serving Butuan City, Agusan del Norte</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 leading-tight">
            Rent Digital Cameras for Your Next Shoot in Butuan.
          </h1>

          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-2xl">
            Sony, Canon, Fujifilm, and Nikon digital cameras available for daily and weekly rentals. 
            All units are sensor-cleaned, battery-equipped, and inspected with complete accessories.
          </p>

          <div className="pt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-zinc-900" /> Sensor Cleanliness Tested
            </span>
            <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
              <ShieldCheck className="w-4 h-4 text-zinc-900" /> Refundable Security Deposit
            </span>
            <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
              <Camera className="w-4 h-4 text-zinc-900" /> Batteries &amp; SD Cards Included
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Search & Date Range Filter Bar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search cameras (e.g. A7 IV, Fujifilm, 4K)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-lg pl-10 pr-4 py-2.5 min-h-[44px] text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition"
            />
          </div>

          {/* Date Range Availability Filter */}
          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            <div>
              <input
                type="date"
                value={filterStartDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFilterStartDate(e.target.value)}
                placeholder="Start Date"
                title="Filter by rental start date"
                className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-2 min-h-[44px] text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <div>
              <input
                type="date"
                value={filterEndDate}
                min={filterStartDate || new Date().toISOString().split('T')[0]}
                onChange={(e) => setFilterEndDate(e.target.value)}
                placeholder="End Date"
                title="Filter by rental end date"
                className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-2 min-h-[44px] text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>

          {/* Brand Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 min-h-[44px] text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 cursor-pointer"
            >
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b === 'ALL' ? 'All Brands (Sony, Canon...)' : `Brand: ${b}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-zinc-500 font-medium whitespace-nowrap mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Type:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.value
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          ))}

          {(filterStartDate || filterEndDate || searchQuery || selectedBrand !== 'ALL' || selectedCategory !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
                setSelectedBrand('ALL');
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="text-xs text-zinc-500 hover:text-zinc-900 underline font-medium ml-auto whitespace-nowrap cursor-pointer min-h-[38px] px-2 flex items-center"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Cameras Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Camera className="w-4 h-4 text-zinc-700" />
            Available Digital Cameras ({filteredCameras.length})
          </h2>
          {filterStartDate && filterEndDate && (
            <span className="text-xs text-zinc-700 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-medium">
              <CalendarDays className="w-3.5 h-3.5 text-zinc-500" />
              Dates: {filterStartDate} to {filterEndDate}
            </span>
          )}
        </div>

        {filteredCameras.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-zinc-200 p-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">No Digital Cameras Match Your Filter</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Try adjusting your search term, category chips, or rental dates to see available camera bodies.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredCameras.map((cam) => {
              // Calculate specific date availability if dates are chosen
              let dateAvail = true;
              if (filterStartDate && filterEndDate) {
                const resCheck = checkCameraAvailability(cam, filterStartDate, filterEndDate, reservations);
                dateAvail = resCheck.isAvailable;
              }

              return (
                <CameraCard
                  key={cam.id}
                  camera={cam}
                  dateFilteredAvailable={filterStartDate && filterEndDate ? dateAvail : undefined}
                  onViewDetails={(c) => setSelectedCameraForDetail(c)}
                  onReserve={(c) => setSelectedCameraForReserve(c)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <CameraDetailModal
        camera={selectedCameraForDetail}
        isOpen={!!selectedCameraForDetail}
        onClose={() => setSelectedCameraForDetail(null)}
        onReserve={(cam) => {
          setSelectedCameraForDetail(null);
          setSelectedCameraForReserve(cam);
        }}
      />

      <ReservationModal
        camera={selectedCameraForReserve}
        isOpen={!!selectedCameraForReserve}
        onClose={() => setSelectedCameraForReserve(null)}
        onSuccess={handleReservationSuccess}
      />
    </div>
  );
};
