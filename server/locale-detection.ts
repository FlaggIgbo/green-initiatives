/**
 * Server-side locale detection utilities
 * These can be used in API routes or server-side rendering
 */

export interface UserMetadata {
  country?: string;
  timezone?: string;
  preferredLanguage?: string;
  browserLanguage?: string;
}

export interface GeolocationData {
  country_code: string;
  country_name: string;
  region: string;
  city: string;
  timezone: string;
}

/**
 * Enhanced server-side locale detection
 * Uses multiple data sources with priority ordering
 */
export async function detectServerLocale(
  userMetadata?: UserMetadata,
  ipAddress?: string,
): Promise<string> {
  // Priority order:
  // 1. User's explicit preference (from database/profile)
  // 2. IP geolocation
  // 3. Browser language (from headers)
  // 4. Default fallback

  // 1. Check user's stored preference
  if (userMetadata?.preferredLanguage) {
    const supportedLocales = ["en-US", "es-US", "es-MX", "pt-BR"];
    if (supportedLocales.includes(userMetadata.preferredLanguage)) {
      return userMetadata.preferredLanguage;
    }
  }

  // 2. Try IP geolocation
  if (ipAddress) {
    try {
      const geoLocale = await detectLocaleFromIP(ipAddress);
      if (geoLocale) {
        return geoLocale;
      }
    } catch (error) {
      console.warn("IP geolocation failed:", error);
    }
  }

  // 3. Use browser language from headers
  if (userMetadata?.browserLanguage) {
    return mapBrowserLanguageToLocale(userMetadata.browserLanguage);
  }

  // 4. Default fallback
  return "en-US";
}

/**
 * Detects locale from IP address using geolocation service
 */
async function detectLocaleFromIP(ipAddress: string): Promise<string | null> {
  // 🛡️ PERFORMANCE PILLAR: Skip external geolocation fetch in test environment
  if (process.env.NODE_ENV === "test" || !!process.env.CI) {
    return null;
  }

  try {
    // Using ipapi.co (free tier: 1000 requests/day)
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "BerryBankGreenHub/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: GeolocationData = await response.json();
    const countryCode = data.country_code?.toUpperCase();

    // Map country codes to our supported locales
    const countryToLocale: Record<string, string> = {
      US: "en-US",
      MX: "es-MX",
      AR: "es-US", // Argentina
      CO: "es-US", // Colombia
      PE: "es-US", // Peru
      CL: "es-US", // Chile
      VE: "es-US", // Venezuela
      UY: "es-US", // Uruguay
      BO: "es-US", // Bolivia
      PY: "es-US", // Paraguay
      EC: "es-US", // Ecuador
      CR: "es-US", // Costa Rica
      PA: "es-US", // Panama
      GT: "es-US", // Guatemala
      HN: "es-US", // Honduras
      SV: "es-US", // El Salvador
      NI: "es-US", // Nicaragua
      CU: "es-US", // Cuba
      DO: "es-US", // Dominican Republic
      PR: "es-US", // Puerto Rico
      BR: "pt-BR",
      PT: "pt-BR", // Portugal
    };

    return countryToLocale[countryCode] || null;
  } catch (error) {
    console.warn("IP geolocation failed:", error);
    return null;
  }
}

/**
 * Maps browser language to our supported locales
 */
function mapBrowserLanguageToLocale(browserLang: string): string {
  // Check for exact match first
  const supportedLocales = ["en-US", "es-US", "es-MX", "pt-BR"];
  if (supportedLocales.includes(browserLang)) {
    return browserLang;
  }

  // Check for language match
  const langCode = browserLang.split("-")[0];

  if (langCode === "es") {
    return "es-US"; // Default Spanish variant
  }

  if (langCode === "pt") {
    return "pt-BR"; // Default Portuguese variant
  }

  if (langCode === "en") {
    return "en-US"; // Default English variant
  }

  return "en-US"; // Default fallback
}

/**
 * Extracts user metadata from request headers
 */
export function extractUserMetadata(
  headers: Record<string, string | string[] | undefined>,
): UserMetadata {
  const acceptLanguage = headers["accept-language"];
  const _userAgent = headers["user-agent"];

  return {
    browserLanguage:
      typeof acceptLanguage === "string" ? acceptLanguage.split(",")[0]?.trim() : undefined,
    // You can add more metadata extraction here
    // timezone: extractTimezoneFromHeaders(headers),
    // country: extractCountryFromHeaders(headers),
  };
}

/**
 * Example usage in an API route:
 *
 * ```typescript
 * export async function GET(request: Request) {
 *   const headers = request.headers;
 *   const ipAddress = getClientIP(request);
 *   const userMetadata = extractUserMetadata(headers);
 *
 *   const locale = await detectServerLocale(userMetadata, ipAddress);
 *
 *   return Response.json({ locale });
 * }
 * ```
 */
