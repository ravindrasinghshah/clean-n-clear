export function SafetyDisclaimer() {
  return (
    <div className="rounded-2xl border border-accent/20 bg-white p-4 text-sm text-ink/70 shadow-soft">
      <strong className="text-ink">Product disclosure:</strong>
      <ul className="mt-2 space-y-1 leading-5">
        <li>Product suggestions are optional, prices may change, and any links may open third-party retailers.</li>
        <li>Verify ingredient lists before buying or using anything, especially if you listed sensitivities.</li>
        <li>Recommendations are cosmetic guidance only, not medical treatment or a dermatologist replacement.</li>
        <li>If affiliate links appear, we may earn a commission at no extra cost to you.</li>
      </ul>
    </div>
  );
}
