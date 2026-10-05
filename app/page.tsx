'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/Logo';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { user, isAuthLoading } = useAuth();

  useEffect(() => {
    if (!isAuthLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isAuthLoading, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
      <Logo size="lg" />
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
        <span>Loading Levelo...</span>
      </div>
    </div>
  );
}
