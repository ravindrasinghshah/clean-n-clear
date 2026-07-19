'use client';

import { useState } from 'react';

export function RegionBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-accent px-4 py-3 text-sm text-ink">
      <p>Clean n Clear is currently designed for US cosmetic skincare guidance only.</p>
      <button className="rounded-full bg-white/60 px-3 py-1 text-ink transition-colors hover:bg-white" onClick={() => setVisible(false)}>Dismiss</button>
    </div>
  );
}
