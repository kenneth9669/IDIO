'use client';

import React, { useState } from 'react';
import { useSystem } from '../../context/SystemContext';
import { DigitalCamera } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { ConditionBadge } from '../common/ConditionBadge';
import { CameraFormModal } from './CameraFormModal';
import { Dialog } from '../common/Dialog';
import { formatPHP, formatDate, getCameraImageUrl } from '../../lib/utils';
import {
  Camera,
  Plus,
  Search,
  Edit,
  Trash2,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Layers,
  History
} from 'lucide-react';

export const FleetManager: React.FC = () => {
  const { cameras, reservations, addCamera, updateCamera, deleteCamera, setCameraStatus } = useSystem();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [conditionFilter, setConditionFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<DigitalCamera | null>(null);
  const [viewingCamera, setViewingCamera] = useState<DigitalCamera | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const [maintenancePromptCamera, setMaintenancePromptCamera] = useState<DigitalCamera | null>(null);
  const [maintenanceReason, setMaintenanceReason] = useState('Sensor cleaning and optical quality check');

  const brands = Array.from(new Set(cameras.map(c => c.brand)));

  const filteredCameras = cameras.filter(cam => {
    const matchesSearch =
      cam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cam.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cam.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cam.model.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || cam.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || cam.status === statusFilter;
    const matchesCondition = conditionFilter === 'ALL' || cam.condition === conditionFilter;
    const matchesBrand = brandFilter === 'ALL' || cam.brand === brandFilter;
    return matchesSearch && matchesCat && matchesStatus && matchesCondition && matchesBrand;
  });

  const handleSaveCamera = async (data: any) => {
    if (editingCamera) {
      await updateCamera(editingCamera.id, data);
    } else {
      await addCamera(data);
    }
  };

  const handleDeleteCamera = async (id: string) => {
    setDeleteErrorMessage(null);
    const res = await deleteCamera(id);
    if (!res.success) {
      setDeleteErrorMessage(res.message);
    } else {
      setDeleteConfirmId(null);
    }
  };

  const cameraHistory = viewingCamera
    ? reservations.filter(r => r.cameraId === viewingCamera.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-zinc-800" />
            Digital Camera Fleet Inventory
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage physical camera inventory, serial numbers, tariffs, condition grading, and maintenance lockouts.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCamera(null);
            setIsModalOpen(true);
          }}
          className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs shadow-xs transition inline-flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Digital Camera</span>
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="p-3.5 bg-white border border-zinc-200 rounded-xl space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by camera name, model, serial number, brand..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
            >
              <option value="ALL">All Categories</option>
              <option value="Mirrorless">Mirrorless</option>
              <option value="Compact">Compact</option>
              <option value="DSLR">DSLR</option>
              <option value="Vlog & Creator">Vlog &amp; Creator</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="RESERVED">RESERVED</option>
              <option value="CHECKED_OUT">CHECKED OUT</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="DAMAGED">DAMAGED</option>
            </select>

            <select
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
            >
              <option value="ALL">All Brands</option>
              {brands.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Fleet Inventory Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-500 uppercase font-bold text-[10px] tracking-wider border-b border-zinc-200">
              <tr>
                <th className="p-3.5">Camera Unit</th>
                <th className="p-3.5">Serial Number</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Daily Rate</th>
                <th className="p-3.5">Deposit</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Shoots</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {filteredCameras.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-400">
                    No digital cameras matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredCameras.map(cam => (
                  <tr key={cam.id} className="hover:bg-zinc-50/70 transition">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-200/90 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                          <img
                            src={getCameraImageUrl(cam.id, cam.imageUrl)}
                            alt={cam.name}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 text-xs">{cam.name}</p>
                          <p className="text-[11px] text-zinc-400">
                            {cam.brand} • {cam.specs?.megapixels || 'High Res'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-zinc-800 font-medium">{cam.serialNumber}</td>
                    <td className="p-3.5 text-zinc-600">{cam.category}</td>
                    <td className="p-3.5 font-bold text-zinc-900">{formatPHP(cam.dailyRate)}</td>
                    <td className="p-3.5 text-zinc-600">{formatPHP(cam.securityDeposit)}</td>
                    <td className="p-3.5">
                      <StatusBadge status={cam.status} size="sm" />
                      {cam.maintenanceNotes && (
                        <span className="block text-[10px] text-amber-700 mt-0.5 max-w-[120px] truncate" title={cam.maintenanceNotes}>
                          {cam.maintenanceNotes}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-medium text-zinc-600">{cam.totalRentalsCount || 0}</td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Detail */}
                        <button
                          onClick={() => setViewingCamera(cam)}
                          className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition cursor-pointer"
                          title="View Details & History"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Quick Maintenance Toggle */}
                        {cam.status === 'AVAILABLE' ? (
                          <button
                            onClick={() => {
                              setMaintenancePromptCamera(cam);
                              setMaintenanceReason('Scheduled optical sensor cleaning and inspection');
                            }}
                            className="p-1.5 rounded-md hover:bg-amber-50 hover:text-amber-700 text-zinc-400 transition cursor-pointer"
                            title="Flag for Maintenance"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>
                        ) : cam.status === 'MAINTENANCE' ? (
                          <button
                            onClick={() => setCameraStatus(cam.id, 'AVAILABLE')}
                            className="p-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-700 text-zinc-400 transition cursor-pointer"
                            title="Restore to Available"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}

                        {/* Edit */}
                        <button
                          onClick={() => {
                            setEditingCamera(cam);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition cursor-pointer"
                          title="Edit Camera"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            setDeleteErrorMessage(null);
                            setDeleteConfirmId(cam.id);
                          }}
                          className="p-1.5 rounded-md hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition cursor-pointer"
                          title="Delete / Decommission"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Camera Detail & Rental History Modal */}
      {viewingCamera && (
        <Dialog
          isOpen={!!viewingCamera}
          onClose={() => setViewingCamera(null)}
          title={
            <div className="flex items-center gap-2 text-zinc-900">
              <Camera className="w-5 h-5 text-zinc-700" />
              <span>{viewingCamera.name} — Asset Profile</span>
            </div>
          }
          description={`Serial Number: ${viewingCamera.serialNumber} • Category: ${viewingCamera.category}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs text-zinc-700">
            {/* Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200 items-center">
              <div className="w-full h-36 bg-white p-2 rounded-xl border border-zinc-200 flex items-center justify-center shadow-2xs">
                <img
                  src={getCameraImageUrl(viewingCamera.id, viewingCamera.imageUrl)}
                  alt={viewingCamera.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={viewingCamera.status} />
                  <ConditionBadge condition={viewingCamera.condition} />
                </div>
                <p className="text-zinc-600">{viewingCamera.description}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-200">
                  <div>
                    <span className="text-zinc-400 block">Daily Rental Tariff:</span>
                    <strong className="text-zinc-900">{formatPHP(viewingCamera.dailyRate)} / day</strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Security Deposit:</span>
                    <strong className="text-zinc-900">{formatPHP(viewingCamera.securityDeposit)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Specifications */}
            <div>
              <h4 className="font-bold text-zinc-900 text-xs mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                Technical Specifications &amp; Package Inclusions
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px]">
                <div>
                  <span className="text-zinc-400">Sensor:</span> {viewingCamera.specs?.sensor || 'N/A'}
                </div>
                <div>
                  <span className="text-zinc-400">Resolution:</span> {viewingCamera.specs?.megapixels || 'N/A'}
                </div>
                <div>
                  <span className="text-zinc-400">Video:</span> {viewingCamera.specs?.videoResolution || 'N/A'}
                </div>
                <div>
                  <span className="text-zinc-400">ISO Range:</span> {viewingCamera.specs?.isoRange || 'N/A'}
                </div>
                <div>
                  <span className="text-zinc-400">Lens/Mount:</span> {viewingCamera.specs?.lensMountOrKit || 'N/A'}
                </div>
                <div>
                  <span className="text-zinc-400">Battery:</span> {viewingCamera.specs?.batteryLife || 'N/A'}
                </div>
              </div>

              {viewingCamera.packageIncludes && viewingCamera.packageIncludes.length > 0 && (
                <div className="mt-2 text-[11px]">
                  <span className="text-zinc-500 font-semibold">Included Accessories: </span>
                  <span className="text-zinc-700">{viewingCamera.packageIncludes.join(' • ')}</span>
                </div>
              )}
            </div>

            {/* Rental History Ledger */}
            <div>
              <h4 className="font-bold text-zinc-900 text-xs mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-zinc-500" />
                Rental &amp; Reservation History ({cameraHistory.length})
              </h4>
              <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                {cameraHistory.length === 0 ? (
                  <div className="p-4 text-center text-zinc-400 text-[11px]">
                    No past bookings recorded for this unit yet.
                  </div>
                ) : (
                  cameraHistory.map(r => (
                    <div key={r.id} className="p-2.5 bg-white flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-mono font-bold text-zinc-900">{r.referenceNo}</span>
                        <span className="text-zinc-600 ml-2">Customer: {r.customerName}</span>
                        <p className="text-[10px] text-zinc-400">
                          {formatDate(r.startDate)} → {formatDate(r.endDate)} ({r.totalDays} days)
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={r.status} type="rental" size="sm" />
                        <span className="block font-bold text-zinc-900 text-[10px] mt-0.5">
                          {formatPHP(r.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Edit / Add Modal */}
      <CameraFormModal
        camera={editingCamera}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCamera(null);
        }}
        onSave={handleSaveCamera}
      />

      {/* Flag Maintenance Prompt Modal */}
      {maintenancePromptCamera && (
        <Dialog
          isOpen={!!maintenancePromptCamera}
          onClose={() => setMaintenancePromptCamera(null)}
          title="Flag Camera for Maintenance"
          description={`Temporarily lockout ${maintenancePromptCamera.name} (${maintenancePromptCamera.serialNumber}) from reservation availability.`}
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Reason / Issue Notes *</label>
              <input
                type="text"
                value={maintenanceReason}
                onChange={e => setMaintenanceReason(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setMaintenancePromptCamera(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await setCameraStatus(maintenancePromptCamera.id, 'MAINTENANCE', maintenanceReason);
                  setMaintenancePromptCamera(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
              >
                Lock for Service
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 text-zinc-900 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Decommission Digital Camera?
            </h3>
            <p className="text-xs text-zinc-600">
              Are you sure you want to remove this digital camera from IDIO inventory? Active rentals will prevent deletion. Past logs will be retained.
            </p>

            {deleteErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {deleteErrorMessage}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteErrorMessage(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCamera(deleteConfirmId)}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
