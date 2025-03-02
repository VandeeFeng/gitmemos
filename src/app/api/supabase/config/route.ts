import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { DbConfig } from '@/types/github';
import { encryptToken, decryptToken, isEncryptedToken } from '@/lib/encryption';
import { debugLog, errorLog } from '@/lib/debug';

// Define environment variable types
interface EnvVariables {
  GITHUB_OWNER: boolean;
  GITHUB_REPO: boolean;
  HAS_TOKEN: boolean;
  TOKEN_TYPE: string;
}

// Helper function to create a safe version of config (without token)
const createSafeConfig = (config: DbConfig) => ({
  owner: config.owner,
  repo: config.repo,
  issues_per_page: config.issues_per_page || 10
});

// Helper function to handle token encryption
const handleTokenEncryption = (token: string): string => {
  if (!token) {
    errorLog('Empty token passed to encryption');
    return '';
  }
  if (typeof token !== 'string') {
    errorLog('Token is not a string:', { type: typeof token });
    return '';
  }
  if (isEncryptedToken(token)) {
    debugLog('Token is already encrypted');
    return token;
  }
  debugLog('Encrypting token...');
  return encryptToken(token);
};

// Helper function to handle token decryption
const handleTokenDecryption = (token: string): string => {
  if (!token) {
    errorLog('Empty token passed to decryption');
    return '';
  }
  if (typeof token !== 'string') {
    errorLog('Token is not a string:', { type: typeof token });
    return '';
  }
  if (!isEncryptedToken(token)) {
    debugLog('Token is not encrypted');
    return token;
  }
  try {
    debugLog('Decrypting token...');
    return decryptToken(token);
  } catch (error) {
    errorLog('Failed to decrypt token:', error);
    return '';
  }
};

export async function GET() {
  try {
    // Log environment variables (without token for security)
    const envVars: EnvVariables = {
      GITHUB_OWNER: !!process.env.GITHUB_OWNER,
      GITHUB_REPO: !!process.env.GITHUB_REPO,
      HAS_TOKEN: !!process.env.GITHUB_TOKEN,
      TOKEN_TYPE: typeof process.env.GITHUB_TOKEN
    };
    debugLog('Environment variables:', envVars);

    // First try to get config from environment variables
    const envToken = process.env.GITHUB_TOKEN || '';
    const encryptedEnvToken = envToken ? handleTokenEncryption(envToken) : '';

    const envConfig: DbConfig = {
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
      issues_per_page: 10,
      token: encryptedEnvToken
    };

    if (envConfig.owner && envConfig.repo && envConfig.token) {
      debugLog('Using environment config:', createSafeConfig(envConfig));
      // Token is already encrypted by handleTokenEncryption above
      return NextResponse.json(envConfig);
    }

    debugLog('Environment config incomplete, trying database');

    // If env config is not complete, try to get from database
    const { data } = await supabaseServer
      .from('configs')
      .select('*')
      .limit(1)
      .single();

    if (!data) {
      errorLog('No configuration found in database');
      return NextResponse.json(
        { error: 'No valid configuration found' },
        { status: 400 }
      );
    }

    // If we have a token in environment, use it instead of database token
    // If using database token, decrypt it first
    const token = envToken || handleTokenDecryption(data.token);
    if (!token) {
      errorLog('No token found in environment or database');
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 400 }
      );
    }

    // Create config with re-encrypted token (ensures consistent encryption)
    const config = {
      ...data,
      token: handleTokenEncryption(token)
    } as DbConfig;

    debugLog('Database config:', createSafeConfig(config));

    // Return config with encrypted token
    return NextResponse.json(config);
  } catch (err) {
    errorLog('Error in config route:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to fetch config' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Create config with encrypted token
    const config: DbConfig = {
      owner: body.owner,
      repo: body.repo,
      issues_per_page: body.issues_per_page || 10,
      token: handleTokenEncryption(process.env.GITHUB_TOKEN || '') // Use environment token when saving new config
    };

    const { data } = await supabaseServer
      .from('configs')
      .insert(config)
      .select()
      .single();

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to save configuration' },
        { status: 500 }
      );
    }

    // Return safe version of config (without token)
    return NextResponse.json(createSafeConfig(data));
  } catch (err) {
    errorLog('Error in config route:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to save config' },
      { status: 500 }
    );
  }
} 