import { describe, it, expect } from "vitest";
import { BRANDING } from "../src/config/branding";
import fs from "fs";
import path from "path";

describe("Branding & Asset Single Source of Truth", () => {
  it("1. BRANDING config contains valid asset paths and company info", () => {
    expect(BRANDING.logo).toBe("/branding/default-logo-mark.svg");
    expect(BRANDING.defaultHeaderLogo).toBe("/branding/default-header-logo.svg");
    expect(BRANDING.defaultFavicon).toBe("/branding/favicon.svg");
    expect(BRANDING.defaultAppleTouchIcon).toBe("/branding/apple-touch-icon.png");
    expect(BRANDING.companyName).toBe("Desembre Vietnam");
  });

  it("2. Vector SVG brand files exist in public/branding directory", () => {
    const logoPath = path.resolve(__dirname, "../public/branding/logo-desembrehub.svg");
    const faviconPath = path.resolve(__dirname, "../public/branding/favicon-desembrehub.svg");

    expect(fs.existsSync(logoPath)).toBe(true);
    expect(fs.existsSync(faviconPath)).toBe(true);

    const logoContent = fs.readFileSync(logoPath, "utf-8");
    const faviconContent = fs.readFileSync(faviconPath, "utf-8");

    expect(logoContent).toContain("<svg");
    expect(logoContent).toContain("</svg>");
    expect(faviconContent).toContain("<svg");
    expect(faviconContent).toContain("</svg>");
  });

  it("3. index.html contains updated favicon, apple-touch-icon, and manifest references", () => {
    const indexPath = path.resolve(__dirname, "../index.html");
    const indexContent = fs.readFileSync(indexPath, "utf-8");

    expect(indexContent).toContain('rel="icon" type="image/svg+xml" href="/branding/favicon-desembrehub.svg?v=2"');
    expect(indexContent).toContain('rel="alternate icon" type="image/png" href="/favicon.png?v=2"');
    expect(indexContent).toContain('rel="apple-touch-icon" href="/branding/logo-desembrehub.svg?v=2"');
    expect(indexContent).toContain('rel="manifest" href="/site.webmanifest"');
  });

  it("4. site.webmanifest is valid JSON and links to brand icons", () => {
    const manifestPath = path.resolve(__dirname, "../public/site.webmanifest");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifestContent.name).toBe("DESEMBRE Partner Hub");
    expect(manifestContent.icons.length).toBeGreaterThanOrEqual(1);
    expect(manifestContent.icons.some((icon: any) => icon.src.includes("favicon-desembrehub.svg"))).toBe(true);
  });

  it("5. public /san-pham route uses dynamic branding from useBranding hook", () => {
    const sanPhamPath = path.resolve(__dirname, "../src/routes/san-pham.tsx");
    const fileContent = fs.readFileSync(sanPhamPath, "utf-8");

    expect(fileContent).toContain("useBranding");
    expect(fileContent).toContain("branding.logoMarkUrl");
    expect(fileContent).toContain("branding.siteName");
  });
});
