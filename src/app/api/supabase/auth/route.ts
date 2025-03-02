import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { encryptPassword, decryptPassword, isEncryptedPassword } from '@/lib/encryption';
import { debugLog, errorLog } from '@/lib/debug';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return NextResponse.json(
        { error: 'Missing password' },
        { status: 400 }
      );
    }

    // First try to get password from environment variable
    const envPassword = process.env.PASSWORD;
    if (envPassword) {
      debugLog('Using environment password for verification');
      const isValid = password === envPassword;
      return NextResponse.json({ isValid });
    }

    // If no environment password, try database
    debugLog('No environment password, checking database');
    const { data, error } = await supabaseServer
      .from('configs')
      .select('password')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      errorLog('Error fetching password from database:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data?.password) {
      errorLog('No password found in database');
      return NextResponse.json({ isValid: false });
    }

    // Check if the stored password is encrypted
    if (isEncryptedPassword(data.password)) {
      debugLog('Stored password is encrypted, decrypting for comparison');
      try {
        const decryptedPassword = decryptPassword(data.password);
        const isValid = password === decryptedPassword;
        return NextResponse.json({ isValid });
      } catch (error) {
        errorLog('Error decrypting password:', error);
        return NextResponse.json(
          { error: 'Failed to verify password' },
          { status: 500 }
        );
      }
    } else {
      // For backward compatibility, if the stored password is not encrypted
      debugLog('Stored password is not encrypted, using direct comparison');
      const isValid = password === data.password;
      return NextResponse.json({ isValid });
    }
  } catch (error) {
    errorLog('Error verifying password:', error);
    return NextResponse.json(
      { error: 'Failed to verify password' },
      { status: 500 }
    );
  }
} 