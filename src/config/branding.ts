/**
 * DESEMBRE Hub - Brand Configuration & Asset Single Source of Truth
 */
export const BRANDING = {
  appName: "DESEMBRE Partner Hub",
  shortName: "Desembre Hub",
  companyName: "Desembre Vietnam",
  tagline: "Mỹ phẩm sinh học chuyên sâu",
  publicTitle: "DESEMBRE HUB | Mỹ phẩm sinh học chuyên sâu",

  // Brand vector & raster assets
  logo: "/branding/logo-desembrehub.svg",
  logoFallback: "/logo.svg",
  logoAlt: "Desembre Hub Logo",

  // Favicon & Touch icons with cache-busting version query
  faviconSvg: "/branding/favicon-desembrehub.svg?v=2",
  faviconPng: "/favicon.png?v=2",
  appleTouchIcon: "/branding/logo-desembrehub.svg?v=2",

  // Contact & Support
  hotline: "0333.60.26.26",
  hotlineDisplay: "Hotline 0333.60.26.26",
  hotlineTel: "tel:0333602626",
} as const;

export type BrandingConfig = typeof BRANDING;
