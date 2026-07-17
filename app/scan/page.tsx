'use client';

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

      saveCurrentResult({ analysis: data.analysis, routine: data.routine });
      router.push('/results');
    } catch {
      setError('We could not reach the analysis service. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-5 py-6 md:grid-cols-[1fr_0.9fr]">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Face scan</h1>
        <p className="text-ink/70">A clear, front-facing photo helps us create a routine that is more useful and easier to trust.</p>
        <FaceCapture image={image} onImage={handleImageChange} onPreparationChange={setPreparingImage} />
        <section className="rounded-2xl border border-accent/20 bg-white p-4 text-sm text-ink/70">
          <h2 className="font-semibold text-ink">For the clearest scan</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Use bright, even daylight and avoid strong shadows or backlighting.</li>
            <li>Keep your full face centered, at eye level, and looking straight at the camera.</li>
            <li>Skip filters and remove anything that hides your skin.</li>
          </ul>
        </section>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Personalize routine</h2>
        <PreferenceForm value={preferences} onChange={setPreferences} />
        {retakeFeedback && <RetakeGuidance feedback={retakeFeedback} />}
        {error && <p className="rounded-xl border border-accent/30 bg-accent-soft p-3 text-sm text-ink">{error}</p>}
        <button disabled={!image || loading || preparingImage || Boolean(retakeFeedback)} onClick={analyze} className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-ink transition-colors hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-50">
          {preparingImage ? 'Preparing photo...' : loading ? 'Checking photo and building routine...' : retakeFeedback ? 'Upload a new photo to continue' : 'Analyze and build routine'}
        </button>
      </section>
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
