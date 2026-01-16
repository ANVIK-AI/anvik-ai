/**
 * Encryption utility for user data protection
 * Uses AES-256-GCM for authenticated encryption
 * Keys are derived per-user using PBKDF2 with master secret
 */

import * as crypto from 'crypto';

// Configuration constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000;
const ENCRYPTED_PREFIX = 'ENC:'; // Prefix to identify encrypted values

/**
 * Get the master encryption key from environment
 * @throws Error if key is not configured
 */
function getMasterKey(): string {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey || masterKey.length < 32) {
        throw new Error(
            'ENCRYPTION_MASTER_KEY environment variable must be set with at least 32 characters'
        );
    }
    return masterKey;
}

/**
 * Derive a user-specific encryption key using PBKDF2
 * @param userId - The user's unique identifier (used as salt)
 * @returns 256-bit derived key
 */
export function deriveKey(userId: string): Buffer {
    const masterKey = getMasterKey();
    // Use userId as salt to ensure each user has a unique key
    const salt = Buffer.from(`user_salt_${userId}`, 'utf8');
    return crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt plaintext using AES-256-GCM with user-specific key
 * @param plaintext - The text to encrypt
 * @param userId - The user's ID for key derivation
 * @returns Encrypted string in format: ENC:IV:AuthTag:CipherText (base64)
 */
export function encrypt(plaintext: string, userId: string): string {
    if (!plaintext || plaintext.trim() === '') {
        return plaintext; // Don't encrypt empty strings
    }

    // Don't double-encrypt
    if (isEncrypted(plaintext)) {
        return plaintext;
    }

    const key = deriveKey(userId);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: ENC:IV:AuthTag:CipherText (all base64 encoded)
    return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM with user-specific key
 * @param ciphertext - The encrypted string (format: ENC:IV:AuthTag:CipherText)
 * @param userId - The user's ID for key derivation
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string, userId: string): string {
    if (!ciphertext || ciphertext.trim() === '') {
        return ciphertext; // Handle empty strings
    }

    // If not encrypted, return as-is (supports gradual migration)
    if (!isEncrypted(ciphertext)) {
        return ciphertext;
    }

    try {
        const key = deriveKey(userId);

        // Remove prefix and split components
        const withoutPrefix = ciphertext.slice(ENCRYPTED_PREFIX.length);
        const parts = withoutPrefix.split(':');

        if (parts.length !== 3) {
            // Not properly encrypted, return original
            return ciphertext;
        }

        const [ivBase64, authTagBase64, encryptedData] = parts;

        // Validate base64 strings are not empty
        if (!ivBase64 || !authTagBase64 || !encryptedData) {
            return ciphertext;
        }

        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');

        // Validate IV and authTag lengths
        if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
            return ciphertext;
        }

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        // Silently return original value - data might not be encrypted yet,
        // or encrypted with a different key (migration in progress)
        return ciphertext;
    }
}

/**
 * Check if a string appears to be encrypted with our format
 * @param text - The text to check
 * @returns true if text appears to be encrypted with valid format
 */
export function isEncrypted(text: string): boolean {
    if (!text || typeof text !== 'string') {
        return false;
    }

    // Must start with our prefix
    if (!text.startsWith(ENCRYPTED_PREFIX)) {
        return false;
    }

    // Must have proper format: ENC:IV:AuthTag:Data (3 parts after prefix)
    const withoutPrefix = text.slice(ENCRYPTED_PREFIX.length);
    const parts = withoutPrefix.split(':');

    if (parts.length !== 3) {
        return false;
    }

    // All parts must be non-empty (likely base64)
    return parts.every(part => part && part.length > 0);
}

/**
 * Encrypt multiple fields in an object
 * @param data - Object with fields to encrypt
 * @param fields - Array of field names to encrypt
 * @param userId - User ID for key derivation
 * @returns Object with encrypted fields
 */
export function encryptFields<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[],
    userId: string
): T {
    const result = { ...data };
    for (const field of fields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = encrypt(result[field], userId) as T[keyof T];
        }
    }
    return result;
}

/**
 * Decrypt multiple fields in an object
 * @param data - Object with fields to decrypt
 * @param fields - Array of field names to decrypt
 * @param userId - User ID for key derivation
 * @returns Object with decrypted fields
 */
export function decryptFields<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[],
    userId: string
): T {
    const result = { ...data };
    for (const field of fields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = decrypt(result[field], userId) as T[keyof T];
        }
    }
    return result;
}

/**
 * Test encryption/decryption works correctly
 * Useful for verification during deployment
 */
export function testEncryption(userId: string = 'test-user-123'): boolean {
    try {
        const testData = 'Hello, this is a test message! 🔐';
        const encrypted = encrypt(testData, userId);
        const decrypted = decrypt(encrypted, userId);

        if (decrypted !== testData) {
            console.error('Encryption test failed: decrypted data does not match original');
            return false;
        }

        if (!isEncrypted(encrypted)) {
            console.error('Encryption test failed: encrypted data not detected as encrypted');
            return false;
        }

        console.log('Encryption test passed ✓');
        return true;
    } catch (error) {
        console.error('Encryption test failed:', error);
        return false;
    }
}
