import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
}

/**
 * useSEO hook to manage document metadata
 * Mimics Next.js Head component behavior in a Vite SPA
 */
export function useSEO({ title, description, keywords, ogImage, ogType = "website" }: SEOProps) {
  useEffect(() => {
    const baseTitle = "Berry Bank Green Hub";
    const fullTitle = title ? `${title} | ${baseTitle}` : baseTitle;

    // Update Title
    document.title = fullTitle;

    // Update Meta Tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let element = document.querySelector(selector);

      if (!element) {
        element = document.createElement("meta");
        if (isProperty) {
          element.setAttribute("property", name);
        } else {
          element.setAttribute("name", name);
        }
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    };

    if (description) {
      updateMetaTag("description", description);
      updateMetaTag("og:description", description, true);
    }

    if (keywords) {
      updateMetaTag("keywords", keywords);
    }

    updateMetaTag("og:title", fullTitle, true);
    updateMetaTag("og:type", ogType, true);

    if (ogImage) {
      updateMetaTag("og:image", ogImage, true);
    }

    // Cleanup (optional: reset to defaults)
    return () => {
      // We could reset tags here if needed
    };
  }, [title, description, keywords, ogImage, ogType]);
}
