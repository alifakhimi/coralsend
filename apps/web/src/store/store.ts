import { create } from 'zustand';

interface AppState {
  roomId: string | null;
  role: 'sender' | 'receiver' | null;
  status: 'idle' | 'connecting' | 'connected' | 'transferring' | 'completed' | 'error';
  progress: number;
  error: string | null;
  
  setRoomId: (id: string | null) => void;
  setRole: (role: 'sender' | 'receiver' | null) => void;
  setStatus: (status: AppState['status']) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useStore = create<AppState>((set) => ({
  roomId: null,
  role: null,
  status: 'idle',
  progress: 0,
  error: null,

  setRoomId: (id) => set({ roomId: id }),
  setRole: (role) => set({ role }),
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  reset: () => set({ roomId: null, role: null, status: 'idle', progress: 0, error: null }),
}));

