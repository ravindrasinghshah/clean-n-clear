import { productCatalog, type ProductCategory, type ProductRecommendation } from '@/lib/constants/products';
import type { RoutineProduct, RoutineRecommendation, RoutineStep, ScanPreferences, SkinAnalysisResult } from '@/lib/types/skincare';

const sensitivityTags = ['fragrance-free', 'gentle', 'sensitive-skin'];

const sunscreen: RoutineStep = {
  name: 'Broad-spectrum SPF 30+',
  why: 'Daily sunscreen helps protect against UV damage and supports dark spot and anti-aging goals.',
  guidance: 'Apply generously every morning and reapply when outdoors.'
};

export function createRoutine(analysis: SkinAnalysisResult, preferences?: Partial<ScanPreferences>): RoutineRecommendation {
  const minimal = preferences?.routineLevel === 'minimal';
  const primaryGoal = preferences?.primaryGoal;
  const morning: RoutineStep[] = withProducts(
    [
      {
        name: analysis.skinType === 'dry' ? 'Hydrating cleanser or water rinse' : 'Gentle low-pH cleanser',
        why: 'A mild cleanse removes oil and residue without stripping the skin barrier.',
        guidance: 'Massage gently for 30-60 seconds; avoid scrubs.'
      },
      {
        name: analysis.skinType === 'oily' ? 'Lightweight gel moisturizer' : 'Barrier-supporting moisturizer',
        why: 'Moisturizer helps balance the skin barrier even when skin feels oily.',
        guidance: 'Use a thin layer; choose fragrance-free if sensitive.'
      },
      sunscreen
    ],
    analysis,
    preferences
  );

  const evening: RoutineStep[] = withProducts(
    [
      {
        name: 'Gentle cleanser',
        why: 'Evening cleansing removes sunscreen, sweat, and pollutants.',
        guidance: 'Double cleanse only when wearing heavy sunscreen or makeup.'
      },
      {
        name: chooseActive(analysis, primaryGoal),
        why: activeReason(analysis, primaryGoal),
        guidance: 'Start 2 nights per week, then increase only if comfortable.'
      },
      {
        name: analysis.skinType === 'dry' || analysis.concerns.includes('irritation') ? 'Richer moisturizer' : 'Simple moisturizer',
        why: 'Nighttime barrier support can reduce tightness and irritation.',
        guidance: 'Apply after actives; skip actives if skin stings or peels.'
      }
    ],
    analysis,
    preferences
  );

  const weekly: RoutineStep[] = minimal
    ? []
    : withProducts([{ name: 'Optional gentle exfoliation', why: 'Can help with dullness or uneven texture.', guidance: 'Limit to once weekly; do not combine with retinoids the same night.' }], analysis, preferences);

  const avoidOrIntroduceSlowly = [
    'Avoid starting multiple actives at the same time.',
    'Avoid harsh physical scrubs and high-fragrance products if sensitive.',
    'Pause actives when skin is burning, peeling, or persistently irritated.'
  ];

  if (preferences?.sensitivities?.trim()) {
    avoidOrIntroduceSlowly.push('You noted sensitivities or allergies: check every ingredient list, avoid your known triggers, and patch test new products.');
  }

  if (preferences?.currentRoutine?.trim()) {
    avoidOrIntroduceSlowly.push('Keep any familiar products that feel comfortable, and introduce only one new product at a time.');
  }

  return {
    morning,
    evening,
    weekly,
    avoidOrIntroduceSlowly,
    explanation: `This ${preferences?.routineLevel ?? 'standard'} routine supports ${goalLabel(primaryGoal ?? analysis.concerns[0] ?? 'barrier support')} while keeping the focus on gentle, consistent care for ${analysis.skinType} skin.`,
    disclaimer: 'This is cosmetic routine guidance, not a diagnosis or medical advice. Seek a dermatologist for severe, painful, rapidly changing, or persistent symptoms.'
  };
}

function withProducts(steps: RoutineStep[], analysis: SkinAnalysisResult, preferences?: Partial<ScanPreferences>): RoutineStep[] {
  return steps.map((step) => ({ ...step, products: findProductsForStep(step, analysis, preferences) }));
}

export function findProductsForStep(step: RoutineStep, analysis: SkinAnalysisResult, preferences?: Partial<ScanPreferences>): RoutineProduct[] {
  const category = categoryForStep(step);
  const limit = productLimit(preferences?.routineLevel);
  const hasSensitivity =
    Boolean(preferences?.sensitivities?.trim()) ||
    analysis.skinType === 'sensitive' ||
    analysis.concerns.includes('irritation') ||
    analysis.concerns.includes('redness') ||
    analysis.safetyFlags.length > 0;

  return productCatalog
    .filter((product) => product.category === category)
    .filter((product) => product.skinTypes.includes(analysis.skinType) || product.skinTypes.includes('unknown'))
    .map((product, index) => ({ product, index, score: productScore(product, analysis, preferences, hasSensitivity) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ product }) => ({ name: product.name, category: product.category, tags: product.tags }));
}

function categoryForStep(step: RoutineStep): ProductCategory {
  const name = step.name.toLowerCase();
  if (name.includes('cleanser') || name.includes('rinse')) return 'cleanser';
  if (name.includes('spf') || name.includes('sunscreen')) return 'sunscreen';
  if (name.includes('moisturizer')) return 'moisturizer';
  if (name.includes('exfoliation')) return 'exfoliant';
  return 'treatment';
}

function productLimit(level?: ScanPreferences['routineLevel']): number {
  if (level === 'minimal') return 1;
  if (level === 'advanced') return 3;
  return 2;
}

function productScore(product: ProductRecommendation, analysis: SkinAnalysisResult, preferences: Partial<ScanPreferences> | undefined, hasSensitivity: boolean): number {
  let score = 0;
  if (product.skinTypes.includes(analysis.skinType)) score += 4;
  score += analysis.concerns.filter((concern) => product.concerns.includes(concern)).length * 3;
  if (preferences?.primaryGoal && product.goals.includes(preferences.primaryGoal)) score += 3;
  if (hasSensitivity) score += product.tags.filter((tag) => sensitivityTags.includes(tag)).length * 2;
  return score;
}

function chooseActive(analysis: SkinAnalysisResult, primaryGoal?: ScanPreferences['primaryGoal']): string {
  if (analysis.concerns.includes('redness') || analysis.skinType === 'sensitive') return 'Azelaic acid or niacinamide support';
  if (analysis.concerns.includes('acne-prone') || analysis.concerns.includes('congestion')) return 'Salicylic acid or adapalene-style acne support';
  if (analysis.concerns.includes('dark-spots')) return 'Niacinamide or vitamin C support';
  if (analysis.concerns.includes('fine-lines')) return 'Beginner retinoid support';
  if (primaryGoal === 'acne') return 'Salicylic acid or adapalene-style acne support';
  if (primaryGoal === 'dark-spots' || primaryGoal === 'glow') return 'Niacinamide or vitamin C support';
  if (primaryGoal === 'anti-aging') return 'Beginner retinoid support';
  if (primaryGoal === 'redness') return 'Azelaic acid or niacinamide support';
  return 'Hydrating serum with glycerin or hyaluronic acid';
}

function activeReason(analysis: SkinAnalysisResult, primaryGoal?: ScanPreferences['primaryGoal']): string {
  if (analysis.concerns.includes('redness') || analysis.skinType === 'sensitive') return 'Barrier-friendly calming actives are less likely to overwhelm reactive skin.';
  if (analysis.concerns.includes('acne-prone') || analysis.concerns.includes('congestion')) return 'Oil-soluble or retinoid-style actives may support clogged pore appearance.';
  if (analysis.concerns.includes('dark-spots')) return 'Brightening ingredients can support a more even-looking tone over time.';
  if (analysis.concerns.includes('fine-lines')) return 'Retinoid-style products may support smoother-looking texture when tolerated.';
  if (primaryGoal === 'acne') return 'This supports the appearance of congestion and breakouts while being introduced gradually.';
  if (primaryGoal === 'dark-spots' || primaryGoal === 'glow') return 'Brightening ingredients can support a more even-looking tone over time.';
  if (primaryGoal === 'anti-aging') return 'Retinoid-style products may support smoother-looking texture when tolerated.';
  if (primaryGoal === 'redness') return 'Barrier-friendly calming actives are less likely to overwhelm reactive skin.';
  return 'Hydrating ingredients improve temporary dehydration and comfort.';
}

function goalLabel(goal: string) {
  return goal.replace('-', ' ');
}
