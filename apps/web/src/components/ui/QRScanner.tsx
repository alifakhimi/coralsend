'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { cn } from '@/lib/utils';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanner = async () => {
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
        await scannerRef.current.stop();
      }

      scannerRef.current = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });

      const rect = containerRef.current.getBoundingClientRect();
      const qrBoxSide = Math.min(Math.floor(Math.min(rect.width, rect.height) * 0.65), 280);

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: qrBoxSide, height: qrBoxSide },
        },
        (decodedText) => {
          if ('vibrate' in navigator) navigator.vibrate(100);
          onScan(decodedText);
        },
        undefined,
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
      setErrorMsg(errorMessage);
      onError?.(errorMessage);
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => startScanner(), 100);
    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, []);

  return (
    <div className={cn('relative flex flex-col', className)}>
      {/* Camera viewport — grows to fill parent */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 bg-slate-900 rounded-2xl overflow-hidden"
      >
        <div id="qr-reader" className="w-full h-full" />

        {isScanning && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[65%] max-w-[280px] aspect-square relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-teal-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-teal-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-teal-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-teal-400 rounded-br-lg" />
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-[scan_2s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {!hasCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/90 p-4">
            <CameraOff className="w-16 h-16 text-slate-500 mb-4" aria-hidden />
            <p className="text-slate-400 text-center">No camera available</p>
          </div>
        )}

        {errorMsg && hasCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/90 p-4">
            <CameraOff className="w-12 h-12 text-red-400 mb-3" aria-hidden />
            <p className="text-red-400 text-sm text-center mb-4">{errorMsg}</p>
            <Button variant="secondary" size="sm" onClick={startScanner}>
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        )}
      </div>

      <style jsx global>{`
        #qr-reader { border: none !important; }
        #qr-reader__scan_region { background: transparent !important; }
        #qr-reader__scan_region video {
          border-radius: 1rem;
          object-fit: cover;
          width: 100% !important;
          height: 100% !important;
        }
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
