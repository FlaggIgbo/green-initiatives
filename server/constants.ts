// Shared constants for Sandbox and Development environments
export const ADMIN_USERNAME = "admin";
export const SANDBOX_ADMIN_PASSWORD = "@berrybank1";
export const DEV_ADMIN_PASSWORD = "@berrybank1";

// JWT Configuration
export const JWT_SECRET = process.env.JWT_SECRET || "a-string-secret-at-least-256-bits-long";
export const JWT_EXPIRES_IN = "7d";

// Game/System constants
export const COINS_PER_WATER = 10;
export const GROWTH_PER_WATER = 5;
export const DAILY_LOGIN_POINTS = 20;
export const STREAK_BONUS_POINTS = 5;
export const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;
export const RESET_TOKEN_EXPIRY_MS = 3600000; // 1 hour

// Impact Metrics constants
export const TREES_PER_DOLLAR = 0.1;
export const CARBON_PER_DOLLAR = 10;
