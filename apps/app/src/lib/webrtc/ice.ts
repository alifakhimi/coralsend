import { logger } from '@/lib/logger';
import type { ConnectionPath } from '@/store/store';

const diagnostics = process.env.NEXT_PUBLIC_ICE_DIAGNOSTICS === 'true';

export function parseCandidateType(candidate: RTCIceCandidate | RTCIceCandidateInit): string {
  const match = (candidate.candidate ?? '').match(/\btyp\s+([a-zA-Z0-9]+)/u);
  return match?.[1] ?? 'unknown';
}

export async function detectIcePath(pc: RTCPeerConnection, remoteDeviceId: string): Promise<ConnectionPath> {
  void remoteDeviceId;
  try {
    const stats = await pc.getStats();
    let selectedPair: RTCStats | null = null;
    const candidates = new Map<string, RTCStats>();
    stats.forEach((report) => {
      if (report.type === 'local-candidate' || report.type === 'remote-candidate') candidates.set(report.id, report);
      if (report.type === 'candidate-pair') {
        const pair = report as RTCStats & { selected?: boolean; state?: string; nominated?: boolean };
        if (pair.selected || pair.state === 'succeeded' || pair.nominated) selectedPair = pair;
      }
    });
    if (!selectedPair) {
      if (diagnostics) logger.debug('ICE', 'No selected candidate pair yet');
      return 'unknown';
    }
    const pair = selectedPair as RTCStats & { localCandidateId?: string; remoteCandidateId?: string; state?: string };
    const local = pair.localCandidateId ? candidates.get(pair.localCandidateId) : undefined;
    const remote = pair.remoteCandidateId ? candidates.get(pair.remoteCandidateId) : undefined;
    const localType = (local as RTCStats & { candidateType?: string } | undefined)?.candidateType ?? 'unknown';
    const remoteType = (remote as RTCStats & { candidateType?: string } | undefined)?.candidateType ?? 'unknown';
    logger.info('ICE', `Selected ${localType}/${remoteType} candidate pair`);
    return localType === 'relay' || remoteType === 'relay' ? 'relay' : 'direct';
  } catch {
    logger.warn('ICE', 'Failed to inspect selected candidate pair');
    return 'unknown';
  }
}
