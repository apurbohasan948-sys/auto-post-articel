/**
 * Axiom Security & Credential Encryption Service
 * Handles AES-256-GCM cryptographic encryption for API keys and safe credential masking.
 * Ensures zero credential leakage in logs, frontend responses, and UI payloads.
 */

import crypto from 'crypto';

const SECRET = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'axiom-content-agent-production-secret-2026-key';
const ALGORITHM = 'aes-256-gcm';

// Derive 32-byte key
function getDerivedKey(): Buffer {
  return crypto.createHash('sha256').update(SECRET).digest();
}

/**
 * Encrypts an API key or sensitive secret using AES-256-GCM.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText || plainText.startsWith('enc:v1:')) {
    return plainText;
  }

  try {
    const key = getDerivedKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[Encryption] Failed to encrypt secret:', err);
    return plainText;
  }
}

/**
 * Decrypts an AES-256-GCM encrypted secret. If not encrypted, returns as-is.
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText || !cipherText.startsWith('enc:v1:')) {
    return cipherText;
  }

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 5) {
      return cipherText;
    }

    const [, , ivHex, authTagHex, encryptedHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.warn('[Encryption] Decryption failed or invalid key:', err);
    return '';
  }
}

/**
 * Masks an API key for safe display in the frontend UI.
 * e.g. "sk-proj-1234567890abcdef" -> "sk-••••••••••••cdef"
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  const plain = decryptSecret(key);
  if (!plain) return '';

  if (plain.length <= 8) {
    return '••••••••';
  }

  // Detect prefixes like "sk-", "tvly-", "AIzaSy"
  let prefix = '';
  if (plain.startsWith('sk-')) prefix = 'sk-';
  else if (plain.startsWith('tvly-')) prefix = 'tvly-';
  else if (plain.startsWith('AIza')) prefix = 'AIza';
  else prefix = plain.substring(0, 3);

  const suffix = plain.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}
