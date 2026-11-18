// API Route para obtener sesión actual
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ session: null });
  }
}
