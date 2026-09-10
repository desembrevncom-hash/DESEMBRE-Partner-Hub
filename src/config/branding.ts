/**
 * DESEMBRE Hub - Dynamic Branding Configuration & Fallback Single Source of Truth
 */

export interface BrandSettings {
  id: string;
  site_name: string;
  header_logo_url: string | null;
  logo_mark_url: string | null;
  favicon_url: string | null;
  apple_touch_icon_url: string | null;
  updated_at?: string;
}

export const DEFAULT_BRANDING: BrandSettings = {
  id: "default",
  site_name: "DESEMBRE HUB",
  header_logo_url: "/branding/default-header-logo.svg",
  logo_mark_url: "/branding/default-logo-mark.svg",
  favicon_url: "/branding/favicon.svg",
  apple_touch_icon_url: "/branding/apple-touch-icon.png",
};

export const BRANDING = {
  appName: "DESEMBRE Partner Hub",
  shortName: "Desembre Hub",
  companyName: "Desembre Vietnam",
  tagline: "Mỹ phẩm sinh học chuyên sâu",
  publicTitle: "DESEMBRE HUB | Mỹ phẩm sinh học chuyên sâu",

  // Default fallback assets
  defaultHeaderLogo: DEFAULT_BRANDING.header_logo_url!,
  defaultLogoMark: DEFAULT_BRANDING.logo_mark_url!,
  defaultFavicon: DEFAULT_BRANDING.favicon_url!,
  defaultAppleTouchIcon: DEFAULT_BRANDING.apple_touch_icon_url!,

  // General legacy getters
  logo: DEFAULT_BRANDING.logo_mark_url!,
  logoAlt: "Desembre Hub Logo",

  // Contact & Support
  hotline: "0333.60.26.26",
  hotlineDisplay: "Hotline 0333.60.26.26",
  hotlineTel: "tel:0333602626",
} as const;
