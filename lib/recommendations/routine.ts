import type { ProductCategory, RoutineRecommendation, RoutineStep, ScanPreferences, SkinAnalysisResult } from '@/lib/types/skincare';

const sunscreen: RoutineStep = {
  name: 'Broad-spectrum SPF 30+',
  why: 'Daily sunscreen helps protect against UV damage and supports dark spot and anti-aging goals.',
  guidance: 'Apply generously every morning and reapply when outdoors.',
  category: 'sunscreen'
};

export function createRoutine(analysis: SkinAnalysisResult, preferences?: Partial<ScanPreferences>): RoutineRecommendation {
  const minimal = preferences?.routineLevel === 'minimal';
  const primaryGoal = preferences?.primaryGoal;
  const morning: RoutineStep[] = [
    {
      name: analysis.skinType === 'dry' ? 'Hydrating cleanser or water rinse' : 'Gentle low-pH cleanser',
      why: 'A mild cleanse removes oil and residue without stripping the skin barrier.',
      guidance: 'Massage gently for 30-60 seconds; avoid scrubs.',
      category: 'cleanser'
    },
    {
      name: analysis.skinType === 'oily' ? 'Lightweight gel moisturizer' : 'Barrier-supporting moisturizer',
      why: 'Moisturizer helps balance the skin barrier even when skin feels oily.',
      guidance: 'Use a thin layer; choose fragrance-free if sensitive.',
      category: 'moisturizer'
    },
    sunscreen
  ];

  const evening: RoutineStep[] = [
    {
      name: 'Gentle cleanser',
      why: 'Evening cleansing removes sunscreen, sweat, and pollutants.',
      guidance: 'Double cleanse only when wearing heavy sunscreen or makeup.',
      category: 'cleanser'
    },
    {
      name: chooseActive(analysis, primaryGoal),
      why: activeReason(analysis, primaryGoal),
      guidance: 'Start 2 nights per week, then increase only if comfortable.',
      category: 'active'
    },
    {
      name: analysis.skinType === 'dry' || analysis.concerns.includes('irritation') ? 'Richer moisturizer' : 'Simple moisturizer',
      why: 'Nighttime barrier support can reduce tightness and irritation.',
      guidance: 'Apply after actives; skip actives if skin stings or peels.',
      category: 'moisturizer'
    }
  ];

  const weekly: RoutineStep[] = minimal
    ? []
    : [{ name: 'Optional gentle exfoliation', why: 'Can help with dullness or uneven texture.', guidance: 'Limit to once weekly; do not combine with retinoids the same night.', category: 'exfoliant' }];

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

export function getRoutineCategories(routine: RoutineRecommendation): ProductCategory[] {
  return Array.from(new Set([...routine.morning, ...routine.evening, ...routine.weekly].map((step) => step.category)));
}
