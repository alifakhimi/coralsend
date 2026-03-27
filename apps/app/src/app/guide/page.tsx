'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useStore } from '@/store/store';
import { useEnsureDevice } from '@/hooks/useAppInit';
import { useRoomActions } from '@/hooks/useRoomActions';
import { GuideStepper } from '@/components/guide/GuideStepper';
import { Step1Room } from '@/components/guide/Step1Room';
import { Step2Share } from '@/components/guide/Step2Share';
import { Step3Outbox } from '@/components/guide/Step3Outbox';
import { Button } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';

export default function GuidePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [guideRoomId, setGuideRoomId] = useState<string | null>(null);

  useEnsureDevice();
  const { createRoomCode } = useRoomActions();
  const { connect, shareFile, cleanup } = useWebRTC();
  const currentRoom = useStore((s) => s.currentRoom);

  const handleCreateRoom = () => {
    const roomId = createRoomCode();
    setGuideRoomId(roomId);
    connect(roomId, true);
    setStep(2);
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    cleanup();
    useStore.getState().leaveRoom();
    setStep(1);
    setGuideRoomId(null);
  };

  const handleSkipDemo = () => {
    setStep(3);
  };

  const handleEnterRoom = () => {
    if (currentRoom) {
      router.push(`/room/${currentRoom.id}`);
    }
  };

  const inRoom = currentRoom && guideRoomId && currentRoom.id === guideRoomId;

  return (
    <main className="page-shell overflow-auto">
      <div className="page-glow" />

      <div className="relative z-10 min-h-screen flex flex-col max-w-md mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <GuideStepper currentStep={step} />
          <div className="w-14" />
        </header>

        <div className="flex-1 flex flex-col justify-center py-4">
          {step === 1 && <Step1Room onCreateRoom={handleCreateRoom} />}

          {step === 2 && inRoom && currentRoom && (
            <Step2Share
              room={currentRoom}
              onNext={() => setStep(3)}
              onSkipDemo={handleSkipDemo}
            />
          )}

          {step === 3 && inRoom && (
            <Step3Outbox
              room={currentRoom}
              onShareFile={shareFile}
              onEnterRoom={handleEnterRoom}
            />
          )}
        </div>

      </div>
    </main>
  );
}
