import { useState, useEffect, useCallback, useRef } from "react";

export function useDraftState<T>(
  key: string,
  initialValue: T,
): [T, (val: T | ((prev: T) => T)) => void, () => void] {
  const isFirstRender = useRef(true);

  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = localStorage.getItem(`draft_${key}`);
      return stored ? JSON.parse(stored) : initialValue;
    } catch (e) {
      console.warn("Error reading draft state from localStorage", e);
      return initialValue;
    }
  });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`draft_${key}`, JSON.stringify(state));
      } catch (e) {
        console.warn("Error saving draft state to localStorage", e);
      }
    }, 500); // debounce save
    return () => clearTimeout(timer);
  }, [key, state]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(`draft_${key}`);
    } catch (e) {}
    setState(initialValue);
  }, [key, initialValue]);

  return [state, setState, clearDraft];
}
