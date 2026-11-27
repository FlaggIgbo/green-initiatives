import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";
import { clientLogger } from "@/lib/logger";
import { getApiUrl } from "@/lib/api-config";
import { getAuthHeaders } from "@/lib/auth-token";
import { NAMESPACES } from "@/locales/namespace-list";

import type { TranslationKeys } from "@/locales/types";

// Supported locales
export type Locale = "en-US" | "es-US" | "es-MX" | "pt-BR";

const SUPPORTED_LOCALES: Locale[] = ["en-US", "es-US", "es-MX", "pt-BR"];

interface TranslationContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
  isLoading: boolean;
}

export const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

/**
 * Creates a proxy that returns "[path.to.key]" when a translation key is missing.
 */
function createFallbackProxy<T extends object>(obj: T, path = ""): T {
  return new Proxy(obj, {
    get(target, prop: string) {
      const value = (target as Record<string, unknown>)[prop];
      const fullPath = path ? `${path}.${prop}` : prop;

      if (value === undefined) {
        return `[${fullPath}]`;
      }

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return createFallbackProxy(value as Record<string, unknown>, fullPath) as T;
      }

      return value;
    },
  }) as T;
}

/** Glob of all locale namespace files - Vite resolves at build time; dynamic import fails with alias */
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "/src/locales/*/*.json",
  { eager: false },
);

// Build lookup map: "en-US/common" -> loader (glob keys vary by Vite version)
const localeModuleMap = new Map<string, () => Promise<{ default: Record<string, unknown> }>>();
for (const [path, loader] of Object.entries(localeModules)) {
  const match = path.match(/locales\/([^/]+)\/([^/]+)\.json$/);
  if (match)
    localeModuleMap.set(
      `${match[1]}/${match[2]}`,
      loader as () => Promise<{ default: Record<string, unknown> }>,
    );
}

/**
 * Load a single locale by loading all namespace files.
 * Uses import.meta.glob so Vite can resolve paths at build time.
 */
async function loadLocale(locale: Locale): Promise<TranslationKeys> {
  const merged: Record<string, unknown> = {};

  await Promise.all(
    NAMESPACES.map(async (ns) => {
      const key = `${locale}/${ns}`;
      const loader = localeModuleMap.get(key);
      if (loader) {
        try {
          const mod = await loader();
          merged[ns] = mod.default ?? mod;
        } catch (err) {
          clientLogger.warn(`Failed to load locale namespace`, {
            locale,
            namespace: ns,
            error: err instanceof Error ? err.message : String(err),
          });
          merged[ns] = {};
        }
      } else {
        clientLogger.warn(`Locale namespace not found`, { locale, namespace: ns });
        merged[ns] = {};
      }
    }),
  );

  // projectNotFound was top-level in original structure — add for backward compat
  const errors = merged.errors as Record<string, unknown> | undefined;
  if (errors?.projectNotFound) {
    (merged as Record<string, unknown>).projectNotFound = errors.projectNotFound;
  }

  return merged as TranslationKeys;
}

/**
 * Enhanced locale detection using multiple data sources
 * Priority: User preference > Server detection > IP geolocation > Browser language > Default
 */
async function detectUserLocale(): Promise<Locale> {
  const stored = sessionStorage.getItem("locale") as Locale | null;
  if (stored && SUPPORTED_LOCALES.includes(stored)) {
    return stored;
  }

  try {
    const serverLocale = await detectLocaleFromServer();
    if (serverLocale) return serverLocale;
  } catch (error) {
    clientLogger.warn("Server locale detection failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const ipLocale = await detectLocaleFromIP();
    if (ipLocale) return ipLocale;
  } catch (error) {
    clientLogger.warn("Failed to detect locale from IP", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return detectBrowserLocale();
}

const SERVER_LOCALE_TIMEOUT_MS = 5000;

async function detectLocaleFromServer(): Promise<Locale | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SERVER_LOCALE_TIMEOUT_MS);

    const response = await fetch(getApiUrl("/api/locale"), {
      method: "GET",
      headers: { Accept: "application/json", ...getAuthHeaders() },
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (response.status === 401) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const detectedLocale = data.locale as Locale;
    if (detectedLocale && SUPPORTED_LOCALES.includes(detectedLocale)) {
      return detectedLocale;
    }
    return null;
  } catch (error) {
    clientLogger.warn("Server locale detection failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function detectLocaleFromIP(): Promise<Locale | null> {
  try {
    const cached = sessionStorage.getItem("ip_locale_cache");
    if (cached) {
      const { locale, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        return locale as Locale;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://ipapi.co/json/", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (response.status === 429) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const countryCode = data.country_code?.toUpperCase();

    const countryToLocale: Record<string, Locale> = {
      US: "en-US",
      MX: "es-MX",
      AR: "es-US",
      CO: "es-US",
      PE: "es-US",
      CL: "es-US",
      VE: "es-US",
      BR: "pt-BR",
      PT: "pt-BR",
    };

    const detectedLocale = countryToLocale[countryCode];
    if (detectedLocale) {
      sessionStorage.setItem(
        "ip_locale_cache",
        JSON.stringify({ locale: detectedLocale, timestamp: Date.now() }),
      );
      return detectedLocale;
    }
    return null;
  } catch (error) {
    clientLogger.warn("IP geolocation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Detects the user's preferred locale from the browser.
 * @internal - Exported for testing purposes
 */
export function detectBrowserLocale(): Locale {
  const browserLang =
    navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage;

  if (!browserLang) return "en-US";
  if (SUPPORTED_LOCALES.includes(browserLang as Locale)) return browserLang as Locale;

  const langCode = browserLang.split("-")[0];
  if (langCode === "es") return "es-US";
  if (langCode === "pt") return "pt-BR";

  return "en-US";
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = sessionStorage.getItem("locale") as Locale | null;
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
    return detectBrowserLocale();
  });

  const [translations, setTranslations] = useState<TranslationKeys | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load translations for the active locale (lazy — only this locale is fetched)
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    loadLocale(locale).then((loaded) => {
      if (!cancelled) {
        setTranslations(loaded);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Refine locale in background (server/IP)
  useEffect(() => {
    let cancelled = false;

    const refineLocale = async () => {
      try {
        const detectedLocale = await detectUserLocale();
        if (!cancelled && detectedLocale && detectedLocale !== locale) {
          setLocaleState(detectedLocale);
          sessionStorage.setItem("locale", detectedLocale);
        }
      } catch (error) {
        clientLogger.warn("Background locale detection failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    refineLocale();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    sessionStorage.setItem("locale", newLocale);
    window.location.reload();
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const tWithFallback = useMemo(() => {
    if (!translations) {
      return createFallbackProxy({} as TranslationKeys);
    }
    return createFallbackProxy(translations);
  }, [translations]);

  const value: TranslationContextType = {
    locale,
    setLocale,
    t: tWithFallback,
    isLoading,
  };

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslation must be used within a TranslationProvider");
  }
  return context;
}

/**
 * Helper function to interpolate values into translation strings
 */
export function interpolate(template: string, values: Record<string, string | number>): string {
  if (typeof template !== "string") return "";
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return String(values[key] ?? `{{${key}}}`);
  });
}
