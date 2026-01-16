/**
 * Test script for encryption utility
 * Run with: npx tsx scripts/test-encryption.ts
 */

import { encrypt, decrypt, testEncryption, isEncrypted } from '../src/utils/encryption.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔐 Testing Encryption Utility\n');
console.log('='.repeat(50));

// Test 1: Basic encryption test
console.log('\n1. Running basic encryption test...');
const basicTest = testEncryption('test-user-123');
console.log(`   Result: ${basicTest ? '✓ PASS' : '✗ FAIL'}`);

// Test 2: Test with sample user data
console.log('\n2. Testing with sample memory data...');
const userId = 'user_12345';
const originalText = 'This is my secret memory about email: test@example.com';
console.log(`   User ID: ${userId}`);
console.log(`   Original: ${originalText}`);

const encrypted = encrypt(originalText, userId);
console.log(`   Encrypted: ${encrypted.substring(0, 60)}...`);
console.log(`   isEncrypted check: ${isEncrypted(encrypted)}`);

const decrypted = decrypt(encrypted, userId);
console.log(`   Decrypted: ${decrypted}`);
console.log(`   Match: ${originalText === decrypted ? '✓ PASS' : '✗ FAIL'}`);

// Test 3: Different users get different ciphertext
console.log('\n3. Testing user isolation (different users = different ciphertext)...');
const user1 = 'user_abc';
const user2 = 'user_xyz';
const sameData = 'Same secret data';

const encrypted1 = encrypt(sameData, user1);
const encrypted2 = encrypt(sameData, user2);

console.log(`   User 1 encrypted: ${encrypted1.substring(0, 40)}...`);
console.log(`   User 2 encrypted: ${encrypted2.substring(0, 40)}...`);
console.log(`   Ciphertexts different: ${encrypted1 !== encrypted2 ? '✓ PASS' : '✗ FAIL'}`);

// Test 4: User can only decrypt their own data
console.log('\n4. Testing cross-user decryption (should fail gracefully)...');
const decryptedWrongUser = decrypt(encrypted1, user2);
// This should return the original ciphertext or throw, depending on implementation
console.log(`   Decrypting user1's data with user2's key: ${decryptedWrongUser === sameData ? '✗ SECURITY ISSUE' : '✓ PASS (access denied)'}`);

// Test 5: Empty string handling
console.log('\n5. Testing empty/null handling...');
const emptyEncrypted = encrypt('', userId);
const nullish = encrypt(null as any, userId);
console.log(`   Empty string: ${emptyEncrypted === '' ? '✓ PASS' : '✗ FAIL'}`);
console.log(`   Null handling: ${nullish === null ? '✓ PASS' : '✗ FAIL'}`);

// Test 6: Unencrypted data passthrough
console.log('\n6. Testing unencrypted data passthrough...');
const plaintext = 'This is plain text, not encrypted';
const decryptedPlain = decrypt(plaintext, userId);
console.log(`   Plain text preserved: ${decryptedPlain === plaintext ? '✓ PASS' : '✗ FAIL'}`);

console.log('\n' + '='.repeat(50));
console.log('All tests completed!\n');
