'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { cn } from '@/lib/utils';
import { CameraOff, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function QRScanner({ onScan, onError, className }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [boxSize, setBoxSize] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoSlotRef = useRef<HTMLDivElement>(null);

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return;

    setErrorMsg(null);

    try {
      const devices = await Html5Qrcode.getCameras();

      if (devices.length === 0) {
        setHasCamera(false);
        setErrorMsg('No camera found');
        onError?.('No camera found');
        return;
      }

      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch { /* ignore */ }
      }

      scannerRef.current = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });

      const rect = containerRef.current.getBoundingClientRect();
      const side = Math.min(Math.floor(Math.min(rect.width, rect.height) * 0.78), 320);
      setBoxSize(side);

      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: side, height: side } },
        (decodedText) => {
          if ('vibrate' in navigator) navigator.vibrate(100);
          onScan(decodedText);
        },
        undefined,
      );

      const moveVideo = () => {
        const video = document.querySelector('#qr-reader video') as HTMLVideoElement | null;
        if (video && videoSlotRef.current) {
          video.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:1rem;display:block;';
          videoSlotRef.current.appendChild(video);
          return true;
        }
        return false;
      };

      if (!moveVideo()) {
        const observer = new MutationObserver(() => {
          if (moveVideo()) observer.disconnect();
        });
        observer.observe(document.getElementById('qr-reader')!, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 5000);
      }

      setIsScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
      setErrorMsg(errorMessage);
      onError?.(errorMessage);
      setIsScanning(false);
    }
  }, [onScan, onError]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => startScanner(), 100);
    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  return (
    <div className={cn('relative flex flex-col', className)}>
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 bg-[var(--bg-base)] rounded-2xl overflow-hidden"
      >
        {/* html5-qrcode needs a real-size element to initialize; hidden after video is moved */}
        <div id="qr-reader" className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden="true" />

        {/* Video gets moved here via JS after scanner starts */}
        <div ref={videoSlotRef} className="absolute inset-0 z-0" />

        {isScanning && boxSize > 0 && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div className="relative" style={{ width: boxSize, height: boxSize }}>
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[var(--color-accent)] rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[var(--color-accent)] rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[var(--color-accent)] rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[var(--color-accent)] rounded-br-lg" />
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent animate-[scan_2s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {!hasCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-elevated)] p-4 z-10">
            <CameraOff className="w-16 h-16 text-[var(--text-muted)] mb-4" aria-hidden />
            <p className="text-[var(--text-muted)] text-center">No camera available</p>
          </div>
        )}

        {errorMsg && hasCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-elevated)] p-4 z-10">
            <CameraOff className="w-12 h-12 text-[var(--color-error)] mb-3" aria-hidden />
            <p className="text-[var(--color-error)] text-sm text-center mb-4">{errorMsg}</p>
            <Button variant="secondary" size="sm" onClick={startScanner}>
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        )}
      </div>

      <style jsx global>{`
        #qr-reader {
          border: none !important;
          padding: 0 !important;
        }
        #qr-shaded-region { display: none !important; }
        #qr-reader__dashboard,
        #qr-reader__status_span,
        #qr-reader__header_message { display: none !important; }

        @keyframes scan {
          0%, 100% { top: 0; opacity: 1; }
          50% { top: 100%; opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
