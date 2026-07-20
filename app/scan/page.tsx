'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaceCapture } from '@/components/FaceCapture';
import { PreferenceForm } from '@/components/PreferenceForm';
import { saveCurrentResult } from '@/lib/storage/routines';
import type { ImageQualityAssessment, ImageQualityIssue, RoutineRecommendation, ScanPreferences, SkinAnalysisResult } from '@/lib/types/skincare';

const initialPreferences: ScanPreferences = { routineLevel: 'standard', primaryGoal: 'hydration', sensitivities: '', currentRoutine: '' };
const minimumConfidence = 0.7;

type AnalyzeResponse = {
  status?: 'ready' | 'retake';
  analysis?: SkinAnalysisResult;
  routine?: RoutineRecommendation;
  error?: string;
  code?: string;
  imageQuality?: ImageQualityAssessment;
  confidence?: number;
  reasons?: ImageQualityIssue[];
  tips?: string[];
};

type RetakeFeedback = {
  confidence?: number;
  imageQuality?: ImageQualityAssessment;
  reasons?: ImageQualityIssue[];
  tips?: string[];
};

const defaultRetakeInstructions = [
  'Use bright, even natural light. Face a window rather than standing with it behind you.',
  'Hold the camera at eye level and look straight ahead with your full face centered in frame.',
  'Remove filters, sunglasses, masks, and anything that covers your skin.',
];

export default function ScanPage() {
  const [image, setImage] = useState('');
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [error, setError] = useState('');
  const [retakeFeedback, setRetakeFeedback] = useState<RetakeFeedback>();
  const router = useRouter();
  const actionDisabled = !image || loading || preparingImage || Boolean(retakeFeedback);
  const actionLabel = preparingImage
    ? 'Preparing photo...'
    : loading
      ? 'Checking photo and building routine...'
      : retakeFeedback
        ? 'Upload a new photo to continue'
        : 'Analyze and build routine';
  const actionHint = preparingImage
    ? 'Preparing your image before analysis.'
    : loading
      ? 'This can take a moment.'
      : retakeFeedback
        ? 'Choose a clearer selfie above to continue.'
        : !image
          ? 'Add a selfie to continue.'
          : 'We check photo quality before generating guidance.';

  function handleImageChange(dataUrl: string) {
    setImage(dataUrl);
    setError('');
    setRetakeFeedback(undefined);
  }

  async function analyze() {
    if (!image || loading || preparingImage || retakeFeedback) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: image, preferences }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      const imageQuality = data.imageQuality ?? data.analysis?.imageQuality;
      const confidence = data.analysis?.confidence ?? data.confidence;
      const needsRetake = data.status === 'retake'
        || imageQuality?.suitableForAnalysis === false
        || (typeof confidence === 'number' && confidence < minimumConfidence);

      if (response.status === 422 && (data.status === 'retake' || data.code === 'IMAGE_QUALITY_INSUFFICIENT' || imageQuality)) {
        setRetakeFeedback({ imageQuality, confidence, reasons: data.reasons, tips: data.tips });
        return;
      }

      if (!response.ok) {
        setError(data.error ?? 'Scan failed. Please try again.');
        return;
      }

      if (needsRetake) {
        setRetakeFeedback({ imageQuality, confidence, reasons: data.reasons, tips: data.tips });
        return;
      }

      if (!data.analysis || !data.routine) {
        setError('We could not read this scan. Please upload another photo and try again.');
        return;
      }

      saveCurrentResult({ analysis: data.analysis, routine: data.routine, imageDataUrl: image });
      router.push('/results');
    } catch {
      setError('We could not reach the analysis service. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-white">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col">
        <div className="px-5 pb-36 pt-5">
          <header className="flex items-center justify-between gap-4">
            <Link className="inline-flex items-center gap-2 rounded-full border border-ink/10 px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent-soft" href="/">
              <span aria-hidden="true" className="text-base leading-none">&larr;</span>
              Home
            </Link>
            <span className="rounded-full bg-accent-soft px-3 py-2 text-xs font-bold text-ink">Step 1 of 2</span>
          </header>

          <section className="mt-6 rounded-[2rem] bg-accent-soft p-5" aria-labelledby="scan-title">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">Build your routine</p>
            <h1 id="scan-title" className="mt-3 text-[2.15rem] font-bold leading-[1.04] tracking-[-0.05em] text-ink">Let&apos;s start with a clear selfie.</h1>
            <p className="mt-3 max-w-[33ch] text-[0.98rem] leading-6 text-ink/70">We only build a routine when we can clearly read the photo, so you can trust the next steps.</p>
            <div className="mt-5 flex gap-2" role="img" aria-label="Step 1 of 2">
              <span className="h-1.5 flex-1 rounded-full bg-accent" />
              <span className="h-1.5 flex-1 rounded-full bg-white/80" />
            </div>
          </section>

          <section className="mt-8" aria-labelledby="photo-title">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-ink">1</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/70">Your photo</p>
                <h2 id="photo-title" className="mt-1 text-2xl font-bold tracking-tight text-ink">Add a selfie</h2>
                <p className="mt-1 text-sm leading-5 text-ink/70">A front-facing photo in even light gives the most useful result.</p>
              </div>
            </div>

            <div className="mt-4">
              <FaceCapture image={image} onImage={handleImageChange} onPreparationChange={setPreparingImage} />
            </div>

            <aside className="mt-4 rounded-[1.5rem] border border-accent/25 bg-accent-soft p-4" aria-labelledby="photo-tips-title">
              <h3 id="photo-tips-title" className="text-sm font-bold text-ink">For the clearest scan</h3>
              <ul className="mt-3 space-y-2 text-sm leading-5 text-ink/70">
                <li className="flex gap-2"><span aria-hidden="true" className="mt-0.5 font-bold text-ink">•</span><span>Use bright, even daylight and avoid strong shadows or backlighting.</span></li>
                <li className="flex gap-2"><span aria-hidden="true" className="mt-0.5 font-bold text-ink">•</span><span>Keep your full face centered, at eye level, and looking straight at the camera.</span></li>
                <li className="flex gap-2"><span aria-hidden="true" className="mt-0.5 font-bold text-ink">•</span><span>Skip filters and remove anything that hides your skin.</span></li>
              </ul>
            </aside>
          </section>

          <section className="mt-8" aria-labelledby="preferences-title">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/20 bg-white text-sm font-bold text-ink">2</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/70">Your preferences</p>
                <h2 id="preferences-title" className="mt-1 text-2xl font-bold tracking-tight text-ink">Make it yours</h2>
                <p className="mt-1 text-sm leading-5 text-ink/70">Choose the type of routine and goals you want to focus on.</p>
              </div>
            </div>

            <div className="mt-4">
              <PreferenceForm value={preferences} onChange={setPreferences} />
            </div>
          </section>

          <div className="mt-6 space-y-4">
            {retakeFeedback && <RetakeGuidance feedback={retakeFeedback} />}
            {error && <p className="rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm text-ink" role="alert">{error}</p>}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto w-full max-w-[430px] border-t border-ink/10 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-3 backdrop-blur">
          <button type="button" disabled={actionDisabled} onClick={analyze} className="w-full rounded-2xl bg-accent px-6 py-4 font-bold text-ink shadow-soft transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50">
            {actionLabel}
          </button>
          <p className="mt-2 text-center text-xs font-medium text-ink/70">{actionHint}</p>
          <p className="sr-only" role="status" aria-live="polite">{actionHint}</p>
        </div>
      </div>
    </main>
  );
}

function RetakeGuidance({ feedback }: { feedback: RetakeFeedback }) {
  const requestedInstructions = feedback.tips?.filter(Boolean) ?? feedback.imageQuality?.retakeInstructions?.filter(Boolean);
  const instructions = requestedInstructions?.length ? requestedInstructions : defaultRetakeInstructions;
  const issues = feedback.reasons?.filter(Boolean) ?? feedback.imageQuality?.issues?.filter(Boolean) ?? [];
  const confidence = typeof feedback.confidence === 'number' ? Math.round(feedback.confidence * 100) : undefined;

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent-soft p-4" role="status" aria-live="polite">
      <p className="text-sm font-semibold uppercase tracking-wide text-ink">A clearer photo is needed</p>
      <h3 className="mt-1 text-xl font-bold">Let&apos;s retake this before building your routine.</h3>
      <p className="mt-2 text-sm text-ink/70">
        We only create recommendations from photos we can read confidently. Upload a new selfie using the tips below.
        {confidence !== undefined && ` This scan was ${confidence}% confident; we need at least ${Math.round(minimumConfidence * 100)}%.`}
      </p>
      {issues.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-ink">What made this photo difficult to read</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/70">{issues.map((issue) => <li key={issue}>{qualityIssueMessage(issue)}</li>)}</ul>
        </div>
      )}
      <div className="mt-3">
        <p className="text-sm font-semibold text-ink">For your next photo</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/70">{instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ul>
      </div>
    </section>
  );
}

function qualityIssueMessage(issue: ImageQualityIssue) {
  const messages: Record<ImageQualityIssue, string> = {
    'face-not-visible': 'Your full face was not clearly visible.',
    'face-too-small': 'Your face was too small in the frame.',
    'face-not-front-facing': 'Your face was not looking straight toward the camera.',
    'too-dark': 'The photo was too dark to read your skin clearly.',
    'too-bright': 'Bright light washed out some skin detail.',
    blurry: 'The photo was too blurry to read fine skin detail.',
    obstructed: 'Something was covering part of your face.',
    'multiple-faces': 'More than one face appeared in the photo.',
    'low-resolution': 'The photo did not have enough detail at this size.',
    'insufficient-detail': 'There was not enough visible skin detail in this photo.',
  };

  return messages[issue];
}
