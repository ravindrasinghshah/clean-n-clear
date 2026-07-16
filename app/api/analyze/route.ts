import { NextResponse } from 'next/server';
import { analyzeSkinImage } from '@/lib/analysis/skinAnalysis';
import { createRoutine } from '@/lib/recommendations/routine';
import type { ScanPreferences } from '@/lib/types/skincare';

export async function POST(request: Request) {
  const body = (await request.json()) as { imageDataUrl?: string; preferences?: Partial<ScanPreferences> };

  if (!body.imageDataUrl?.startsWith('data:image/')) {
    return NextResponse.json({ error: 'A selfie image is required.' }, { status: 400 });
  }

  const analysis = await analyzeSkinImage(body.imageDataUrl);
  const routine = createRoutine(analysis, body.preferences);

  return NextResponse.json({ analysis, routine });
}
