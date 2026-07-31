/**
 * Generate a random room code (6 alphanumeric characters).
 * Excludes ambiguous chars (0, O, 1, I, L) for readability.
 * Single source of truth for room ID generation across app and future library.
 */
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

/** Check if a string is a valid room code (6 alphanumeric) or UUID */
export function isValidRoomId(value: string): boolean {
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(trimmed) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}
