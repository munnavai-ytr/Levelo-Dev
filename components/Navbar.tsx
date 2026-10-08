'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/use-auth';
import { 
  Gamepad2, 
  Sun, 
  Moon, 
  LogOut, 
  User as UserIcon, 
  Settings, 
  LayoutDashboard,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton';

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useAppStore();
  const { user, signOut, isAuthLoading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Explore', href: '/explore' },
    { label: 'Settings', href: '/settings' },
  ];

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Zone 1: Wordmark Brand */}
      <div className="flex items-center gap-6">
        <Link 
          href={user ? '/dashboard' : '/login'} 
          className="group block"
        >
          <Logo size="md" />
        </Link>

        {/* Zone 2: Navigation Links */}
        {user && (
          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-400 ml-4">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors py-1 hover:text-slate-100 ${
                    isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2.5">
        {/* PWA In-App Install Button */}
        <PWAInstallButton />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          className="w-8 h-8 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 flex items-center justify-center transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-400" />}
        </button>

        {/* User Account / Sign In */}
        {!isAuthLoading && (
          <>
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800/80 transition-colors text-xs text-slate-200"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-[11px]">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden sm:inline font-medium max-w-[120px] truncate text-slate-200">
                    {user.displayName || user.email || 'User'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1 z-50 text-xs animate-in fade-in-50 zoom-in-95">
                    <div className="px-3 py-2 border-b border-slate-800">
                      <p className="font-medium text-slate-200 truncate">{user.displayName || 'Developer'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email || 'local@workspace'}</p>
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                      Dashboard
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      Settings & Gemini
                    </Link>
                    <div className="border-t border-slate-800 my-1"></div>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors whitespace-nowrap"
              >
                Sign In
              </Link>
            )}
          </>
        )}
      </div>
    </header>
  );
}
