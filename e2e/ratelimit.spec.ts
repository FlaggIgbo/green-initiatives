import { test, expect } from "@playwright/test";

/**
 * 🛡️ SECURITY PILLAR: Rate Limiting Test
 * This test verifies that the server correctly limits authentication attempts
 * to prevent brute-force attacks.
 */
test.describe("Rate Limiting", () => {
  test("should return 429 when auth rate limit is exceeded", async ({ request, browserName }) => {
    const loginEndpoint = "/api/login";
    const testKey = `ratelimit-${browserName}-${Date.now()}`;

    // We make 20 requests that should be allowed (even if they fail due to bad credentials).
    // We use the special x-test-rate-limit header to opt-in to rate limiting
    // even in the Playwright/CI environment which normally bypasses it.
    for (let i = 0; i < 20; i++) {
      const response = await request.post(loginEndpoint, {
        data: { email: "test@example.com", password: "wrong-password" },
        headers: {
          "x-test-rate-limit": "true",
          "x-test-rate-limit-key": testKey,
        },
      });

      // We expect 401 (Unauthorized) or 400 (Bad Request) but NOT 429
      expect(response.status(), `Request ${i + 1} should not be rate limited`).not.toBe(429);
    }

    // The 21st request should be rate limited
    const response = await request.post(loginEndpoint, {
      data: { email: "test@example.com", password: "wrong-password" },
      headers: {
        "x-test-rate-limit": "true",
        "x-test-rate-limit-key": testKey,
      },
    });

    expect(response.status()).toBe(429);
    const body = await response.json();
    expect(body.message).toBe(
      "Too many authentication attempts, please try again after 15 minutes",
    );
  });

  test("should NOT return 429 when x-test-rate-limit header is missing (bypass active)", async ({
    request,
  }) => {
    const loginEndpoint = "/api/login";

    // In test environment, it should normally bypass rate limiting
    // We make 25 requests (above the 20 limit) to prove the bypass is working
    for (let i = 0; i < 25; i++) {
      const response = await request.post(loginEndpoint, {
        data: { email: "test@example.com", password: "wrong-password" },
        // x-test-rate-limit header is NOT sent here
      });

      expect(response.status()).not.toBe(429);
    }
  });
});
