import type { ScanPreferences, SkinConcern, SkinType } from '@/lib/types/skincare';

export type ProductCategory = 'cleanser' | 'moisturizer' | 'sunscreen' | 'treatment' | 'exfoliant';

export interface ProductRecommendation {
  name: string;
  category: ProductCategory;
  skinTypes: SkinType[];
  concerns: SkinConcern[];
  goals: ScanPreferences['primaryGoal'][];
  tags: string[];
}

export const productCatalog: ProductRecommendation[] = [
  {
    name: 'Cream-to-Foam Gentle Cleanser',
    category: 'cleanser',
    skinTypes: ['dry', 'normal', 'combination', 'sensitive', 'unknown'],
    concerns: ['dehydration', 'irritation', 'redness'],
    goals: ['hydration', 'redness', 'glow'],
    tags: ['fragrance-free', 'gentle', 'barrier-support']
  },
  {
    name: 'Low-pH Gel Cleanser',
    category: 'cleanser',
    skinTypes: ['oily', 'combination', 'normal', 'unknown'],
    concerns: ['acne-prone', 'congestion', 'texture'],
    goals: ['acne', 'glow'],
    tags: ['gentle', 'non-comedogenic']
  },
  {
    name: 'Barrier Repair Moisturizer',
    category: 'moisturizer',
    skinTypes: ['dry', 'normal', 'combination', 'sensitive', 'unknown'],
    concerns: ['dehydration', 'irritation', 'redness', 'fine-lines'],
    goals: ['hydration', 'redness', 'anti-aging'],
    tags: ['fragrance-free', 'gentle', 'sensitive-skin', 'ceramides']
  },
  {
    name: 'Oil-Free Gel Moisturizer',
    category: 'moisturizer',
    skinTypes: ['oily', 'combination', 'normal', 'unknown'],
    concerns: ['acne-prone', 'congestion', 'dehydration'],
    goals: ['acne', 'hydration', 'glow'],
    tags: ['lightweight', 'non-comedogenic', 'fragrance-free']
  },
  {
    name: 'Mineral SPF 30 Sensitive Sunscreen',
    category: 'sunscreen',
    skinTypes: ['dry', 'normal', 'combination', 'sensitive', 'unknown'],
    concerns: ['redness', 'irritation', 'dark-spots', 'fine-lines'],
    goals: ['redness', 'dark-spots', 'anti-aging', 'glow'],
    tags: ['fragrance-free', 'gentle', 'sensitive-skin', 'mineral']
  },
  {
    name: 'Lightweight Daily SPF 50 Gel',
    category: 'sunscreen',
    skinTypes: ['oily', 'combination', 'normal', 'unknown'],
    concerns: ['acne-prone', 'congestion', 'dark-spots', 'fine-lines'],
    goals: ['acne', 'dark-spots', 'anti-aging', 'glow'],
    tags: ['lightweight', 'non-comedogenic']
  },
  {
    name: 'Niacinamide Brightening Serum',
    category: 'treatment',
    skinTypes: ['oily', 'dry', 'combination', 'normal', 'sensitive', 'unknown'],
    concerns: ['dark-spots', 'redness', 'texture', 'congestion'],
    goals: ['dark-spots', 'glow', 'redness'],
    tags: ['fragrance-free', 'gentle']
  },
  {
    name: 'Beginner Retinoid Cream',
    category: 'treatment',
    skinTypes: ['oily', 'dry', 'combination', 'normal', 'unknown'],
    concerns: ['fine-lines', 'texture', 'congestion', 'acne-prone'],
    goals: ['anti-aging', 'acne', 'glow'],
    tags: ['start-slowly']
  },
  {
    name: 'Azelaic Acid Calming Gel',
    category: 'treatment',
    skinTypes: ['oily', 'dry', 'combination', 'normal', 'sensitive', 'unknown'],
    concerns: ['redness', 'acne-prone', 'dark-spots', 'irritation'],
    goals: ['redness', 'acne', 'dark-spots'],
    tags: ['fragrance-free', 'sensitive-skin']
  },
  {
    name: 'Hydrating Hyaluronic Serum',
    category: 'treatment',
    skinTypes: ['dry', 'normal', 'combination', 'sensitive', 'unknown'],
    concerns: ['dehydration', 'fine-lines', 'irritation'],
    goals: ['hydration', 'glow', 'anti-aging'],
    tags: ['fragrance-free', 'gentle', 'sensitive-skin']
  },
  {
    name: 'PHA Gentle Exfoliating Toner',
    category: 'exfoliant',
    skinTypes: ['dry', 'normal', 'combination', 'sensitive', 'unknown'],
    concerns: ['texture', 'dark-spots', 'dehydration'],
    goals: ['glow', 'dark-spots'],
    tags: ['gentle', 'sensitive-skin']
  },
  {
    name: 'BHA Clarifying Exfoliant',
    category: 'exfoliant',
    skinTypes: ['oily', 'combination', 'normal', 'unknown'],
    concerns: ['acne-prone', 'congestion', 'texture'],
    goals: ['acne', 'glow'],
    tags: ['start-slowly']
  }
];
