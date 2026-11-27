import { calculateDistance } from "./use-geolocation";

describe("calculateDistance", () => {
  it("calculates distance between two coordinates correctly", () => {
    // New York to Los Angeles (approx 3944 km)
    const newYork = { lat: 40.7128, lng: -74.006 };
    const losAngeles = { lat: 34.0522, lng: -118.2437 };

    const distance = calculateDistance(newYork, losAngeles);

    // Allow 5% margin of error
    expect(distance).toBeGreaterThan(3750);
    expect(distance).toBeLessThan(4150);
  });

  it("returns 0 for same location", () => {
    const location = { lat: 37.7749, lng: -122.4194 };
    const distance = calculateDistance(location, location);

    expect(distance).toBe(0);
  });

  it("calculates short distances accurately", () => {
    // Two points ~10km apart in San Francisco
    const point1 = { lat: 37.7749, lng: -122.4194 };
    const point2 = { lat: 37.8044, lng: -122.2712 };

    const distance = calculateDistance(point1, point2);

    // Should be around 13-14 km
    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(20);
  });

  it("handles international distances", () => {
    // London to Paris (approx 344 km)
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };

    const distance = calculateDistance(london, paris);

    expect(distance).toBeGreaterThan(300);
    expect(distance).toBeLessThan(400);
  });

  it("handles coordinates across hemispheres", () => {
    // Sydney, Australia to Buenos Aires, Argentina
    const sydney = { lat: -33.8688, lng: 151.2093 };
    const buenosAires = { lat: -34.6037, lng: -58.3816 };

    const distance = calculateDistance(sydney, buenosAires);

    // Very long distance, ~11,800 km
    expect(distance).toBeGreaterThan(11000);
    expect(distance).toBeLessThan(13000);
  });
});
