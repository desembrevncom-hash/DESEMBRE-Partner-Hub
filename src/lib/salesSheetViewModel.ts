import {
  dedupeIngredientItems,
  cleanSalesSheetTemplateHtml,
  isTemplateV2,
} from "./salesSheetVersionUtils";
import { buildPublicProductProfile } from "./publicProductProfile";
import { renderSalesSheetHtml } from "./renderSalesSheetHtml";

export interface SalesSheetViewModel {
  product: {
    name: string;
    brand_name: string;
    category_name: string;
    short_description: string;
    image_url: string;
  };
  variants: Array<{
    channel: string;
    size_label: string;
    price: string;
  }>;
  benefits: string[];
  ingredients: string[]; // Unified single-source ingredient list for "THÀNH PHẦN CHÍNH & CHỨC NĂNG"
  full_ingredients: string; // Only in internal mode
  skin_types: string[];
  usageInstructions: string[];
  warnings: string[];
  sales_notes: string[]; // Only in internal mode
  footer_note: string;
  generated_at: string;
  audience: "customer" | "internal";
  hideBrandLogo: boolean;
  __debugSource?: string;
}

export interface BuildSalesSheetViewModelInput {
  sheetData?: {
    product?: {
      name?: string;
      brand_name?: string;
      category_name?: string;
      short_description?: string;
      image_url?: string;
    };
    pricing?: {
      retail?: Array<{ sku: string; size_label: string; price: string }>;
      salon?: Array<{ sku: string; size_label: string; price: string }>;
    };
    knowledge?: {
      benefits?: string[] | string;
      ingredient_highlights?: string[] | string;
      full_ingredients?: string;
      key_ingredients?: string[] | string;
      canonical_ingredients?: string[] | string;
      key_ingredients_functions?: unknown;
      ingredients_with_functions?: string[] | string;
      skin_types?: string[] | string;
      usage?: string[] | string;
      usage_instructions?: string[] | string;
      sales_notes?: string[] | string;
      warnings?: string[] | string;
    };
    footer_note?: string;
  } | null | undefined;
  profile?: Record<string, unknown> | null | undefined;
  fallbackProductInfo?: {
    productName?: string;
    categoryName?: string;
    imageUrl?: string;
    brandName?: string;
  };
  audience?: "customer" | "internal";
  templateName?: string;
  templateHtml?: string;
}

function normalizeStringList(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0 && item !== "Chưa có thông tin trong tài liệu nguồn.");
  }
  if (typeof val === "string" && val.trim() && val.trim() !== "Chưa có thông tin trong tài liệu nguồn.") {
    return val
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•\d.]+\s*/, "").trim())
      .filter((line) => line.length > 0 && line !== "Chưa có thông tin trong tài liệu nguồn.");
  }
  return [];
}

/**
 * Selects ingredient items strictly from a SINGLE source based on priority order:
 * 1. sheetData canonical ingredients / key ingredients
 * 2. sheetData ingredients with functions
 * 3. sheetData ingredient highlights
 * 4. fallback profile ingredient_highlights
 */
function pickSingleIngredientSource(
  knowledge: Record<string, unknown> | undefined,
  profile: Record<string, unknown> | undefined,
): string[] {
  if (knowledge) {
    // 1. Canonical sources from sheetData
    const canonicalSources = [
      knowledge.canonical_ingredients,
      knowledge.canonicalIngredients,
      knowledge.key_ingredients_functions,
      knowledge.keyIngredientsFunctions,
      knowledge.key_ingredients,
      knowledge.keyIngredients,
      knowledge.main_ingredients,
      knowledge.mainIngredients,
  ];

    for (const src of canonicalSources) {
      const items = dedupeIngredientItems(src);
      if (items.length > 0) return items;
    }

    // 2. Ingredients with functions from sheetData
    const functionSources = [
      knowledge.ingredients_with_functions,
      knowledge.ingredientsWithFunctions,
    ];

    for (const src of functionSources) {
      const items = dedupeIngredientItems(src);
      if (items.length > 0) return items;
    }

    // 3. Ingredient highlights from sheetData
    const highlightSources = [
      knowledge.ingredient_highlights,
      knowledge.ingredientHighlights,
    ];

    for (const src of highlightSources) {
      const items = dedupeIngredientItems(src);
      if (items.length > 0) return items;
    }
  }

  // 4. Fallback to profile
  if (profile) {
    const profileProfile = buildPublicProductProfile(profile);
    if (profileProfile.ingredient_highlights && profileProfile.ingredient_highlights.length > 0) {
      return dedupeIngredientItems(profileProfile.ingredient_highlights);
    }
  }

  return [];
}

/**
 * Single source of truth for building Sales Sheet View Model across Preview & PDF export.
 */
export function buildSalesSheetViewModel(input: BuildSalesSheetViewModelInput): SalesSheetViewModel {
  const audience = input.audience || "customer";
  const isCustomer = audience === "customer";

  const sheetData = input.sheetData || {};
  const sheetProd = sheetData.product || {};
  const sheetKnow = (sheetData.knowledge || {}) as Record<string, unknown>;
  const sheetPricing = sheetData.pricing || { retail: [], salon: [] };

  const fallback = input.fallbackProductInfo || {};
  const profileRecord = input.profile || {};
  const profileProfile = profileRecord ? buildPublicProductProfile(profileRecord) : null;

  // Determine debug source tag
  let debugSource = "sheetData";
  if (!sheetData.knowledge && profileProfile) {
    debugSource = "profile_fallback";
  }

  // 1. Product Name
  const productName =
    sheetProd.name ||
    fallback.productName ||
    profileProfile?.name ||
    "Sản phẩm";

  // 2. Brand Name
  const brandName =
    sheetProd.brand_name ||
    fallback.brandName ||
    profileProfile?.brand_name ||
    "Desembre";

  // 3. Category Name
  const categoryName =
    sheetProd.category_name ||
    fallback.categoryName ||
    profileProfile?.category_name ||
    "Chưa rõ";

  // 4. Short Description
  let shortDescription =
    sheetProd.short_description ||
    profileProfile?.short_description ||
    "";
  if (shortDescription === "Chưa có thông tin trong tài liệu nguồn.") {
    shortDescription = "";
  }

  // 5. Image URL
  const imageUrl =
    sheetProd.image_url ||
    fallback.imageUrl ||
    profileProfile?.image_url ||
    "";

  // 6. Pricing Variants
  const retailList = sheetPricing.retail || [];
  const salonList = sheetPricing.salon || [];
  const variants = [
    ...retailList.map((v) => ({ ...v, channel: "retail" })),
    ...salonList.map((v) => ({ ...v, channel: "salon" })),
  ];

  // 7. Benefits
  let benefits = normalizeStringList(sheetKnow.benefits);
  if (benefits.length === 0 && profileProfile?.benefits) {
    benefits = normalizeStringList(profileProfile.benefits);
  }

  // 8. Single-Source Ingredients
  const ingredients = pickSingleIngredientSource(sheetKnow, profileRecord);

  // 9. Full Ingredients (Internal mode only)
  let fullIngredients = "";
  if (!isCustomer) {
    if (typeof sheetKnow.full_ingredients === "string" && sheetKnow.full_ingredients.trim()) {
      fullIngredients = sheetKnow.full_ingredients.trim();
    }
  }

  // 10. Skin Types
  let skinTypes = normalizeStringList(sheetKnow.skin_types);
  if (skinTypes.length === 0 && profileProfile?.skin_types) {
    skinTypes = profileProfile.skin_types;
  }

  // 11. Usage Instructions
  let usageInstructions = normalizeStringList(
    sheetKnow.usage ?? sheetKnow.usage_instructions,
  );
  if (usageInstructions.length === 0 && profileProfile?.usage_instructions) {
    usageInstructions = normalizeStringList(profileProfile.usage_instructions);
  }

  // 12. Warnings / Contraindications
  let warnings = normalizeStringList(sheetKnow.warnings);
  if (warnings.length === 0 && profileProfile?.warnings) {
    warnings = normalizeStringList(profileProfile.warnings);
  }

  // 13. Sales Notes (Internal mode only)
  let salesNotes: string[] = [];
  if (!isCustomer) {
    salesNotes = normalizeStringList(sheetKnow.sales_notes);
  }

  // 14. Footer Note
  const footerNote =
    sheetData.footer_note && !sheetData.footer_note.includes("Tài liệu lưu hành nội bộ")
      ? sheetData.footer_note
      : "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.";

  const hideBrandLogo = isTemplateV2(input.templateName, input.templateHtml);

  const viewModel: SalesSheetViewModel = {
    product: {
      name: productName,
      brand_name: brandName,
      category_name: categoryName,
      short_description: shortDescription,
      image_url: imageUrl,
    },
    variants,
    benefits,
    ingredients,
    full_ingredients: fullIngredients,
    skin_types: skinTypes,
    usageInstructions,
    warnings,
    sales_notes: salesNotes,
    footer_note: footerNote,
    generated_at: new Date().toLocaleString("vi-VN"),
    audience,
    hideBrandLogo,
    __debugSource: debugSource,
  };

  return viewModel;
}

/**
 * Renders HTML string for live preview using SalesSheetViewModel and template.
 */
export function renderSalesSheetViewModelHtml(
  viewModel: SalesSheetViewModel,
  _templateHtml?: string,
): string {
  return renderSalesSheetHtml(viewModel, viewModel.audience);
}
