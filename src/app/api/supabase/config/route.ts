import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { PostgrestError } from '@supabase/supabase-js';

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('configs')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || 'Failed to fetch config' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabaseServer
      .from('configs')
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || 'Failed to save config' },
      { status: 500 }
    );
  }
} 