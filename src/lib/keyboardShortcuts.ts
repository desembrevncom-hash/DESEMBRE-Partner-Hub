import { useEffect } from "react";

export interface CRMShortcutHandlers {
  onSearchFocus?: () => void;
  onCallFocus?: () => void; // G
  onZaloFocus?: () => void; // Z
  onNoteFocus?: () => void; // N
  onQuickLogFocus?: () => void; // Q
  onFocusQueue?: () => void; // Shift+G or G if context fits
  onAssign?: () => void; // Shift+A
  onMoveStage?: () => void; // Shift+M
  onNextCustomer?: () => void; // →
  onPrevCustomer?: () => void; // ←
  onClose?: () => void; // Esc
}

export function useCRMShortcuts(handlers: CRMShortcutHandlers, isActive: boolean = true) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is modifying inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        // Special case: Esc can still close or blur
        if (e.key === "Escape" && handlers.onClose) {
          handlers.onClose();
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case "/":
          e.preventDefault();
          handlers.onSearchFocus?.();
          break;
        case "g":
        case "G":
          e.preventDefault();
          if (e.shiftKey) handlers.onFocusQueue?.();
          else handlers.onCallFocus?.();
          break;
        case "z":
        case "Z":
          e.preventDefault();
          handlers.onZaloFocus?.();
          break;
        case "n":
        case "N":
          e.preventDefault();
          handlers.onNoteFocus?.();
          break;
        case "q":
        case "Q":
          e.preventDefault();
          handlers.onQuickLogFocus?.();
          break;
        case "A":
        case "a":
          if (e.shiftKey) {
            e.preventDefault();
            handlers.onAssign?.();
          }
          break;
        case "M":
        case "m":
          if (e.shiftKey) {
            e.preventDefault();
            handlers.onMoveStage?.();
          }
          break;
        case "ArrowRight":
          handlers.onNextCustomer?.();
          break;
        case "ArrowLeft":
          handlers.onPrevCustomer?.();
          break;
        case "Escape":
          handlers.onClose?.();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers, isActive]);
}
