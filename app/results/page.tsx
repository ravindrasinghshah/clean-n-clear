'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SafetyDisclaimer } from '@/components/SafetyDisclaimer';
import { getCurrentResult, saveRoutine as saveRoutineToLocalStorage } from '@/lib/storage/routines';
import type { RoutineRecommendation, SkinAnalysisResult } from '@/lib/types/skincare';

type ScanResult = { analysis: SkinAnalysisResult; routine: RoutineRecommendation };

export default function ResultsPage() {
  const [result, setResult] = useState<ScanResult>();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setResult(getCurrentResult() ?? undefined);
    setHasLoaded(true);
  }, []);

  function saveRoutine() {
    if (!result || hasSaved) return;

    setSaveError('');
    try {
      saveRoutineToLocalStorage(result);
      setHasSaved(true);
      setSaveMessage('Routine saved on this device.');
    } catch {
      setSaveMessage('');
      setSaveError('We could not save this routine on this device. Please try again.');
    }
  }

  if (!hasLoaded) {
    return <ResultState title="Loading your routine..." description="Getting your latest result from this device." />;
  }

  if (!result) {
    return <ResultState title="No scan result found" description="Start a new scan to build a personalized skincare routine." showScanAction />;
  }

  if (result.analysis.imageQuality?.suitableForAnalysis === false) {
    return <ResultState title="A clearer photo is needed" description="We only build routines from photos that pass the quality check. Please upload a new selfie in even light." showScanAction />;
  }

  const { analysis, routine } = result;
  const confidence = typeof analysis.confidence === 'number' ? Math.round(analysis.confidence * 100) : null;
  const photoRead = analysis.imageQuality?.suitableForAnalysis ? 'Clear' : 'Saved';
  const detectedAttributes = [
    analysis.skinType !== 'unknown' ? `${label(analysis.skinType)} skin` : null,
    analysis.faceType !== 'unknown' ? `${label(analysis.faceType)} face shape` : null,
  ].filter((attribute): attribute is string => Boolean(attribute));

  return (
    <main className="min-h-[100dvh] bg-white">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col">
        <div className="px-5 pb-44 pt-5">
          <header className="flex items-center justify-between gap-4">
            <Link className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-full border border-ink/10 px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent-soft" href="/">
              <span aria-hidden="true" className="text-base leading-none">&larr;</span>
              Home
            </Link>
            <span className="rounded-full bg-accent-soft px-3 py-2 text-xs font-bold text-ink">Routine ready</span>
          </header>

          <section className="mt-6 rounded-[2rem] bg-accent-soft p-5" aria-labelledby="results-title">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">Your scan summary</p>
            <h1 id="results-title" className="mt-3 text-[2.15rem] font-bold leading-[1.04] tracking-[-0.05em] text-ink">Your personalized routine is ready.</h1>
            <p className="mt-3 text-[0.98rem] leading-6 text-ink/70">
              {detectedAttributes.length > 0 ? (
                <>This photo suggests <strong className="font-semibold text-ink">{detectedAttributes.join(' and ')}</strong>.</>
              ) : (
                <>Your routine is based on your stated goals and the visible details in this photo.</>
              )}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/70">Photo read</p>
                <p className="mt-1 text-lg font-bold text-ink">{photoRead}</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink/70">Confidence</p>
                <p className="mt-1 text-lg font-bold text-ink">{confidence === null ? '—' : `${confidence}%`}</p>
              </div>
            </div>

            {analysis.concerns.length > 0 && (
              <div className="mt-5">
                <h2 className="text-sm font-bold text-ink">What this routine focuses on</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.concerns.map((concern) => <span className="rounded-full border border-accent/25 bg-white/80 px-3 py-1.5 text-sm font-medium text-ink" key={concern}>{label(concern)}</span>)}
                </div>
              </div>
            )}

            {analysis.notes.length > 0 && (
              <div className="mt-5 rounded-2xl border border-accent/25 bg-white/70 p-4">
                <h2 className="text-sm font-bold text-ink">What we noticed</h2>
                <ul className="mt-2 space-y-2 text-sm leading-5 text-ink/70">
                  {analysis.notes.map((note) => <li className="flex gap-2" key={note}><span aria-hidden="true" className="font-bold text-ink">&bull;</span><span>{note}</span></li>)}
                </ul>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-soft" aria-labelledby="why-title">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">The approach</p>
            <h2 id="why-title" className="mt-1 text-2xl font-bold tracking-tight text-ink">Why this routine fits</h2>
            <p className="mt-3 text-[0.98rem] leading-6 text-ink/70">{routine.explanation}</p>
          </section>

          <div className="mt-6">
            <SafetyDisclaimer />
          </div>

          <div className="mt-8 space-y-5">
            {routine.morning.length > 0 && <RoutineSection title="Morning" label="AM" steps={routine.morning} />}
            {routine.evening.length > 0 && <RoutineSection title="Evening" label="PM" steps={routine.evening} />}
            {routine.weekly.length > 0 && <RoutineSection title="Weekly optional" label="WK" steps={routine.weekly} />}
          </div>

          <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-soft" aria-labelledby="introduce-title">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">Go gently</p>
            <h2 id="introduce-title" className="mt-1 text-2xl font-bold tracking-tight text-ink">Introduce slowly</h2>
            <ul className="mt-4 space-y-3 text-sm leading-5 text-ink/70">
              {routine.avoidOrIntroduceSlowly.map((item) => <li className="flex gap-3" key={item}><span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-ink">!</span><span>{item}</span></li>)}
            </ul>
          </section>

          {analysis.safetyFlags.length > 0 && (
            <section className="mt-5 rounded-[2rem] border border-accent/25 bg-accent-soft p-5" aria-labelledby="safety-title">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">A quick reminder</p>
              <h2 id="safety-title" className="mt-1 text-2xl font-bold tracking-tight text-ink">Keep in mind</h2>
              <ul className="mt-4 space-y-3 text-sm leading-5 text-ink/70">
                {analysis.safetyFlags.map((flag) => <li className="flex gap-2" key={flag}><span aria-hidden="true" className="font-bold text-ink">&bull;</span><span>{flag}</span></li>)}
              </ul>
            </section>
          )}
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20" aria-label="Routine actions">
        <div className="mx-auto w-full max-w-[430px] border-t border-ink/10 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-3 backdrop-blur">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="min-h-[3rem] rounded-2xl bg-accent px-4 py-3 text-center text-sm font-bold text-ink shadow-soft transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60" disabled={hasSaved} onClick={saveRoutine}>
              {hasSaved ? 'Routine saved' : 'Save routine'}
            </button>
            <Link className="flex min-h-[3rem] items-center justify-center rounded-2xl border border-ink/20 px-4 py-3 text-center text-sm font-bold text-ink transition-colors hover:bg-accent-soft" href="/scan">Scan again</Link>
          </div>
          {saveMessage && <p className="mt-2 text-center text-xs font-medium text-ink/70" role="status">{saveMessage}</p>}
          {saveError && <p className="mt-2 text-center text-xs font-medium text-ink" role="alert">{saveError}</p>}
        </div>
      </footer>
    </main>
  );
}

function ResultState({ title, description, showScanAction = false }: { title: string; description: string; showScanAction?: boolean }) {
  return (
    <main className="min-h-[100dvh] bg-white">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-5 pb-10 pt-5">
        <header>
          <Link className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-full border border-ink/10 px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent-soft" href="/">
            <span aria-hidden="true" className="text-base leading-none">&larr;</span>
            Home
          </Link>
        </header>
        <section className="my-auto rounded-[2rem] bg-accent-soft p-6" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">Clean n Clear</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-3 leading-6 text-ink/70">{description}</p>
          {showScanAction && <Link className="mt-6 inline-flex min-h-[3rem] items-center justify-center rounded-2xl bg-accent px-5 py-3 font-bold text-ink shadow-soft transition-colors hover:bg-accent/80" href="/scan">Start a scan</Link>}
        </section>
      </div>
    </main>
  );
}

function RoutineSection({ title, label: sectionLabel, steps }: { title: string; label: string; steps: RoutineRecommendation['morning'] }) {
  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-soft" aria-labelledby={`${sectionLabel.toLowerCase()}-routine-title`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent text-xs font-black text-ink">{sectionLabel}</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">Your routine</p>
          <h2 id={`${sectionLabel.toLowerCase()}-routine-title`} className="mt-1 text-2xl font-bold tracking-tight text-ink">{title}</h2>
        </div>
      </div>
      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <li className="flex gap-3 rounded-[1.5rem] border border-ink/10 bg-white p-4" key={step.name}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-ink">{index + 1}</span>
            <article>
              <h3 className="font-bold text-ink">{step.name}</h3>
              <p className="mt-1 text-sm leading-5 text-ink/70">{step.why}</p>
              <p className="mt-3 text-sm font-semibold leading-5 text-ink">{step.guidance}</p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

function label(value: string) {
  return value.split('-').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');
}
