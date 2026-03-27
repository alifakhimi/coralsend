'use client';

import { ArrowRight } from 'lucide-react';
import { useRoomActions } from '@/hooks/useRoomActions';
import { cn } from '@/lib/utils';

interface CreateRoomCtaProps {
  className?: string;
}

export function CreateRoomCta({ className }: CreateRoomCtaProps) {
  const { createRoomAndNavigate } = useRoomActions();

  return (
    <button type="button" onClick={createRoomAndNavigate} className={cn(className)}>
      Create a room
      <ArrowRight className="w-4 h-4" />
    </button>
  );
}

