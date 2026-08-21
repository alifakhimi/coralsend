/**
 * Human-readable Device ID Generator
 * Generates memorable IDs like "Blue-Coral-42" or "Happy-Tiger-88"
 */

const adjectives = [
  'Blue', 'Red', 'Green', 'Purple', 'Golden', 'Silver', 'Coral', 'Ocean',
  'Sunny', 'Happy', 'Swift', 'Brave', 'Calm', 'Bright', 'Wild', 'Gentle',
  'Lucky', 'Noble', 'Quiet', 'Vivid', 'Warm', 'Cool', 'Fresh', 'Bold',
  'Misty', 'Amber', 'Azure', 'Jade', 'Ruby', 'Pearl', 'Ivory', 'Crimson'
];

const nouns = [
  'Coral', 'Tiger', 'Eagle', 'Dolphin', 'Wolf', 'Phoenix', 'Dragon', 'Falcon',
  'Panda', 'Lion', 'Bear', 'Hawk', 'Whale', 'Fox', 'Owl', 'Raven',
  'Shark', 'Orca', 'Lynx', 'Seal', 'Crane', 'Swan', 'Deer', 'Elk',
  'Reef', 'Wave', 'Storm', 'Star', 'Moon', 'Sun', 'Cloud', 'Peak'
];

const STORAGE_KEY = 'coralsend_device_id_v2';
const LEGACY_STORAGE_KEY = 'coralsend_device_id';

/**
 * Generate a random human-readable device ID
 */
export function generateDeviceId(): string {
  return crypto.randomUUID();
}

/**
 * Get the device ID from localStorage or generate a new one
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return generateDeviceId();
  }
  
  let deviceId = localStorage.getItem(STORAGE_KEY);
  
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  
  return deviceId;
}

/**
 * Reset the device ID (generate a new one)
 */
export function resetDeviceId(): string {
  const newId = generateDeviceId();
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, newId);
  }
  return newId;
}

/**
 * Get display name (short version) from device ID
 * e.g., "Blue-Coral-42" -> "Blue-Coral"
 */
export function getShortName(deviceId: string): string {
  if (/^[0-9a-f-]{36}$/iu.test(deviceId)) {
    const legacyName = typeof window !== 'undefined' ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
    if (legacyName) return legacyName.split('-').slice(0, 2).join('-');
    const bytes = new TextEncoder().encode(deviceId);
    const first = bytes.reduce((sum, byte) => sum + byte, 0) % adjectives.length;
    const second = bytes.reduce((sum, byte, index) => sum + byte * (index + 1), 0) % nouns.length;
    return `${adjectives[first]}-${nouns[second]}`;
  }
  const parts = deviceId.split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return deviceId;
}

/**
 * Get initials from device ID
 * e.g., "Blue-Coral-42" -> "BC"
 */
export function getInitials(deviceId: string): string {
  const parts = deviceId.split('-');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`;
  }
  return deviceId.substring(0, 2).toUpperCase();
}

/**
 * Generate a color from device ID for avatar
 */
export function getAvatarColor(deviceId: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < deviceId.length; i++) {
    hash = deviceId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate HSL color with good saturation and lightness
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}
