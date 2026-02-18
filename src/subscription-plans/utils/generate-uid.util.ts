import * as crypto from 'crypto';

/**
 * Generates a unique subscription plan UID
 * Format: blt + 8 hex characters (e.g., blt1a2b3c4d5e6f7g8)
 * @returns A unique subscription plan UID starting with 'blt'
 */
export function generateSubscriptionPlanUid(): string {
  return 'blt' + crypto.randomBytes(8).toString('hex');
}
