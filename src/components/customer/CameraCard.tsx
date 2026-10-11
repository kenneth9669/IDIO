'use client';
import React, { useState } from 'react';
import { DigitalCamera } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { ConditionBadge } from '../common/ConditionBadge';
import { formatPHP, getCameraImageUrl } from '../../lib/utils';
import { Camera, Video, ShieldCheck, Eye, Calendar, Sparkles } from 'lucide-react';

interface CameraCardProps {
  camera: DigitalCamera;
  onViewDetails: (camera: DigitalCamera) => void;
  onReserve: (camera: DigitalCamera) => void;
  dateFilteredAvailable?: boolean;
}

export const CameraCard: React.FC<CameraCardProps> = ({
  camera,
  onViewDetails,
  onReserve,
  dateFilteredAvailable
}) => {
  const [imgError, setImgError] = useState(false);
  const isAvailable = dateFilteredAvailable !== undefined ? dateFilteredAvailable : camera.status === 'AVAILABLE';
  const displayImageUrl = imgError ? '/cameras/placeholder.jpg' : getCameraImageUrl(camera.id, camera.imageUrl);

  return (
    <div className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden hover:border-zinc-400 hover:shadow-lg transition-all duration-300 shadow-xs group flex flex-col justify-between">
      <div>
        {/* Minimalist Studio Photography Image Showcase (4:3) */}
        <div className="relative aspect-[4/3] bg-gradient-to-b from-zinc-50 via-zinc-50/80 to-zinc-100/50 p-4 sm:p-5 flex items-center justify-center overflow-hidden border-b border-zinc-100">
          <img
            src={displayImageUrl}
            alt={`${camera.brand} ${camera.name} Digital Camera`}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain filter drop-shadow-sm"
            loading="lazy"
          />

          {/* Status badges overlay */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            <StatusBadge status={camera.status} size="sm" />
          </div>

          {/* Category Tag */}
          <div className="absolute top-3 right-3 z-10">
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-zinc-700 border border-zinc-200 shadow-xs">
              {camera.category}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5 space-y-3.5">
          <div>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{camera.brand}</p>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 line-clamp-1 group-hover:text-zinc-800 transition-colors">
              {camera.name}
            </h3>
            <p className="text-xs text-zinc-600 mt-1 line-clamp-2 leading-relaxed">
              {camera.description}
            </p>
          </div>

          {/* Technical Specs Summary */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-600">
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-zinc-50 border border-zinc-200/80">
              <Camera className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate font-medium">{camera.specs?.megapixels || '24.0 MP'}</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-zinc-50 border border-zinc-200/80">
              <Video className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate font-medium">
                {camera.specs?.videoResolution
                  ? `${camera.specs.videoResolution.split(' ')[0]} ${camera.specs.videoResolution.split(' ')[1] || ''}`.trim()
                  : '4K Video'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing & Actions Footer */}
      <div className="p-4 sm:p-5 pt-0 mt-auto">
        <div className="pt-3 border-t border-zinc-100 flex items-baseline justify-between mb-3.5">
          <div>
            <span className="text-lg sm:text-xl font-bold text-zinc-900">{formatPHP(camera.dailyRate)}</span>
            <span className="text-xs text-zinc-500 font-normal"> / day</span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
              Deposit: <strong className="text-zinc-700">{formatPHP(camera.securityDeposit)}</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onViewDetails(camera)}
            aria-label={`View technical specifications for ${camera.name}`}
            className="min-h-[44px] px-3 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-500" />
            <span>Details</span>
          </button>

          <button
            type="button"
            onClick={() => onReserve(camera)}
            disabled={!isAvailable}
            aria-label={isAvailable ? `Reserve ${camera.name}` : `${camera.name} is currently unavailable`}
            className={`min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              isAvailable
                ? 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{isAvailable ? 'Reserve' : 'Unavailable'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
