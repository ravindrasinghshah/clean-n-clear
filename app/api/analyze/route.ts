import { NextResponse } from 'next/server';
import { analyzeSkinImage, parseImageDataUrl } from '@/lib/analysis/skinAnalysis';
import { createRoutine } from '@/lib/recommendations/routine';
import type { ScanPreferences } from '@/lib/types/skincare';

function elapsedSince(startedAt: number) {
  return Date.now() - startedAt;
}

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const startedAt = Date.now();
  console.info(`[analyze:${requestId}] request received`, {
    contentLength: request.headers.get('content-length') ?? 'unknown'
  });

  let body: { imageDataUrl?: string; preferences?: Partial<ScanPreferences> };
  try {
    body = (await request.json()) as { imageDataUrl?: string; preferences?: Partial<ScanPreferences> };
    console.info(`[analyze:${requestId}] request body parsed`, {
      elapsedMs: elapsedSince(startedAt),
      imageDataUrlCharacters: body.imageDataUrl?.length ?? 0
    });
  } catch {
    console.warn(`[analyze:${requestId}] request body could not be parsed`, { elapsedMs: elapsedSince(startedAt) });
    return NextResponse.json({ error: 'Please upload a selfie before starting the scan.' }, { status: 400 });
  }

  const image = typeof body.imageDataUrl === 'string' ? parseImageDataUrl(body.imageDataUrl) : null;
  if (!image) {
    console.warn(`[analyze:${requestId}] invalid image data URL`, { elapsedMs: elapsedSince(startedAt) });
    return NextResponse.json({ error: 'A selfie image is required.' }, { status: 400 });
  }

  console.info(`[analyze:${requestId}] image data URL validated`, {
    elapsedMs: elapsedSince(startedAt),
    mimeType: image.mimeType,
    imageBytes: image.byteLength
  });
  const analysisStartedAt = Date.now();
  const outcome = await analyzeSkinImage(image, requestId);
  console.info(`[analyze:${requestId}] image analysis completed`, {
    elapsedMs: elapsedSince(analysisStartedAt),
    totalElapsedMs: elapsedSince(startedAt),
    outcome: outcome.status
  });

  if (outcome.status === 'unavailable') {
    console.warn(`[analyze:${requestId}] analysis unavailable`, {
      code: outcome.code,
      httpStatus: outcome.httpStatus,
      totalElapsedMs: elapsedSince(startedAt)
    });
    return NextResponse.json(
      { status: 'unavailable', code: outcome.code, error: outcome.message },
      { status: outcome.httpStatus }
    );
  }

  if (outcome.status === 'retake') {
    console.info(`[analyze:${requestId}] returning retake guidance`, {
      confidence: outcome.confidence,
      qualityScore: outcome.imageQuality.score,
      issueCount: outcome.reasons.length,
      totalElapsedMs: elapsedSince(startedAt)
    });
    return NextResponse.json(
      {
        status: 'retake',
        code: 'IMAGE_QUALITY_INSUFFICIENT',
        error: 'We need a clearer selfie before we can create a routine.',
        confidence: outcome.confidence,
        imageQuality: outcome.imageQuality,
        reasons: outcome.reasons,
        tips: outcome.tips
      },
      { status: 422 }
    );
  }

  const routineStartedAt = Date.now();
  const routine = createRoutine(outcome.analysis, body.preferences);
  console.info(`[analyze:${requestId}] routine created`, {
    elapsedMs: elapsedSince(routineStartedAt),
    totalElapsedMs: elapsedSince(startedAt),
    morningSteps: routine.morning.length,
    eveningSteps: routine.evening.length,
    weeklySteps: routine.weekly.length
  });
  console.info(`[analyze:${requestId}] request finished`, {
    httpStatus: 200,
    outcome: 'ready',
    totalElapsedMs: elapsedSince(startedAt)
  });

  return NextResponse.json({ status: 'ready', analysis: outcome.analysis, routine });
}
