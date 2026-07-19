'use client';

import { useRef, useState } from 'react';
import { prepareImageForAnalysis } from '@/lib/images/prepareImageForAnalysis';

type FaceCaptureProps = {
  image?: string;
  onImage: (dataUrl: string) => void;
  onPreparationChange?: (isPreparing: boolean) => void;
};

export function FaceCapture({ image, onImage, onPreparationChange }: FaceCaptureProps) {
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparationError, setPreparationError] = useState('');
  const latestSelection = useRef(0);

  function setPreparing(value: boolean) {
    setIsPreparing(value);
    onPreparationChange?.(value);
  }

  async function handleFile(file?: File) {
    if (!file) return;

    const selection = ++latestSelection.current;
    setPreparing(true);
    setPreparationError('');
    // Clear the prior image so Analyze cannot submit an older, full-size photo
    // while the replacement is being resized.
    onImage('');

    try {
      const dataUrl = await prepareImageForAnalysis(file);
      if (selection === latestSelection.current) onImage(dataUrl);
    } catch (error) {
      if (selection === latestSelection.current) {
        setPreparationError(error instanceof Error ? error.message : 'This photo could not be prepared. Please choose another image.');
      }
    } finally {
      if (selection === latestSelection.current) setPreparing(false);
    }
  }

  return (
    <div className="rounded-3xl bg-white p-4 shadow-soft">
      <div className="mb-4 rounded-2xl border-2 border-dashed border-accent/30 bg-accent-soft p-6 text-center">
        {image ? (
          <div className="space-y-3">
            <img src={image} alt="Selfie preview" className="mx-auto max-h-72 rounded-2xl object-contain" />
            <p className="text-sm text-ink/70">Want a better result? You can choose a different photo below.</p>
          </div>
        ) : <p className="text-ink/70">Upload a clear, front-facing selfie in natural light.</p>}
      </div>
      <label className="sr-only" htmlFor="face-photo">Choose a selfie to analyze</label>
      <input
        id="face-photo"
        className="w-full rounded-xl border border-ink/20 bg-white p-3 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-wait disabled:opacity-60"
        type="file"
        accept="image/*"
        capture="user"
        disabled={isPreparing}
        aria-describedby="face-photo-guidance"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <p id="face-photo-guidance" className="mt-2 text-xs text-ink/60">
        {isPreparing ? 'Optimizing your photo for analysis…' : 'Choose a new image any time to replace this preview.'}
      </p>
      {preparationError && <p className="mt-2 rounded-xl border border-accent/30 bg-accent-soft p-3 text-sm text-ink" role="alert">{preparationError}</p>}
    </div>
  );
}
