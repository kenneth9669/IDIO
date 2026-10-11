'use client';
import React, { useState, useEffect } from 'react';
import { DigitalCamera, CameraCategory, CameraCondition, CameraStatus } from '../../types';
import { Dialog } from '../common/Dialog';
import { Camera, Plus, Layers, DollarSign, Image } from 'lucide-react';

interface CameraFormModalProps {
  camera: DigitalCamera | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<DigitalCamera, 'id' | 'createdAt' | 'updatedAt' | 'totalRentalsCount'>) => void;
}

export const CameraFormModal: React.FC<CameraFormModalProps> = ({
  camera,
  isOpen,
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState<DigitalCamera['brand']>('Sony');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [category, setCategory] = useState<CameraCategory>('Mirrorless');
  const [dailyRate, setDailyRate] = useState<number>(1200);
  const [securityDeposit, setSecurityDeposit] = useState<number>(2500);
  const [status, setStatus] = useState<CameraStatus>('AVAILABLE');
  const [condition, setCondition] = useState<CameraCondition>('Excellent');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  
  // Specs
  const [sensor, setSensor] = useState('33.0 MP Full-Frame Exmor R CMOS');
  const [megapixels, setMegapixels] = useState('33.0 MP');
  const [videoResolution, setVideoResolution] = useState('4K 60p 10-bit');
  const [isoRange, setIsoRange] = useState('100 - 51,200');
  const [lensMountOrKit, setLensMountOrKit] = useState('Sony E-Mount (28-70mm Kit Included)');
  const [screen, setScreen] = useState('3.0-inch Vari-angle Touchscreen');
  const [connectivity, setConnectivity] = useState('Wi-Fi, Bluetooth, USB-C');
  const [batteryLife, setBatteryLife] = useState('Approx. 580 shots');
  const [weight, setWeight] = useState('650g');

  const [packageIncludes, setPackageIncludes] = useState<string[]>([
    'Camera Body',
    '2x Rechargeable Batteries',
    '1x 128GB High-Speed SD Card',
    'Battery Charger & Cable',
    'Padded Shoulder Bag'
  ]);
  const [newInclusion, setNewInclusion] = useState('');

  useEffect(() => {
    if (camera) {
      setName(camera.name);
      setBrand(camera.brand);
      setModel(camera.model);
      setSerialNumber(camera.serialNumber);
      setCategory(camera.category);
      setDailyRate(camera.dailyRate);
      setSecurityDeposit(camera.securityDeposit);
      setStatus(camera.status);
      setCondition(camera.condition);
      setDescription(camera.description);
      setImageUrl(camera.imageUrl);
      setSensor(camera.specs.sensor);
      setMegapixels(camera.specs.megapixels);
      setVideoResolution(camera.specs.videoResolution);
      setIsoRange(camera.specs.isoRange);
      setLensMountOrKit(camera.specs.lensMountOrKit);
      setScreen(camera.specs.screen);
      setConnectivity(camera.specs.connectivity);
      setBatteryLife(camera.specs.batteryLife);
      setWeight(camera.specs.weight);
      setPackageIncludes(camera.packageIncludes || []);
    } else {
      setName('');
      setBrand('Sony');
      setModel('');
      setSerialNumber(`SN-CAM-${Math.floor(1000 + Math.random() * 9000)}`);
      setCategory('Mirrorless');
      setDailyRate(1200);
      setSecurityDeposit(2500);
      setStatus('AVAILABLE');
      setCondition('Excellent');
      setDescription('');
      setImageUrl('https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80');
      setPackageIncludes([
        'Camera Body',
        '2x Rechargeable Batteries',
        '1x 128GB High-Speed SD Card',
        'Battery Charger & Cable',
        'Padded Shoulder Bag'
      ]);
    }
  }, [camera, isOpen]);

  const handleAddInclusion = () => {
    if (newInclusion.trim()) {
      setPackageIncludes([...packageIncludes, newInclusion.trim()]);
      setNewInclusion('');
    }
  };

  const handleRemoveInclusion = (index: number) => {
    setPackageIncludes(packageIncludes.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      brand,
      model: model || name,
      serialNumber,
      category,
      dailyRate: Number(dailyRate),
      securityDeposit: Number(securityDeposit),
      status,
      condition,
      description,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
      specs: {
        sensor,
        megapixels,
        videoResolution,
        isoRange,
        lensMountOrKit,
        screen,
        connectivity,
        batteryLife,
        weight
      },
      packageIncludes
    });
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-zinc-900">
          <Camera className="w-5 h-5 text-zinc-700" />
          <span>{camera ? `Edit Camera: ${camera.name}` : 'Add New Camera to Fleet'}</span>
        </div>
      }
      description="Configure camera specifications, serial identifiers, pricing, and rental package inclusions."
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 text-xs text-zinc-700">
        {/* Basic Info */}
        <div className="space-y-3">
          <h4 className="font-semibold uppercase tracking-wider text-zinc-500 text-[11px] flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-zinc-400" /> 1. Core Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-zinc-700 font-medium mb-1">Commercial Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sony Alpha 7 IV Mirrorless"
                required
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">Serial Number *</label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                required
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">Brand *</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value as any)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              >
                <option value="Sony">Sony</option>
                <option value="Canon">Canon</option>
                <option value="Fujifilm">Fujifilm</option>
                <option value="Nikon">Nikon</option>
                <option value="Ricoh">Ricoh</option>
                <option value="Panasonic">Panasonic</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CameraCategory)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              >
                <option value="Mirrorless">Digital Mirrorless</option>
                <option value="Compact">Digital Compact</option>
                <option value="DSLR">Digital DSLR</option>
                <option value="Vlog & Creator">Vlog &amp; Creator</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">Model Code</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. ILCE-7M4"
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              />
            </div>
          </div>
        </div>

        {/* Pricing & Initial Status */}
        <div className="space-y-3 pt-3 border-t border-zinc-100">
          <h4 className="font-semibold uppercase tracking-wider text-zinc-500 text-[11px] flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-zinc-400" /> 2. Pricing &amp; Condition
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-zinc-700 font-medium mb-1">Daily Rate (₱) *</label>
              <input
                type="number"
                value={dailyRate}
                onChange={(e) => setDailyRate(Number(e.target.value))}
                min={100}
                required
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">Security Deposit (₱) *</label>
              <input
                type="number"
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                min={500}
                required
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              />
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CameraStatus)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="DAMAGED">DAMAGED</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-700 font-medium mb-1">Condition Grade</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as CameraCondition)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              >
                <option value="Excellent">Excellent (Grade A)</option>
                <option value="Good">Good (Grade B)</option>
                <option value="Fair">Fair (Grade C)</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>
          </div>
        </div>

        {/* Technical Specs */}
        <div className="space-y-3 pt-3 border-t border-zinc-100">
          <h4 className="font-semibold uppercase tracking-wider text-zinc-500 text-[11px] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" /> 3. Technical Specifications
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-zinc-600 mb-1">Sensor Spec</label>
              <input
                type="text"
                value={sensor}
                onChange={(e) => setSensor(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              />
            </div>
            <div>
              <label className="block text-zinc-600 mb-1">Megapixels</label>
              <input
                type="text"
                value={megapixels}
                onChange={(e) => setMegapixels(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              />
            </div>
            <div>
              <label className="block text-zinc-600 mb-1">Video Resolution</label>
              <input
                type="text"
                value={videoResolution}
                onChange={(e) => setVideoResolution(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              />
            </div>
            <div>
              <label className="block text-zinc-600 mb-1">Lens / Mount Included</label>
              <input
                type="text"
                value={lensMountOrKit}
                onChange={(e) => setLensMountOrKit(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              />
            </div>
            <div>
              <label className="block text-zinc-600 mb-1">Screen Details</label>
              <input
                type="text"
                value={screen}
                onChange={(e) => setScreen(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              />
            </div>
            <div>
              <label className="block text-zinc-600 mb-1">Battery Rating</label>
              <input
                type="text"
                value={batteryLife}
                onChange={(e) => setBatteryLife(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              />
            </div>
          </div>
        </div>

        {/* Media & Package Inclusions */}
        <div className="space-y-3 pt-3 border-t border-zinc-100">
          <h4 className="font-semibold uppercase tracking-wider text-zinc-500 text-[11px] flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5 text-zinc-400" /> 4. Description &amp; Inclusions
          </h4>
          <div>
            <label className="block text-zinc-700 font-medium mb-1">Product Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Short description highlighting features and best use cases..."
              className="w-full bg-white border border-zinc-300 rounded-lg p-3 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
            />
          </div>

          <div>
            <label className="block text-zinc-700 font-medium mb-1">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
            />
          </div>

          <div>
            <label className="block text-zinc-700 font-medium mb-1.5">Package Inclusions</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newInclusion}
                onChange={(e) => setNewInclusion(e.target.value)}
                placeholder="e.g. 2x Extra NP-FZ100 Batteries"
                className="flex-1 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
              />
              <button
                type="button"
                onClick={handleAddInclusion}
                className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg font-medium flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {packageIncludes.map((inc, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-700 text-[11px]"
                >
                  {inc}
                  <button
                    type="button"
                    onClick={() => handleRemoveInclusion(i)}
                    className="text-zinc-400 hover:text-rose-600 font-bold cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-xs cursor-pointer"
          >
            {camera ? 'Save Changes' : 'Add Camera'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};
