'use client';

import { useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useLayoutEffect(() => {
    try {
      const cached = localStorage.getItem('levelo_cached_auth_user');
      if (cached) {
        router.replace('/dashboard');
        return;
      }
    } catch {}
    router.replace('/login');
  }, [router]);

  return null;
}
