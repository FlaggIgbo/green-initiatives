import fs from "fs";
import path from "path";

/**
 * Unit Tests for Vite Configuration
 *
 * These tests verify that the Vite configuration maintains the correct setup
 * for Hot Module Replacement (HMR) in middleware mode. This prevents
 * accidental configuration changes that could break the WebSocket connections.
 */
describe("Vite Configuration", () => {
  describe("vite.config.ts", () => {
    it("should have HMR configured with custom port to prevent WebSocket conflicts", () => {
      const configPath = path.resolve(__dirname, "../../vite.config.ts");
      const configContent = fs.readFileSync(configPath, "utf-8");

      // Ensure HMR uses a custom port configuration
      expect(configContent).toMatch(/hmr:\s*{/);
      expect(configContent).toMatch(/port:\s*24680/);
    });

    it("should not have middlewareMode set in vite.config.ts", () => {
      const configPath = path.resolve(__dirname, "../../vite.config.ts");
      const configContent = fs.readFileSync(configPath, "utf-8");

      // middlewareMode should be set in server options, not in vite.config.ts
      expect(configContent).not.toMatch(/middlewareMode:\s*true/);
    });

    it("should have basic server configuration", () => {
      const configPath = path.resolve(__dirname, "../../vite.config.ts");
      const configContent = fs.readFileSync(configPath, "utf-8");

      // Should have server object
      expect(configContent).toMatch(/server:\s*{/);
    });
  });

  describe("server/vite.ts", () => {
    it("should have middlewareMode enabled in server options", () => {
      const viteTsPath = path.resolve(__dirname, "../vite.ts");
      const viteContent = fs.readFileSync(viteTsPath, "utf-8");

      // Should have middlewareMode: true in serverOptions
      expect(viteContent).toMatch(/middlewareMode:\s*true/);
    });

    it("should have HMR configured with custom port in server options", () => {
      const viteTsPath = path.resolve(__dirname, "../vite.ts");
      const viteContent = fs.readFileSync(viteTsPath, "utf-8");

      // Should have hmr with custom port to prevent WebSocket conflicts
      expect(viteContent).toMatch(/hmr:\s*{/);
      expect(viteContent).toMatch(/port:\s*24680/);
    });

    it("should not have HMR server configuration that could cause conflicts", () => {
      const viteTsPath = path.resolve(__dirname, "../vite.ts");
      const viteContent = fs.readFileSync(viteTsPath, "utf-8");

      // Should not have HMR server configuration (port only is fine)
      expect(viteContent).not.toMatch(/hmr:\s*{\s*server/);
    });
  });

  describe("WebSocket Configuration", () => {
    it("should have dedicated WebSocket path to avoid conflicts", () => {
      const websocketPath = path.resolve(__dirname, "../websocket.ts");
      const websocketContent = fs.readFileSync(websocketPath, "utf-8");

      // WebSocket should use dedicated path
      expect(websocketContent).toMatch(/path:\s*["']\/ws["']/);
    });
  });
});

/**
 * Configuration Validation Summary
 *
 * This test suite ensures:
 *
 * 1. ✅ Vite runs in middleware mode (integrated with Express server)
 * 2. ✅ HMR is enabled with custom port (24680) to prevent WebSocket conflicts
 * 3. ✅ Application WebSocket uses dedicated path (/ws)
 * 4. ✅ No conflicting port configurations between HMR and app WebSocket
 *
 * If these tests fail, it means the Vite/WebSocket configuration
 * has been changed in a way that could break the development server.
 *
 * The correct configuration is:
 * - vite.config.ts: server.hmr = { port: 24680 }
 * - server/vite.ts: middlewareMode = true, hmr = { port: 24680 }
 * - server/websocket.ts: path = "/ws"
 */
