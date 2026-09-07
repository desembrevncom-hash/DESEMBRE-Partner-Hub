import { useState, useEffect } from "react";
import { Package } from "lucide-react";

interface Props {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallbackIconSize?: number;
  showWatermark?: boolean;
}

export function CatalogProductImage({
  src,
  fallbackSrc,
  alt,
  className = "w-full h-full object-contain",
  containerClassName = "w-full h-full flex items-center justify-center bg-slate-50",
  fallbackIconSize = 24,
  showWatermark = false,
}: Props) {
  const [useFallback, setUseFallback] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setUseFallback(false);
    setHasError(false);
  }, [src, fallbackSrc]);

  const activeSrc = (!useFallback ? src : fallbackSrc) || undefined;
  const isValidSrc = Boolean(activeSrc && activeSrc.trim().length > 0 && !hasError);

  if (import.meta.env.DEV) {
    console.log("[CatalogProductImage]", { alt, src, fallbackSrc, activeSrc, hasError });
  }

  const handleError = () => {
    if (import.meta.env.DEV) {
      console.warn("[CatalogProductImage] Image load failed for src:", activeSrc, {
        originalSrc: src,
        fallbackSrc,
        usedFallback: useFallback,
      });
    }
    if (!useFallback && fallbackSrc && fallbackSrc.trim().length > 0) {
      setUseFallback(true);
    } else {
      setHasError(true);
    }
  };

  if (!isValidSrc) {
    return (
      <div className={containerClassName}>
        <div className="flex flex-col items-center justify-center text-slate-300 gap-1 select-none">
          <Package
            style={{ width: fallbackIconSize, height: fallbackIconSize }}
            className="stroke-1"
          />
          {showWatermark && (
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
              Desembre
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <img src={activeSrc} alt={alt} loading="lazy" onError={handleError} className={className} />
  );
}
