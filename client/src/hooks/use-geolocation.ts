import { useState, useEffect } from "react";
import { clientLogger } from "@/lib/logger";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationInfo {
  coordinates: Coordinates;
  city?: string;
  country?: string;
}

export interface GeolocationState {
  location: Coordinates | null;
  locationInfo: LocationInfo | null;
  error: string | null;
  loading: boolean;
  permissionDenied: boolean;
}

/**
 * Custom hook to get user's location via browser Geolocation API
 * Falls back to IP-based location if permission is denied
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    locationInfo: null,
    error: null,
    loading: true,
    permissionDenied: false,
  });

  useEffect(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setState({
        location: null,
        locationInfo: null,
        error: "Geolocation is not supported by your browser",
        loading: false,
        permissionDenied: false,
      });
      return;
    }

    // Request user's location
    navigator.geolocation.getCurrentPosition(
      // Success callback
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        // Try to get city/country from reverse geocoding
        try {
          const response = await fetch("https://ipapi.co/json/", {
            headers: {
              Accept: "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            setState({
              location: coords,
              locationInfo: {
                coordinates: coords,
                city: data.city,
                country: data.country_name,
              },
              error: null,
              loading: false,
              permissionDenied: false,
            });
            return;
          }
        } catch (error) {
          clientLogger.warn("Could not fetch location details", {
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Fallback: just set coordinates without city/country
        setState({
          location: coords,
          locationInfo: {
            coordinates: coords,
          },
          error: null,
          loading: false,
          permissionDenied: false,
        });
      },
      // Error callback
      async (error) => {
        clientLogger.warn("Geolocation permission denied or failed", {
          message: error.message,
          code: error.code,
        });

        // Try to get approximate location from IP
        try {
          const response = await fetch("https://ipapi.co/json/", {
            headers: {
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(`IP geolocation API error: ${response.status}`);
          }

          const data = await response.json();

          if (data.latitude && data.longitude) {
            const coords = {
              lat: data.latitude,
              lng: data.longitude,
            };
            setState({
              location: coords,
              locationInfo: {
                coordinates: coords,
                city: data.city,
                country: data.country_name,
              },
              error: null,
              loading: false,
              permissionDenied: error.code === error.PERMISSION_DENIED,
            });
          } else {
            throw new Error("IP geolocation data incomplete");
          }
        } catch (ipError) {
          clientLogger.error("IP-based geolocation failed", {
            error: ipError instanceof Error ? ipError.message : String(ipError),
          });
          setState({
            location: null,
            locationInfo: null,
            error: "Unable to determine your location. Distance filtering is disabled.",
            loading: false,
            permissionDenied: error.code === error.PERMISSION_DENIED,
          });
        }
      },
      // Options
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      },
    );
  }, []);

  return state;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance); // Return rounded kilometers
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
