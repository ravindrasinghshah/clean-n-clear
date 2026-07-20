import Link from "next/link";
import { RegionBanner } from "@/components/RegionBanner";
import { SafetyDisclaimer } from "@/components/SafetyDisclaimer";

const steps = [
  {
    title: "Take a clear selfie",
    description: "Use even light and keep your face centered.",
  },
  {
    title: "Tell us your goal",
    description: "Choose what you want your routine to focus on.",
  },
  {
    title: "Get your next steps",
    description: "Receive an easy AM, PM, and weekly routine.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] bg-white">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col">
        <RegionBanner />
        <div className="flex flex-1 flex-col px-5 pb-36 pt-5">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-lg font-black text-ink shadow-soft"
                aria-hidden="true"
              >
                C
              </div>
              <div>
                <p className="text-base font-bold leading-none tracking-tight">
                  Clean n Clear
                </p>
                <p className="mt-1 text-xs font-medium text-ink/70">
                  Your skin routine
                </p>
              </div>
            </div>
            <span className="rounded-full bg-accent-soft px-3 py-2 text-xs font-semibold text-ink">
              Private by design
            </span>
          </header>

          <section
            className="mt-7 rounded-[2rem] bg-accent-soft p-5"
            aria-labelledby="hero-title"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">
              Personalized skincare
            </p>
            <h1
              id="hero-title"
              className="mt-3 text-[2.35rem] font-bold leading-[1.02] tracking-[-0.055em] text-ink"
            >
              A clearer routine starts with one selfie.
            </h1>
            <p className="mt-4 max-w-[32ch] text-[0.98rem] leading-6 text-ink/70">
              Get simple skincare steps based on what is visibly present in a
              clear photo and the goals you choose.
            </p>

            <div className="relative mt-6 overflow-hidden rounded-[1.5rem] border border-accent/25 bg-white/80 p-4">
              <div
                className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-accent/20 blur-2xl"
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-4">
                <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-[1.45rem] border border-accent/30 bg-accent-soft">
                  <span className="absolute left-2 top-2 h-3 w-3 rounded-tl-md border-l-2 border-t-2 border-accent" />
                  <span className="absolute right-2 top-2 h-3 w-3 rounded-tr-md border-r-2 border-t-2 border-accent" />
                  <span className="absolute bottom-2 left-2 h-3 w-3 rounded-bl-md border-b-2 border-l-2 border-accent" />
                  <span className="absolute bottom-2 right-2 h-3 w-3 rounded-br-md border-b-2 border-r-2 border-accent" />
                  <div
                    className="h-10 w-8 rounded-[45%] border border-accent/50 bg-white/80"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">
                    Photo quality comes first
                  </p>
                  <p className="mt-1 text-sm leading-5 text-ink/70">
                    We pause and guide you to retake it if the light, angle, or
                    focus is not clear enough.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-7" aria-labelledby="how-it-works-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">
                  Three easy steps
                </p>
                <h2
                  id="how-it-works-title"
                  className="mt-1 text-xl font-bold tracking-tight text-ink"
                >
                  How it works
                </h2>
              </div>
              <span className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold text-ink/70">
                About 1 minute
              </span>
            </div>

            <ol className="mt-4 divide-y divide-ink/10 rounded-[1.5rem] border border-ink/10 bg-white px-4 shadow-[0_12px_32px_rgba(7,16,19,0.07)]">
              {steps.map((step, index) => (
                <li
                  className="flex gap-4 py-4 first:pt-4 last:pb-4"
                  key={step.title}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-ink">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-ink">{step.title}</h3>
                    <p className="mt-1 text-sm leading-5 text-ink/70">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-6">
            <SafetyDisclaimer />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto w-full max-w-[430px] border-t border-ink/10 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-3 backdrop-blur">
          <Link
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-center font-bold text-ink shadow-soft transition-transform transition-colors hover:bg-accent/80 focus-visible:scale-[0.98] active:scale-[0.98]"
            href="/scan"
          >
            Start face scan
            <span aria-hidden="true" className="text-lg leading-none">
              &rarr;
            </span>
          </Link>
          <p className="mt-2 text-center text-xs font-medium text-ink/70">
            No account required
          </p>
        </div>
      </div>
    </main>
  );
}
