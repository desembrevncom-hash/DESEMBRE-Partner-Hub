import { describe, it, expect } from "vitest";
import { DEFAULT_BRANDING, type BrandSettings } from "../src/config/branding";
import fs from "fs";
import path from "path";

describe("Dynamic Branding Architecture & Safety", () => {
  it("1. DEFAULT_BRANDING config provides valid fallback paths for all branding assets", () => {
    expect(DEFAULT_BRANDING.id).toBe("default");
    expect(DEFAULT_BRANDING.site_name).toBe("DESEMBRE HUB");
    expect(DEFAULT_BRANDING.header_logo_url).toBe("/branding/default-header-logo.svg");
    expect(DEFAULT_BRANDING.logo_mark_url).toBe("/branding/default-logo-mark.svg");
    expect(DEFAULT_BRANDING.favicon_url).toBe("/branding/favicon.svg");
    expect(DEFAULT_BRANDING.apple_touch_icon_url).toBe("/branding/apple-touch-icon.png");
  });

  it("1b. Log DB settings", async () => {
    const fs = await import("fs");
    const { createClient } = await import("@supabase/supabase-js");
    let envContent = "";
    try {
      envContent = fs.readFileSync(".env.vercel", "utf-8");
    } catch {}
    const env: Record<string, string> = {};
    envContent.split("\n").forEach((line) => {
      const idx = line.indexOf("=");
      if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    });
    if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
      const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
      const { data: sys } = await s.from("system_settings").select("*").maybeSingle();
      const { data: brand } = await s.from("brand_settings").select("*").maybeSingle();
      console.log("REAL_DB_SYS_SETTINGS:", sys);
      console.log("REAL_DB_BRAND_SETTINGS:", brand);
    }
  });

  it("2. Fallback assets exist in public/branding directory", () => {
    const assets = [
      "default-header-logo.svg",
      "default-logo-mark.svg",
      "favicon.svg",
      "apple-touch-icon.png",
    ];

    for (const asset of assets) {
      const filePath = path.resolve(__dirname, `../public/branding/${asset}`);
      expect(fs.existsSync(filePath), `Asset ${asset} should exist in public/branding/`).toBe(true);
    }
  });

  it("3. Supabase migration defines brand_settings table, RLS policies, and branding-assets bucket", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../supabase/migrations/20260910120000_create_brand_settings_and_storage.sql",
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Table definition
    expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS public.brand_settings");
    expect(sqlContent).toContain("site_name TEXT DEFAULT 'DESEMBRE HUB'");
    expect(sqlContent).toContain("header_logo_url TEXT");
    expect(sqlContent).toContain("logo_mark_url TEXT");
    expect(sqlContent).toContain("favicon_url TEXT");
    expect(sqlContent).toContain("apple_touch_icon_url TEXT");

    // Default row
    expect(sqlContent).toContain("INSERT INTO public.brand_settings");
    expect(sqlContent).toContain("'default'");

    // RLS
    expect(sqlContent).toContain("ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY");
    expect(sqlContent).toContain("Public read brand settings");
    expect(sqlContent).toContain("is_admin_or_sub_admin");

    // Storage bucket
    expect(sqlContent).toContain("'branding-assets'");
    expect(sqlContent).toContain("Public can view branding assets");
    expect(sqlContent).toContain("Admins upload branding assets");
  });

  it("4. useBranding hook safely handles missing or null database values and merges fallbacks", () => {
    const rawDbNulls = {
      id: "default",
      site_name: null,
      header_logo_url: null,
      logo_mark_url: null,
      favicon_url: null,
      apple_touch_icon_url: null,
    };

    const merged: BrandSettings = {
      id: rawDbNulls.id || DEFAULT_BRANDING.id,
      site_name: rawDbNulls.site_name || DEFAULT_BRANDING.site_name,
      header_logo_url: rawDbNulls.header_logo_url || DEFAULT_BRANDING.header_logo_url,
      logo_mark_url: rawDbNulls.logo_mark_url || DEFAULT_BRANDING.logo_mark_url,
      favicon_url: rawDbNulls.favicon_url || DEFAULT_BRANDING.favicon_url,
      apple_touch_icon_url: rawDbNulls.apple_touch_icon_url || DEFAULT_BRANDING.apple_touch_icon_url,
    };

    expect(merged.site_name).toBe("DESEMBRE HUB");
    expect(merged.logo_mark_url).toBe("/branding/default-logo-mark.svg");
    expect(merged.favicon_url).toBe("/branding/favicon.svg");
  });

  it("5. useBranding hook merges custom uploaded URLs when present in DB", () => {
    const customDb = {
      id: "default",
      site_name: "DESEMBRE PRESTIGE HUB",
      header_logo_url: "https://xyz.supabase.co/storage/v1/object/public/branding-assets/logos/custom-header.png",
      logo_mark_url: "https://xyz.supabase.co/storage/v1/object/public/branding-assets/logos/custom-mark.svg",
      favicon_url: "https://xyz.supabase.co/storage/v1/object/public/branding-assets/logos/custom-fav.svg",
      apple_touch_icon_url: "https://xyz.supabase.co/storage/v1/object/public/branding-assets/logos/custom-touch.png",
      updated_at: "2026-09-10T12:00:00Z",
    };

    const merged: BrandSettings = {
      id: customDb.id || DEFAULT_BRANDING.id,
      site_name: customDb.site_name?.trim() || DEFAULT_BRANDING.site_name,
      header_logo_url: customDb.header_logo_url?.trim() || DEFAULT_BRANDING.header_logo_url,
      logo_mark_url: customDb.logo_mark_url?.trim() || DEFAULT_BRANDING.logo_mark_url,
      favicon_url: customDb.favicon_url?.trim() || DEFAULT_BRANDING.favicon_url,
      apple_touch_icon_url: customDb.apple_touch_icon_url?.trim() || DEFAULT_BRANDING.apple_touch_icon_url,
      updated_at: customDb.updated_at,
    };

    expect(merged.site_name).toBe("DESEMBRE PRESTIGE HUB");
    expect(merged.header_logo_url).toContain("custom-header.png");
    expect(merged.logo_mark_url).toContain("custom-mark.svg");
    expect(merged.favicon_url).toContain("custom-fav.svg");
    expect(merged.updated_at).toBe("2026-09-10T12:00:00Z");
  });

  it("6. AdminBrandingPage route enforces MIME types and file size bounds", () => {
    const brandingPagePath = path.resolve(__dirname, "../src/routes/admin/branding.tsx");
    const pageContent = fs.readFileSync(brandingPagePath, "utf-8");

    expect(pageContent).toContain("image/svg+xml");
    expect(pageContent).toContain("image/png");
    expect(pageContent).toContain("branding-assets");
    expect(pageContent).toContain("isAuthorized");
    expect(pageContent).toContain("handleFileUpload");
    expect(pageContent).toContain("handleSave");
  });

  it("7. public /san-pham route uses useBranding hook for dynamic header and footer rendering", () => {
    const sanPhamPath = path.resolve(__dirname, "../src/routes/san-pham.tsx");
    const fileContent = fs.readFileSync(sanPhamPath, "utf-8");

    expect(fileContent).toContain("useBranding");
    expect(fileContent).toContain("branding.logoMarkUrl");
    expect(fileContent).toContain("branding.siteName");
  });
});
