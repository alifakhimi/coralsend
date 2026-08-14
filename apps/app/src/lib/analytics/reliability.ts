import { analytics } from './index';

export type TransferSizeBucket = 'under_1_mib' | '1_to_10_mib' | '10_to_100_mib' | '100_mib_or_more';
export type TransferDurationBucket = 'under_1s' | '1_to_5s' | '5_to_30s' | '30s_to_2m' | '2m_or_more';
export type TransferFailureCategory =
  | 'cancelled_by_recipient'
  | 'connection_unavailable'
  | 'data_channel_error'
  | 'storage_error'
  | 'protocol_error';

export function transferSizeBucket(bytes: number): TransferSizeBucket {
  if (bytes < 1024 * 1024) return 'under_1_mib';
  if (bytes < 10 * 1024 * 1024) return '1_to_10_mib';
  if (bytes < 100 * 1024 * 1024) return '10_to_100_mib';
  return '100_mib_or_more';
}

export function transferDurationBucket(milliseconds: number): TransferDurationBucket {
  if (milliseconds < 1_000) return 'under_1s';
  if (milliseconds < 5_000) return '1_to_5s';
  if (milliseconds < 30_000) return '5_to_30s';
  if (milliseconds < 120_000) return '30s_to_2m';
  return '2m_or_more';
}

export function trackTransferAttempt(bytes: number): void {
  analytics.track('transfer_attempt', {
    direction: 'receive',
    size_bucket: transferSizeBucket(bytes),
  });
}

export function trackTransferCompleted(bytes: number, elapsedMilliseconds: number): void {
  analytics.track('transfer_completed', {
    direction: 'receive',
    size_bucket: transferSizeBucket(bytes),
    duration_bucket: transferDurationBucket(elapsedMilliseconds),
  });
}

export function trackTransferFailed(
  bytes: number,
  elapsedMilliseconds: number,
  failureCategory: TransferFailureCategory,
): void {
  analytics.track('transfer_failed', {
    direction: 'receive',
    size_bucket: transferSizeBucket(bytes),
    duration_bucket: transferDurationBucket(elapsedMilliseconds),
    failure_category: failureCategory,
  });
}
