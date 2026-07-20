export type ProductCategory = 'cleanser' | 'moisturizer' | 'sunscreen' | 'active' | 'exfoliant';

export interface ProductCatalogItem {
  id: string;
  name: string;
  description: string;
  price: string;
  link: `https://${string}`;
  category: ProductCategory;
  metadata: {
    routineCategory: ProductCategory;
  };
}

export const productCatalog = [
  {
    id: 'vanicream-gentle-facial-cleanser',
    name: 'Vanicream Gentle Facial Cleanser',
    description: 'A fragrance-free, non-comedogenic cleanser option for everyday gentle cleansing.',
    price: '$',
    link: 'https://www.vanicream.com/product/vanicream-facial-cleanser',
    category: 'cleanser',
    metadata: { routineCategory: 'cleanser' }
  },
  {
    id: 'cerave-moisturizing-cream',
    name: 'CeraVe Moisturizing Cream',
    description: 'A barrier-supporting moisturizer option with ceramides for dry or sensitive-feeling skin.',
    price: '$$',
    link: 'https://www.cerave.com/skincare/moisturizers/moisturizing-cream',
    category: 'moisturizer',
    metadata: { routineCategory: 'moisturizer' }
  },
  {
    id: 'neutrogena-clear-face-spf-50',
    name: 'Neutrogena Clear Face Sunscreen SPF 50',
    description: 'A broad-spectrum sunscreen option that is lightweight and acne-prone-skin friendly.',
    price: '$$',
    link: 'https://www.neutrogena.com/products/sun/clear-face-break-out-free-liquid-lotion-sunscreen-broad-spectrum-spf-50/6811088.html',
    category: 'sunscreen',
    metadata: { routineCategory: 'sunscreen' }
  },
  {
    id: 'the-ordinary-niacinamide-10-zinc-1',
    name: 'The Ordinary Niacinamide 10% + Zinc 1%',
    description: 'A serum option that can support the look of uneven tone, shine, and congestion.',
    price: '$',
    link: 'https://theordinary.com/en-us/niacinamide-10-zinc-1-serum-100436.html',
    category: 'active',
    metadata: { routineCategory: 'active' }
  },
  {
    id: 'paulas-choice-skin-perfecting-2-bha',
    name: "Paula's Choice Skin Perfecting 2% BHA Liquid Exfoliant",
    description: 'A once-weekly exfoliant option that can support the look of texture and clogged pores.',
    price: '$$$',
    link: 'https://www.paulaschoice.com/skin-perfecting-2pct-bha-liquid-exfoliant/201.html',
    category: 'exfoliant',
    metadata: { routineCategory: 'exfoliant' }
  }
] as const satisfies readonly ProductCatalogItem[];
