import { useEffect } from "react";
import { useBranding } from "@/hooks/useBranding";

/**
 * BrandFavicon dynamically syncs the browser tab favicon and apple-touch-icon
 * with the latest values from useBranding, applying cache-busting version queries.
 */
export function BrandFavicon() {
  const { faviconUrl, appleTouchIconUrl, updatedAt } = useBranding();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const cacheKey = updatedAt ? new Date(updatedAt).getTime() : "v2";

    // 1. Update or create primary favicon link (SVG or PNG)
    const faviconHref = faviconUrl.includes("?")
      ? `${faviconUrl}&v=${cacheKey}`
      : `${faviconUrl}?v=${cacheKey}`;

    let iconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!iconLink) {
      iconLink = document.createElement("link");
      iconLink.rel = "icon";
      document.head.appendChild(iconLink);
    }
    const isSvg = faviconUrl.toLowerCase().endsWith(".svg") || faviconUrl.includes(".svg?");
    iconLink.type = isSvg ? "image/svg+xml" : "image/png";
    iconLink.href = faviconHref;

    // 2. Update or create apple-touch-icon
    if (appleTouchIconUrl) {
      const appleTouchHref = appleTouchIconUrl.includes("?")
        ? `${appleTouchIconUrl}&v=${cacheKey}`
        : `${appleTouchIconUrl}?v=${cacheKey}`;

      let appleIconLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
      if (!appleIconLink) {
        appleIconLink = document.createElement("link");
        appleIconLink.rel = "apple-touch-icon";
        document.head.appendChild(appleIconLink);
      }
      appleIconLink.href = appleTouchHref;
    }
  }, [faviconUrl, appleTouchIconUrl, updatedAt]);

  return null;
}
