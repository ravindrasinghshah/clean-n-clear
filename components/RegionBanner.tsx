'use client';

import { useState } from 'react';

export function RegionBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="flex items-center justify-between gap-3 bg-sage px-4 py-3 text-sm text-white">
      <p>Clean n Clear is currently designed for US cosmetic skincare guidance only.</p>
      <button className="rounded-full bg-white/20 px-3 py-1" onClick={() => setVisible(false)}>Dismiss</button>
    </div>
  );
}
