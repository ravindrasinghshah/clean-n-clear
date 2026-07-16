'use client';

export function FaceCapture({ image, onImage }: { image?: string; onImage: (dataUrl: string) => void }) {
  function handleFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-3xl bg-white p-4 shadow-soft">
      <div className="mb-4 rounded-2xl border-2 border-dashed border-clay/30 bg-cream p-6 text-center">
        {image ? <img src={image} alt="Selfie preview" className="mx-auto max-h-80 rounded-2xl object-contain" /> : <p className="text-ink/70">Upload a clear, front-facing selfie in natural light.</p>}
      </div>
      <input className="w-full rounded-xl border bg-white p-3" type="file" accept="image/*" capture="user" onChange={(event) => handleFile(event.target.files?.[0])} />
    </div>
  );
}
