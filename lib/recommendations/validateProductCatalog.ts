import { productCatalog } from '@/lib/recommendations/products';
import { createRoutine, getRoutineCategories } from '@/lib/recommendations/routine';
import type { ProductCatalogItem, SkinAnalysisResult } from '@/lib/types/skincare';

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

  const routine = createRoutine(sampleAnalysis, { routineLevel: 'standard', primaryGoal: 'hydration' });
  const catalogCategories = new Set(catalog.map((product) => product.category));

  for (const category of getRoutineCategories(routine)) {
    if (!catalogCategories.has(category)) {
      errors.push(`Routine category ${category} does not have a matching catalog product.`);
    }
  }

  return errors;
}

const validationErrors = validateProductCatalog();

if (validationErrors.length > 0) {
  throw new Error(`Product catalog validation failed:\n${validationErrors.join('\n')}`);
}
