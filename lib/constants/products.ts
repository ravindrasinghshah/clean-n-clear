import type { ProductRecommendation } from '@/lib/types/skincare';

export const productCatalog: ProductRecommendation[] = [
  {
    name: 'CeraVe Hydrating Facial Cleanser',
    description: 'Creamy, non-foaming cleanser for a comfortable morning or evening cleanse.',
    price: '$14–18',
    amazonUrl: 'https://www.amazon.com/s?k=CeraVe+Hydrating+Facial+Cleanser',
    skinTypes: ['dry', 'normal', 'sensitive'],
    concerns: ['dehydration', 'irritation', 'redness'],
    routineCategory: 'cleanser',
    safetyTags: ['fragrance-free', 'sensitive-skin', 'beginner-friendly']
  },
  {
    name: 'Vanicream Daily Facial Moisturizer',
    description: 'Lightweight moisturizer that layers easily with sunscreen and evening treatments.',
    price: '$12–16',
    amazonUrl: 'https://www.amazon.com/s?k=Vanicream+Daily+Facial+Moisturizer',
    skinTypes: ['dry', 'combination', 'normal', 'sensitive'],
    concerns: ['dehydration', 'irritation', 'redness'],
    routineCategory: 'moisturizer',
    safetyTags: ['fragrance-free', 'sensitive-skin', 'beginner-friendly']
  },
  {
    name: 'La Roche-Posay Anthelios Melt-In Milk Sunscreen SPF 60',
    description: 'Daily broad-spectrum sunscreen with a smooth, moisturizing finish.',
    price: '$24–38',
    amazonUrl: 'https://www.amazon.com/s?k=La+Roche-Posay+Anthelios+Melt-In+Milk+Sunscreen+SPF+60',
    skinTypes: ['dry', 'normal', 'combination', 'sensitive'],
    concerns: ['dark-spots', 'fine-lines', 'redness'],
    routineCategory: 'sunscreen',
    safetyTags: ['fragrance-free', 'sensitive-skin', 'beginner-friendly']
  },
  {
    name: 'The Ordinary Hyaluronic Acid 2% + B5',
    description: 'Hydrating serum that adds lightweight slip under moisturizer.',
    price: '$10.90',
    amazonUrl: 'https://www.amazon.com/s?k=The+Ordinary+Hyaluronic+Acid+2%25+%2B+B5',
    skinTypes: ['dry', 'combination', 'normal', 'oily', 'sensitive'],
    concerns: ['dehydration', 'texture'],
    routineCategory: 'hydrating serum',
    safetyTags: ['fragrance-free', 'beginner-friendly']
  },
  {
    name: 'Naturium Niacinamide Serum 12% Plus Zinc 2%',
    description: 'Light serum for supporting a balanced-looking complexion and refined-looking texture.',
    price: '$16–20',
    amazonUrl: 'https://www.amazon.com/s?k=Naturium+Niacinamide+Serum+12%25+Plus+Zinc+2%25',
    skinTypes: ['oily', 'combination', 'normal'],
    concerns: ['texture', 'congestion', 'dark-spots'],
    routineCategory: 'niacinamide or vitamin C support',
    safetyTags: ['fragrance-free', 'active']
  },
  {
    name: 'Paula\'s Choice 10% Azelaic Acid Booster',
    description: 'Cream-gel booster for routines focused on a calmer-looking, more even-looking tone.',
    price: '$39–42',
    amazonUrl: 'https://www.amazon.com/s?k=Paula%27s+Choice+10%25+Azelaic+Acid+Booster',
    skinTypes: ['combination', 'normal', 'oily', 'sensitive'],
    concerns: ['redness', 'dark-spots', 'texture'],
    routineCategory: 'azelaic acid or calming support',
    safetyTags: ['fragrance-free', 'sensitive-skin', 'active']
  },
  {
    name: 'The Ordinary Salicylic Acid 2% Solution',
    description: 'Targeted lightweight exfoliating serum for oily-feeling areas and congested-looking pores.',
    price: '$7–10',
    amazonUrl: 'https://www.amazon.com/s?k=The+Ordinary+Salicylic+Acid+2%25+Solution',
    skinTypes: ['oily', 'combination'],
    concerns: ['acne-prone', 'congestion', 'texture'],
    routineCategory: 'salicylic acid or acne support',
    safetyTags: ['fragrance-free', 'active']
  },
  {
    name: 'CeraVe Resurfacing Retinol Serum',
    description: 'Beginner-friendly retinol serum for gradually supporting smoother-looking texture.',
    price: '$16–22',
    amazonUrl: 'https://www.amazon.com/s?k=CeraVe+Resurfacing+Retinol+Serum',
    skinTypes: ['oily', 'combination', 'normal'],
    concerns: ['texture', 'fine-lines', 'dark-spots'],
    routineCategory: 'beginner retinoid support',
    safetyTags: ['fragrance-free', 'beginner-friendly', 'active']
  },
  {
    name: 'The Ordinary Lactic Acid 5% + HA',
    description: 'Mild exfoliating serum for occasional use in routines targeting dullness or uneven texture.',
    price: '$8–10',
    amazonUrl: 'https://www.amazon.com/s?k=The+Ordinary+Lactic+Acid+5%25+%2B+HA',
    skinTypes: ['dry', 'normal', 'combination'],
    concerns: ['texture', 'dark-spots'],
    routineCategory: 'gentle exfoliation',
    safetyTags: ['fragrance-free', 'active']
  }
];
