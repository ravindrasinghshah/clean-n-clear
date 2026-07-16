'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaceCapture } from '@/components/FaceCapture';
import { PreferenceForm } from '@/components/PreferenceForm';
import { saveCurrentResult } from '@/lib/storage/routines';
import type { ScanPreferences } from '@/lib/types/skincare';

const initialPreferences: ScanPreferences = { routineLevel: 'standard', primaryGoal: 'hydration', sensitivities: '', currentRoutine: '' };

export default function ScanPage() {
  const [image, setImage] = useState('');
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function analyze() {
    setLoading(true); setError('');
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageDataUrl: image, preferences }) });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) { setError(data.error ?? 'Scan failed.'); return; }
    saveCurrentResult(data);
    router.push('/results');
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-5 py-6 md:grid-cols-[1fr_0.9fr]">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Face scan</h1>
        <p className="text-ink/70">Use good lighting, center your face, and avoid filters. The MVP uploads the image only for analysis.</p>
        <FaceCapture image={image} onImage={setImage} />
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Personalize routine</h2>
        <PreferenceForm value={preferences} onChange={setPreferences} />
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={!image || loading} onClick={analyze} className="w-full rounded-full bg-clay px-6 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? 'Analyzing...' : 'Analyze and build routine'}
        </button>
      </section>
    </main>
  );
}
