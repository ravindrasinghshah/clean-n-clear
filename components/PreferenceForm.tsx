'use client';

import type { ScanPreferences } from '@/lib/types/skincare';

export function PreferenceForm({ value, onChange }: { value: ScanPreferences; onChange: (value: ScanPreferences) => void }) {
  return (
    <div className="grid gap-3 rounded-3xl bg-white p-4 shadow-soft">
      <label className="grid gap-1 text-sm font-medium">Routine complexity
        <select className="rounded-xl border p-3" value={value.routineLevel} onChange={(event) => onChange({ ...value, routineLevel: event.target.value as ScanPreferences['routineLevel'] })}>
          <option value="minimal">Minimal</option><option value="standard">Standard</option><option value="advanced">Advanced</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">Primary goal
        <select className="rounded-xl border p-3" value={value.primaryGoal} onChange={(event) => onChange({ ...value, primaryGoal: event.target.value as ScanPreferences['primaryGoal'] })}>
          <option value="hydration">Hydration</option><option value="acne">Acne look</option><option value="glow">Glow</option><option value="dark-spots">Dark spots</option><option value="anti-aging">Fine lines</option><option value="redness">Redness</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">Sensitivities or allergies
        <textarea className="rounded-xl border p-3" value={value.sensitivities} onChange={(event) => onChange({ ...value, sensitivities: event.target.value })} placeholder="Fragrance, essential oils, benzoyl peroxide..." />
      </label>
      <label className="grid gap-1 text-sm font-medium">Current routine
        <textarea className="rounded-xl border p-3" value={value.currentRoutine} onChange={(event) => onChange({ ...value, currentRoutine: event.target.value })} placeholder="Cleanser, moisturizer, sunscreen..." />
      </label>
    </div>
  );
}
