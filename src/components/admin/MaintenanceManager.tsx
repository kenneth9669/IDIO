'use client';

import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { MaintenanceLog, DigitalCamera } from '../../types';
import { formatPHP, formatDate, getCameraImageUrl } from '../../lib/utils';
import { ConditionBadge } from '../common/ConditionBadge';
import {
  Wrench,
  Plus,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  AlertTriangle,
  FileText,
  Activity,
  Calendar,
  Camera,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { useFeedback } from '../../context/FeedbackContext';

export const MaintenanceManager: React.FC = () => {
  const {
    cameras,
    maintenanceLogs,
    addMaintenanceLog,
    updateMaintenanceLog,
    setCameraStatus
  } = useSystem();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const { showSuccess, showError } = useFeedback();

  // Cameras currently locked in maintenance or damaged
  const maintenanceCameras = useMemo(() => {
    return cameras.filter(c => c.status === 'MAINTENANCE' || c.status === 'DAMAGED');
  }, [cameras]);

  // Form state
  const [selectedCameraId, setSelectedCameraId] = useState(
    maintenanceCameras[0]?.id || cameras[0]?.id || ''
  );
  const [issueType, setIssueType] = useState<MaintenanceLog['issueType']>('Sensor Cleaning');
  const [severity, setSeverity] = useState<MaintenanceLog['severity']>('Medium');
  const [description, setDescription] = useState('');
  const [costEstimate, setCostEstimate] = useState(450);

  // Ticket release modal
  const [releasingLog, setReleasingLog] = useState<MaintenanceLog | null>(null);
  const [technicianNotes, setTechnicianNotes] = useState(
    'Service completed. Optical sensor cleaned, shutter calibrated, and verified operational.'
  );

  // Direct camera release modal
  const [releasingCamera, setReleasingCamera] = useState<DigitalCamera | null>(null);
  const [cameraReleaseNotes, setCameraReleaseNotes] = useState(
    'Quality inspection passed. Sensor verified clean, optics inspected, and unit restored to available fleet.'
  );
  const [isReleasingProcessing, setIsReleasingProcessing] = useState(false);

  const filteredLogs = useMemo(() => {
    return maintenanceLogs.filter(log => {
      const matchesSearch =
        log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.cameraName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.cameraSerial.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.issueType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
      const matchesSeverity = severityFilter === 'ALL' || log.severity === severityFilter;

      return matchesSearch && matchesStatus && matchesSeverity;
    });
  }, [maintenanceLogs, searchQuery, statusFilter, severityFilter]);

  const activeTicketsCount = maintenanceLogs.filter(
    l => l.status !== 'Completed' && l.status !== 'Decommissioned'
  ).length;
  const totalMaintenanceCost = maintenanceLogs.reduce((sum, l) => sum + (l.costEstimate || 0), 0);

  const handleOpenCreateTicketForCamera = (camId: string) => {
    setSelectedCameraId(camId);
    const cam = cameras.find(c => c.id === camId);
    if (cam) {
      setDescription(
        `Maintenance & calibration service for ${cam.name} (${cam.serialNumber}). Notes: ${
          cam.maintenanceNotes || 'Routine inspection and sensor cleaning'
        }`
      );
    }
    setIsModalOpen(true);
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const cam = cameras.find(c => c.id === selectedCameraId);
    if (!cam) return;

    addMaintenanceLog({
      cameraId: cam.id,
      cameraName: cam.name,
      cameraSerial: cam.serialNumber,
      issueType,
      severity,
      description,
      costEstimate: Number(costEstimate),
      status: 'Under Service',
      reportedBy: 'Admin Technician',
      startDate: new Date().toISOString().split('T')[0]
    });

    setIsModalOpen(false);
    setDescription('');
    showSuccess(`Created maintenance ticket for ${cam.name}. Camera locked in MAINTENANCE.`, 'Maintenance Ticket');
  };

  const handleConfirmReleaseLog = () => {
    if (!releasingLog) return;
    updateMaintenanceLog(releasingLog.id, {
      status: 'Completed',
      completionDate: new Date().toISOString().split('T')[0],
      notes: technicianNotes
    });
    showSuccess(`Ticket ${releasingLog.id} completed. Camera ${releasingLog.cameraName} marked AVAILABLE.`, 'Ticket Completed');
    setReleasingLog(null);
  };

  const handleConfirmReleaseCamera = async () => {
    if (!releasingCamera) return;
    setIsReleasingProcessing(true);
    try {
      const res = await setCameraStatus(releasingCamera.id, 'AVAILABLE', cameraReleaseNotes);
      setIsReleasingProcessing(false);
      if (res.success) {
        // Also complete any open ticket for this camera in local state
        const openLog = maintenanceLogs.find(
          l => l.cameraId === releasingCamera.id && l.status !== 'Completed' && l.status !== 'Decommissioned'
        );
        if (openLog) {
          updateMaintenanceLog(openLog.id, {
            status: 'Completed',
            completionDate: new Date().toISOString().split('T')[0],
            notes: cameraReleaseNotes
          });
        }
        showSuccess(`Camera ${releasingCamera.name} released back to AVAILABLE inventory.`, 'Camera Released');
        setReleasingCamera(null);
      } else {
        showError(`Failed to release camera: ${res.message}`, 'Release Failed');
      }
    } catch (err: any) {
      setIsReleasingProcessing(false);
      showError(err.message || 'Error releasing camera.', 'Release Error');
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-zinc-800" />
            Equipment Maintenance &amp; Calibration
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track optical sensor cleanings, firmware updates, physical repairs, and routine inspections across the fleet.
          </p>
        </div>

        <button
          onClick={() => {
            if (maintenanceCameras.length > 0) {
              setSelectedCameraId(maintenanceCameras[0].id);
            }
            setIsModalOpen(true);
          }}
          className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs shadow-xs transition inline-flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Ticket</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Cameras in Maintenance</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{maintenanceCameras.length}</p>
          <span className="text-[11px] text-zinc-400">Locked out of rental availability</span>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Active Service Tickets</span>
            <Clock className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{activeTicketsCount}</p>
          <span className="text-[11px] text-zinc-400">Open technician service tickets</span>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Total Maintenance Costs</span>
            <Wrench className="w-4 h-4 text-zinc-500" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatPHP(totalMaintenanceCost)}</p>
          <span className="text-[11px] text-zinc-400">Cumulative optical &amp; body expense</span>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Total Recorded Tickets</span>
            <Activity className="w-4 h-4 text-zinc-500" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{maintenanceLogs.length}</p>
          <span className="text-[11px] text-zinc-400">Lifetime service ledger entries</span>
        </div>
      </div>

      {/* SECTION 1: Active Cameras Under Maintenance */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
              Fleet Cameras Locked Under Maintenance &amp; Calibration ({maintenanceCameras.length})
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400">
            Unavailable for customer bookings until certified operational
          </span>
        </div>

        {maintenanceCameras.length === 0 ? (
          <div className="p-6 bg-white border border-zinc-200 rounded-xl text-center shadow-xs">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-900">All Fleet Cameras Operational</h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              There are currently no digital cameras locked in maintenance or flagged damaged.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {maintenanceCameras.map(cam => {
              const activeLog = maintenanceLogs.find(
                l => l.cameraId === cam.id && l.status !== 'Completed' && l.status !== 'Decommissioned'
              );

              return (
                <div
                  key={cam.id}
                  className="p-5 bg-white border border-amber-200/80 rounded-xl space-y-4 transition shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          {cam.id}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            cam.status === 'DAMAGED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {cam.status}
                        </span>
                      </div>
                      <ConditionBadge condition={cam.condition} />
                    </div>

                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-lg bg-white border border-zinc-200 shrink-0 p-1 flex items-center justify-center shadow-2xs">
                        <img
                          src={getCameraImageUrl(cam.id, cam.imageUrl)}
                          alt={cam.name}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-zinc-900 text-xs truncate">{cam.name}</h4>
                        <p className="text-[11px] text-zinc-500 font-mono">
                          SN: <span className="text-zinc-800 font-medium">{cam.serialNumber}</span>
                        </p>
                        <p className="text-[11px] text-zinc-600 mt-0.5">
                          {cam.brand} • {cam.category}
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          Rate: {formatPHP(cam.dailyRate)}/day • Deposit: {formatPHP(cam.securityDeposit)}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-200/60 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-amber-900 font-medium">
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3.5 h-3.5 text-amber-600" />
                          <span>Status &amp; Diagnosis:</span>
                        </span>
                        {activeLog && (
                          <span className="font-mono text-[10px] bg-amber-200/70 text-amber-800 px-1.5 py-0.5 rounded">
                            {activeLog.id}
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-700 text-[11px]">
                        {activeLog
                          ? `${activeLog.issueType} (${activeLog.severity} Severity): ${activeLog.description}`
                          : cam.maintenanceNotes ||
                            'Locked out of rental availability. Scheduled for sensor wet-cleaning, firmware calibration, or physical repair.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                    <button
                      onClick={() => handleOpenCreateTicketForCamera(cam.id)}
                      className="flex-1 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{activeLog ? 'Add Note/Ticket' : 'Create Ticket'}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (activeLog) {
                          setReleasingLog(activeLog);
                          setTechnicianNotes(
                            'Service verified. Optical sensor cleaned, contacts tested, and unit certified for rental availability.'
                          );
                        } else {
                          setReleasingCamera(cam);
                          setCameraReleaseNotes(
                            'Quality inspection passed. Sensor verified clean, optics inspected, and unit restored to available fleet.'
                          );
                        }
                      }}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Release to Available</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Maintenance Ledger & Tickets */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-zinc-700" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
              Maintenance Service Ledger &amp; Tickets ({filteredLogs.length})
            </h3>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3.5 bg-white border border-zinc-200 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tickets by ID, camera name, serial number, issue..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
            >
              <option value="ALL">All Statuses</option>
              <option value="Under Service">Under Service</option>
              <option value="Parts Ordered">Parts Ordered</option>
              <option value="Completed">Completed</option>
              <option value="Decommissioned">Decommissioned</option>
            </select>

            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
            >
              <option value="ALL">All Severities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 text-zinc-500 uppercase font-bold text-[10px] tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="p-3.5">Ticket ID &amp; Date</th>
                  <th className="p-3.5">Camera Asset</th>
                  <th className="p-3.5">Service Type</th>
                  <th className="p-3.5">Severity</th>
                  <th className="p-3.5">Diagnosis / Description</th>
                  <th className="p-3.5">Estimated Cost</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-zinc-400">
                      No maintenance tickets matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-zinc-50/70 transition">
                      <td className="p-3.5">
                        <p className="font-mono font-bold text-zinc-900 text-xs">{log.id}</p>
                        <p className="text-[11px] text-zinc-400">{formatDate(log.startDate)}</p>
                      </td>
                      <td className="p-3.5">
                        <p className="font-semibold text-zinc-900">{log.cameraName}</p>
                        <p className="text-[11px] font-mono text-zinc-500">SN: {log.cameraSerial}</p>
                      </td>
                      <td className="p-3.5 font-medium text-zinc-800">{log.issueType}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            log.severity === 'Critical' || log.severity === 'High'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="p-3.5 max-w-xs text-zinc-600">
                        <p className="line-clamp-2">{log.description}</p>
                        {log.notes && (
                          <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                            Resolution: {log.notes}
                          </p>
                        )}
                      </td>
                      <td className="p-3.5 font-bold text-zinc-900">
                        {log.costEstimate ? formatPHP(log.costEstimate) : 'Free / In-house'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                            log.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {log.status === 'Completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {log.status !== 'Completed' && log.status !== 'Decommissioned' && (
                          <button
                            onClick={() => {
                              setReleasingLog(log);
                              setTechnicianNotes(
                                'Service verified. Optical sensor cleaned, contacts tested, and unit signed off for rental availability.'
                              );
                            }}
                            className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs transition inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Release Camera</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Ticket Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-zinc-900">
            <Wrench className="w-5 h-5 text-zinc-700" />
            <span>Create Maintenance &amp; Calibration Ticket</span>
          </div>
        }
        description="Flag a digital camera for sensor wet-cleaning, firmware calibration, or repair. This automatically locks the camera out of rental availability."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 text-xs text-zinc-700">
          <div>
            <label className="block text-zinc-700 font-medium mb-1">Target Digital Camera *</label>
            <select
              value={selectedCameraId}
              onChange={e => setSelectedCameraId(e.target.value)}
              className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
            >
              {cameras.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.serialNumber}) — Current Status: {c.status}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-700 font-medium mb-1">Service / Issue Type *</label>
              <select
                value={issueType}
                onChange={e => setIssueType(e.target.value as any)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
              >
                <option value="Sensor Cleaning">Sensor Wet-Cleaning</option>
                <option value="Firmware Update">Firmware Update</option>
                <option value="Physical Repair">Physical Repair</option>
                <option value="Button / Dial Inspection">Button / Dial Calibration</option>
                <option value="Routine Quality Check">Routine Quality Check</option>
                <option value="Post-Rental Damage">Post-Rental Damage</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">Severity *</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as any)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
              >
                <option value="Low">Low (Routine)</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical (Non-functional)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-700 font-medium mb-1">Estimated Cost (₱)</label>
            <input
              type="number"
              value={costEstimate}
              onChange={e => setCostEstimate(Number(e.target.value))}
              className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
            />
          </div>

          <div>
            <label className="block text-zinc-700 font-medium mb-1">Technical Diagnosis / Notes *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              required
              placeholder="Detail observations (e.g. sensor dust spot at top-right corner at f/16, sticky shutter dial)..."
              className="w-full bg-white border border-zinc-300 rounded-lg p-3 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs cursor-pointer"
            >
              Create Ticket &amp; Lockout
            </button>
          </div>
        </form>
      </Dialog>

      {/* Release Ticket Confirmation Modal */}
      {releasingLog && (
        <Dialog
          isOpen={!!releasingLog}
          onClose={() => setReleasingLog(null)}
          title="Sign Off &amp; Restore Camera Availability"
          description={`Sign off on maintenance ticket ${releasingLog.id} for ${releasingLog.cameraName} (${releasingLog.cameraSerial}).`}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Technician Completion Notes *</label>
              <textarea
                value={technicianNotes}
                onChange={e => setTechnicianNotes(e.target.value)}
                rows={3}
                className="w-full bg-white border border-zinc-300 rounded-lg p-3 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div className="p-3 bg-white border border-zinc-200 rounded-lg text-zinc-700 text-[11px] flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Upon confirmation, this camera will be set back to <strong className="text-zinc-900">AVAILABLE</strong> in the fleet inventory and become open for customer bookings.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setReleasingLog(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReleaseLog}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold cursor-pointer"
              >
                Sign Off &amp; Make Available
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Direct Camera Release Confirmation Modal */}
      {releasingCamera && (
        <Dialog
          isOpen={!!releasingCamera}
          onClose={() => setReleasingCamera(null)}
          title="Certify &amp; Restore Camera Availability"
          description={`Release ${releasingCamera.name} (${releasingCamera.serialNumber}) back into active fleet inventory.`}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Technician Inspection &amp; Sign-off Notes *</label>
              <textarea
                value={cameraReleaseNotes}
                onChange={e => setCameraReleaseNotes(e.target.value)}
                rows={3}
                className="w-full bg-white border border-zinc-300 rounded-lg p-3 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div className="p-3 bg-white border border-zinc-200 rounded-lg text-zinc-700 text-[11px] flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>This digital camera will be updated to <strong className="text-zinc-900">AVAILABLE</strong> status in the Supabase database inventory. It will be immediately bookable by customers in Butuan City.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setReleasingCamera(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReleaseCamera}
                disabled={isReleasingProcessing}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isReleasingProcessing ? 'Releasing...' : 'Certify & Make Available'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
