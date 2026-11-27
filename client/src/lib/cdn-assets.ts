/**
 * CDN Assets Configuration
 *
 * Centralizes all static asset URLs for easy CDN migration.
 * In production, assets are served from Google Cloud Storage CDN.
 *
 * To set up GCP CDN:
 * 1. Create a Cloud Storage bucket: gs://berrybank-greeninitiatives-assets
 * 2. Make the bucket public or use signed URLs
 * 3. Enable Cloud CDN on the bucket
 * 4. Set VITE_CDN_URL to the CDN endpoint
 */

// CDN base URL - set via environment variable or defaults to relative paths
const CDN_BASE_URL = import.meta.env.VITE_CDN_URL || "";

/**
 * Get the full CDN URL for an asset
 * @param path - Asset path relative to CDN root (e.g., "/images/logo.png")
 * @returns Full CDN URL or relative path if CDN not configured
 */
export function getCdnUrl(path: string): string {
  if (!CDN_BASE_URL) {
    // No CDN configured - use relative paths (served by client nginx)
    return path;
  }

  const base = CDN_BASE_URL.endsWith("/") ? CDN_BASE_URL.slice(0, -1) : CDN_BASE_URL;
  const assetPath = path.startsWith("/") ? path : `/${path}`;

  return `${base}${assetPath}`;
}

/**
 * Predefined asset paths for easy access
 * Update these as you add new assets to the CDN
 */
export const ASSETS = {
  // Brand assets
  logo: getCdnUrl("/images/berry-bank-logo.svg"),
  logoIcon: getCdnUrl("/images/berry-bank-icon.svg"),
  favicon: getCdnUrl("/favicon.svg"),

  // Placeholder images
  projectPlaceholder: getCdnUrl("/images/project-placeholder.jpg"),
  userAvatar: getCdnUrl("/images/default-avatar.svg"),

  // Map markers (currently using external CDN, can be migrated)
  mapMarker: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  mapMarkerShadow: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
} as const;

/**
 * Project image options for the create project form
 * Using Unsplash for now - can be migrated to GCP CDN
 */
export const PROJECT_IMAGES = [
  // Solar/Energy
  "https://images.unsplash.com/photo-1648135327756-b606e2eb8caa?w=800&q=80",
  "https://images.unsplash.com/photo-1467579424161-6bbc141569d7?w=800&q=80",
  // Nature/Trees
  "https://images.unsplash.com/photo-1451847251646-8a6c0dd1510c?w=800&q=80",
  "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&q=80",
  // Sustainability
  "https://images.unsplash.com/photo-1563974876412-77c51386dcad?w=800&q=80",
  "https://images.unsplash.com/photo-1454181222362-e0ff88ddc232?w=800&q=80",
] as const;

/**
 * Check if CDN is configured
 */
export function isCdnEnabled(): boolean {
  return !!CDN_BASE_URL;
}

export { CDN_BASE_URL };
