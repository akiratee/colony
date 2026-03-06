// Shared ID Generator for Colony
// Uses crypto.randomUUID() for guaranteed uniqueness under high load

/**
 * Generates a unique ID using crypto.randomUUID()
 * This is safer than Date.now() + random under high load conditions
 * where collisions could occur
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generates a shorter unique ID (useful for IDs that need to be more human-readable)
 * Format: timestamp-randomstring
 * @deprecated Use generateId() for better uniqueness guarantees
 */
export function generateShortId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
