import { LangSelector } from "./LangSelector";

export function renderTroops(troops: number): string {
  return renderNumber(troops / 10);
}

export function renderNumber(value: number): string {
  let n = Math.max(0, value);
  if (isNaN(value)) {
    n = 0;
  }
  if (n < 1_000) {
    return Math.floor(n).toString();
  }
  if (n < 1_000_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function renderPercentage(value: number): string {
  const percentage = value * 100;
  if (percentage >= 99.5) return "100%";
  if (percentage <= 0.01) return "0%";
  return percentage.toPrecision(percentage < 0.1 ? 1 : 2) + "%";
}

export function secondsToHms(d: number): string {
  if (d === 0) return "-";
  const h = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  const s = d % 60;
  return `${h > 0 ? `${h}h` : ""}${m > 0 ? `${m}m` : ""}${s}s`;
}

export function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  Object.assign(canvas.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    touchAction: "none",
  });

  return canvas;
}
/**
 * A polyfill for crypto.randomUUID that provides fallback implementations
 * for older browsers, particularly Safari versions < 15.4
 */
export function generateCryptoRandomUUID(): string {
  // Type guard to check if randomUUID is available
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  // Fallback using crypto.getRandomValues
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      (c: number): string =>
        (
          c ^
          (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
        ).toString(16),
    );
  }

  // Last resort fallback using Math.random
  // Note: This is less cryptographically secure but ensures functionality
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (c: string): string => {
      const r: number = (Math.random() * 16) | 0;
      const v: number = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
}

// Re-export translateText from LangSelector
export const translateText = (
  key: string,
  params: Record<string, string | number> = {},
): string => {
  const langSelector = document.querySelector("lang-selector") as LangSelector;
  if (!langSelector) {
    console.warn("LangSelector not found in DOM");
    return key;
  }

  // Wait for translations to be loaded
  if (
    !langSelector.translations ||
    Object.keys(langSelector.translations).length === 0
  ) {
    return key;
  }

  return langSelector.translateText(key, params);
};
