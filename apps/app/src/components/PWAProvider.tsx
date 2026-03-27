'use client';

import { useEffect } from 'react';
import { ToastContainer } from '@/components/ui/Toast';

/**
 * Registers the Service Worker for PWA share_target support.
 * Must run in the browser (client component).
 */
export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const swUrl = `${basePath}/sw.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        console.log('[CoralSend] Service Worker registered for share_target:', reg.scope);
      })
      .catch((err) => {
        console.warn('[CoralSend] Service Worker registration failed:', err);
      });
  }, []);

  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
