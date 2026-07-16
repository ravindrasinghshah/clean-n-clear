'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { SafetyDisclaimer } from '@/components/SafetyDisclaimer';
import type { RoutineRecommendation, SkinAnalysisResult } from '@/lib/types/skincare';

export default function ResultsPage() {
  const [result, setResult] = useState<{ analysis: SkinAnalysisResult; routine: RoutineRecommendation }>();
  const [saveMessage, setSaveMessage] = useState('');
  useEffect(() => {
    const stored = sessionStorage.getItem('clean-n-clear-results');
    if (stored) setResult(JSON.parse(stored));
  }, []);

  async function saveRoutine() {
    const user = auth.currentUser;
    if (!user) { setSaveMessage('Sign in as guest or with email before saving.'); return; }
    await addDoc(collection(db, 'users', user.uid, 'routines'), { ...result, createdAt: serverTimestamp() });
    setSaveMessage('Routine saved.');
  }

  if (!result) return <main className="mx-auto max-w-3xl px-5 py-10"><p>No scan result found.</p><Link className="text-clay underline" href="/scan">Start a scan</Link></main>;

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-5 py-6">
      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold uppercase text-sage">Analysis summary</p>
        <h1 className="text-3xl font-bold">{result.analysis.skinType} skin · {result.analysis.faceType} face</h1>
        <p className="text-ink/70">Confidence: {Math.round(result.analysis.confidence * 100)}%</p>
        <div className="mt-3 flex flex-wrap gap-2">{result.analysis.concerns.map((concern) => <span className="rounded-full bg-cream px-3 py-1 text-sm" key={concern}>{concern}</span>)}</div>
      </div>
      <SafetyDisclaimer />
      <RoutineSection title="Morning" steps={result.routine.morning} />
      <RoutineSection title="Evening" steps={result.routine.evening} />
      {result.routine.weekly.length > 0 && <RoutineSection title="Weekly optional" steps={result.routine.weekly} />}
      <div className="rounded-3xl bg-white p-5 shadow-soft"><h2 className="text-xl font-bold">Introduce slowly</h2><ul className="mt-2 list-disc pl-5 text-ink/70">{result.routine.avoidOrIntroduceSlowly.map((item) => <li key={item}>{item}</li>)}</ul></div>
      {saveMessage && <p className="rounded-xl bg-white p-3 text-sm text-sage shadow-soft">{saveMessage}</p>}
      <div className="grid gap-3 sm:grid-cols-2"><button className="rounded-full bg-sage px-6 py-4 text-center font-semibold text-white" onClick={saveRoutine}>Save routine</button><Link className="rounded-full bg-clay px-6 py-4 text-center font-semibold text-white" href="/scan">Scan again</Link></div>
    </main>
  );
}

function RoutineSection({ title, steps }: { title: string; steps: RoutineRecommendation['morning'] }) {
  return <section className="rounded-3xl bg-white p-5 shadow-soft"><h2 className="text-2xl font-bold">{title}</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{steps.map((step) => <article className="rounded-2xl bg-cream p-4" key={step.name}><h3 className="font-bold">{step.name}</h3><p className="mt-2 text-sm text-ink/70">{step.why}</p><p className="mt-2 text-sm font-medium text-sage">{step.guidance}</p></article>)}</div></section>;
}
