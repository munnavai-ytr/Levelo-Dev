'use client';

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function LogoIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="levelo-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="levelo-bar-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* Rounded square background */}
      <rect width="32" height="32" rx="8" fill="url(#levelo-logo-grad)" />
      {/* Upward-stacked level bars (ascending steps: level 1, 2, 3) */}
      <rect x="6" y="19" width="5.5" height="7" rx="2" fill="url(#levelo-bar-grad)" opacity="0.75" />
      <rect x="13.25" y="13" width="5.5" height="13" rx="2" fill="url(#levelo-bar-grad)" opacity="0.9" />
      <rect x="20.5" y="7" width="5.5" height="19" rx="2" fill="url(#levelo-bar-grad)" />
      {/* Apex level indicator dot */}
      <circle cx="23.25" cy="4" r="1.5" fill="#fcd34d" />
    </svg>
  );
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizeConfig = {
    sm: { icon: 'w-6 h-6', text: 'text-base' },
    md: { icon: 'w-8 h-8', text: 'text-lg' },
    lg: { icon: 'w-12 h-12', text: 'text-2xl' },
  }[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className="shrink-0 shadow-md shadow-indigo-500/20 rounded-xl overflow-hidden transition-transform duration-200 group-hover:scale-105">
        <LogoIcon className={sizeConfig.icon} />
      </div>
      {showText && (
        <span className={`font-bold tracking-tight text-white leading-none ${sizeConfig.text}`}>
          Level<span className="text-indigo-400">o</span>
        </span>
      )}
    </div>
  );
}
