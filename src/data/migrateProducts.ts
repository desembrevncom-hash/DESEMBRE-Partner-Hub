import * as fs from 'fs';
import { sections, flatProducts } from './desembreProducts';
import { PRODUCT_DEFAULTS } from './productDefaults';
import { Product, Category } from '../types/product';

const categories: Category[] = sections.map(s => ({
  id: s.title,
  name: s.title,
  nameVi: s.vi
}));

const products: Product[] = flatProducts.map(p => {
  const defaults = PRODUCT_DEFAULTS[p.no] || {};
  const variants = [];
  
  if (defaults.retail_price !== undefined || defaults.retail_size !== undefined) {
    variants.push({
      id: `${p.no}-retail`,
      type: "retail" as const,
      size: defaults.retail_size || "",
      price: defaults.retail_price || 0
    });
  }
  
  if (defaults.salon_price !== undefined || defaults.salon_size !== undefined) {
    variants.push({
      id: `${p.no}-salon`,
      type: "salon" as const,
      size: defaults.salon_size || "",
      price: defaults.salon_price || 0
    });
  }

  return {
    id: p.no,
    name: defaults.name || p.name,
    description: defaults.desc || p.desc,
    categoryId: p.section,
    imageUrl: defaults.image_url || undefined,
    linkUrl: defaults.link_url || p.link,
    variants,
    isCustom: defaults.is_custom || false,
    isDeleted: defaults.deleted || false
  };
});

const content = `
import { Category, Product } from "../types/product";

export const CATEGORIES: Category[] = ${JSON.stringify(categories, null, 2)};

export const PRODUCTS: Product[] = ${JSON.stringify(products, null, 2)};
`;

fs.writeFileSync('src/data/products.ts', content);
console.log('Successfully generated src/data/products.ts');
