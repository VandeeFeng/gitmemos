import crypto from 'crypto';
import { debugLog, errorLog } from '@/lib/debug';

// 添加调试信息
debugLog('Loading encryption module with environment variables:', {
  hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
  hasWebhookSecret: !!process.env.GITHUB_WEBHOOK_SECRET,
  encryptionKeyLength: process.env.ENCRYPTION_KEY?.length,
  webhookSecretLength: process.env.GITHUB_WEBHOOK_SECRET?.length
});

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.GITHUB_WEBHOOK_SECRET || '';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// 确保只在服务器端运行
export function ensureServer() {
  if (typeof window !== 'undefined') {
    throw new Error('Encryption operations can only be performed on the server side');
  }
}

export function encryptToken(token: string): string {
  debugLog('Loading encryption module with environment variables:', {
    hasKey: !!process.env.ENCRYPTION_KEY,
  });

  ensureServer();
  debugLog('Starting token encryption...');
  
  if (!ENCRYPTION_KEY) {
    errorLog('No encryption key found in environment variables');
    throw new Error('Encryption key not configured');
  }

  try {
    // Generate a random salt
    const salt = crypto.randomBytes(SALT_LENGTH);
    debugLog('Salt generated successfully');
    
    // Create a key using PBKDF2
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');
    debugLog('Key derived successfully');
    
    // Generate a random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    debugLog('IV generated successfully');
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    debugLog('Cipher created successfully');
    
    // Encrypt the token
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    debugLog('Token encrypted successfully');
    
    // Get the auth tag
    const authTag = cipher.getAuthTag();
    debugLog('Auth tag generated successfully');
    
    // Combine all components
    const result = `${salt.toString('base64')}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    debugLog('Encryption completed successfully');
    
    return result;
  } catch (error) {
    errorLog('Error during encryption:', error);
    throw error;
  }
}

export function decryptToken(encryptedData: string): string {
  ensureServer();
  debugLog('Starting token decryption...');
  
  if (!ENCRYPTION_KEY) {
    errorLog('No encryption key found in environment variables');
    throw new Error('Encryption key not configured');
  }

  try {
    // Split the encrypted data into its components
    const [saltBase64, ivBase64, authTagBase64, encrypted] = encryptedData.split(':');
    debugLog('Components split successfully');
    
    if (!saltBase64 || !ivBase64 || !authTagBase64 || !encrypted) {
      errorLog('Invalid encrypted data format:', { 
        hasSalt: !!saltBase64, 
        hasIV: !!ivBase64, 
        hasAuthTag: !!authTagBase64, 
        hasEncrypted: !!encrypted 
      });
      throw new Error('Invalid encrypted data format');
    }
    
    // Convert components back to buffers
    const salt = Buffer.from(saltBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    debugLog('Components converted to buffers successfully');
    
    // Recreate the key using PBKDF2
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');
    debugLog('Key derived successfully');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    debugLog('Decipher created and auth tag set successfully');
    
    // Decrypt the token
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    debugLog('Token decrypted successfully');
    
    return decrypted;
  } catch (error) {
    errorLog('Error during decryption:', error);
    throw error;
  }
}

export function isEncryptedToken(text: string): boolean {
  if (typeof text !== 'string') {
    return false;
  }

  try {
    const [saltBase64, ivBase64, authTagBase64, encrypted] = text.split(':');

    // Verify all components exist
    if (!saltBase64 || !ivBase64 || !authTagBase64 || !encrypted) {
      return false;
    }

    // Verify component lengths
    const salt = Buffer.from(saltBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    return (
      salt.length === SALT_LENGTH &&
      iv.length === IV_LENGTH &&
      authTag.length === AUTH_TAG_LENGTH &&
      encrypted.length > 0
    );
  } catch {
    return false;
  }
} 