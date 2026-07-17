'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SafetyDisclaimer } from '@/components/SafetyDisclaimer';
import { getCurrentResult, saveRoutine as saveRoutineToLocalStorage } from '@/lib/storage/routines';
import type { RoutineRecommendation, SkinAnalysisResult } from '@/lib/types/skincare';

type ScanResult = { analysis: SkinAnalysisResult; routine: RoutineRecommendation };

export default function ResultsPage() {
  const [result, setResult] = useState<ScanResult>();
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const stored = getCurrentResult();
    if (stored) setResult(stored);
  }, []);

  function saveRoutine() {
    if (!result) return;
    saveRoutineToLocalStorage(result);
    setSaveMessage('Routine saved on this device.');
  }

  if (!result) {
    return <main className="mx-auto max-w-3xl px-5 py-10"><p>No scan result found.</p><Link className="text-clay underline" href="/scan">Start a scan</Link></main>;
  }

  const { analysis, routine } = result;
  const confidence = Math.round(analysis.confidence * 100);

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-5 py-6">
      <section className="rounded-3xl bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold uppercase text-sage">Your scan summary</p>
        <h1 className="mt-1 text-3xl font-bold">Your personalized routine is ready</h1>
        <p className="mt-2 text-ink/70">
          This photo suggests <strong className="font-semibold text-ink">{label(analysis.skinType)} skin</strong>
          {analysis.faceType !== 'unknown' && <> and an <strong className="font-semibold text-ink">{label(analysis.faceType)} face shape</strong></>}.
        </p>
        <p className="mt-2 text-sm text-ink/60">We had a clear read of this photo ({confidence}% confidence).</p>

        {analysis.concerns.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold text-ink">What this routine focuses on</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {analysis.concerns.map((concern) => <span className="rounded-full bg-cream px-3 py-1 text-sm" key={concern}>{label(concern)}</span>)}
            </div>
          </div>
        )}

        {analysis.notes.length > 0 && (
          <div className="mt-4 rounded-2xl bg-cream p-4">
            <h2 className="font-semibold text-ink">What we noticed</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/70">
              {analysis.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">Why this routine fits</h2>
        <p className="mt-2 text-ink/70">{routine.explanation}</p>
      </section>

      <SafetyDisclaimer />
      <RoutineSection title="Morning" steps={routine.morning} />
      <RoutineSection title="Evening" steps={routine.evening} />
      {routine.weekly.length > 0 && <RoutineSection title="Weekly optional" steps={routine.weekly} />}

      <section className="rounded-3xl bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">Introduce slowly</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/70">
          {routine.avoidOrIntroduceSlowly.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      {analysis.safetyFlags.length > 0 && (
        <section className="rounded-3xl border border-clay/20 bg-cream p-5">
          <h2 className="text-lg font-bold">Keep in mind</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/70">
            {analysis.safetyFlags.map((flag) => <li key={flag}>{flag}</li>)}
          </ul>
        </section>
      )}

      {saveMessage && <p className="rounded-xl bg-white p-3 text-sm text-sage shadow-soft" role="status">{saveMessage}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <button className="rounded-full bg-sage px-6 py-4 text-center font-semibold text-white" onClick={saveRoutine}>Save routine</button>
        <Link className="rounded-full bg-clay px-6 py-4 text-center font-semibold text-white" href="/scan">Scan again</Link>
      </div>
    </main>
  );
}

function RoutineSection({ title, steps }: { title: string; steps: RoutineRecommendation['morning'] }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-soft">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <article className="rounded-2xl bg-cream p-4" key={step.name}>
            <h3 className="font-bold">{step.name}</h3>
            <p className="mt-2 text-sm text-ink/70">{step.why}</p>
            <p className="mt-2 text-sm font-medium text-sage">{step.guidance}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function label(value: string) {
  return value.split('-').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');
}
