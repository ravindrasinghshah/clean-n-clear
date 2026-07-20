import { productCatalog, type ProductCatalogItem, type ProductCategory } from '@/lib/recommendations/products';
import { createRoutine } from '@/lib/recommendations/routine';
import type { RoutineStep, SkinAnalysisResult } from '@/lib/types/skincare';

const sampleAnalysis: SkinAnalysisResult = {
  skinType: 'combination',
  faceType: 'oval',
  concerns: ['dehydration', 'texture'],
  confidence: 0.9,
  imageQuality: {
    score: 0.9,
    suitableForAnalysis: true,
    issues: [],
    retakeInstructions: []
  },
  notes: [],
  safetyFlags: []
};

const routineStepCategoryMatchers = [
  { category: 'sunscreen', match: /spf|sunscreen/i },
  { category: 'exfoliant', match: /exfoliation|exfoliant/i },
  { category: 'cleanser', match: /cleanser|cleanse|rinse/i },
  { category: 'moisturizer', match: /moisturizer/i },
  { category: 'active', match: /acid|niacinamide|vitamin c|retinoid|adapalene|serum/i }
] as const satisfies readonly { category: ProductCategory; match: RegExp }[];

export function validateProductCatalog(catalog: readonly ProductCatalogItem[] = productCatalog): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const product of catalog) {
    if (!product.id) errors.push('Product is missing id.');
    if (!product.name) errors.push(`${product.id || 'Unknown product'} is missing name.`);
    if (!product.description) errors.push(`${product.id || 'Unknown product'} is missing description.`);
    if (!product.price) errors.push(`${product.id || 'Unknown product'} is missing price.`);
    if (!product.link) errors.push(`${product.id || 'Unknown product'} is missing link.`);
    if (!product.category) errors.push(`${product.id || 'Unknown product'} is missing category.`);
    if (!product.metadata?.routineCategory) errors.push(`${product.id || 'Unknown product'} is missing metadata.routineCategory.`);

    if (product.link && !product.link.startsWith('https://')) {
      errors.push(`${product.id} link must start with https://.`);
    }

    if (product.id) {
      if (ids.has(product.id)) errors.push(`${product.id} is duplicated.`);
      ids.add(product.id);
    }

    if (product.metadata?.routineCategory && product.metadata.routineCategory !== product.category) {
      errors.push(`${product.id} metadata.routineCategory must match category.`);
    }
  }

  const catalogCategories = new Set(catalog.map((product) => product.category));

  for (const category of getRoutineCategories()) {
    if (!catalogCategories.has(category)) {
      errors.push(`Routine category ${category} does not have a matching catalog product.`);
    }
  }

  return errors;
}

function getRoutineCategories(): ProductCategory[] {
  const routine = createRoutine(sampleAnalysis, { routineLevel: 'standard', primaryGoal: 'hydration' });
  const routineSteps = [...routine.morning, ...routine.evening, ...routine.weekly];
  const categories = new Set<ProductCategory>();

  for (const step of routineSteps) {
    categories.add(getRoutineStepCategory(step));
  }

  return Array.from(categories);
}

function getRoutineStepCategory(step: RoutineStep): ProductCategory {
  const matcher = routineStepCategoryMatchers.find(({ match }) => match.test(step.name));

  if (!matcher) {
    throw new Error(`Unable to match routine step "${step.name}" to a product category.`);
  }

  return matcher.category;
}

const validationErrors = validateProductCatalog();

if (validationErrors.length > 0) {
  throw new Error(`Product catalog validation failed:\n${validationErrors.join('\n')}`);
}
