import Link from 'next/link';
import { RegionBanner } from '@/components/RegionBanner';
import { SafetyDisclaimer } from '@/components/SafetyDisclaimer';

export default function HomePage() {
  return (
    <main>
      <RegionBanner />
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-5 py-8 md:grid md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="space-y-6">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-sage shadow-soft">AI-assisted skincare MVP</span>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Scan your face. Get a safer skincare routine.</h1>
          <p className="text-lg text-ink/70">Clean n Clear uses Gemini image analysis, rule-based safety constraints, and plain-language explanations to curate routine steps for your skin type, face type, and goals.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="rounded-full bg-clay px-6 py-4 text-center font-semibold text-white shadow-soft" href="/scan">Start face scan</Link>
          </div>
          <SafetyDisclaimer />
        </div>
        <div className="rounded-[2rem] bg-white p-5 shadow-soft">
          <div className="rounded-[1.5rem] bg-gradient-to-br from-clay/20 to-sage/20 p-6">
            <h2 className="mb-4 text-2xl font-bold">MVP flow</h2>
            <ol className="space-y-4 text-ink/75">
              <li>1. Upload a selfie from mobile or desktop.</li>
              <li>2. Add goals like hydration, redness, or dark spots.</li>
              <li>3. Receive AM, PM, and weekly routine steps.</li>
              <li>4. Save results privately on this device.</li>
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}
