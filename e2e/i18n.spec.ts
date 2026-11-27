import { test, expect } from "@playwright/test";

test.describe("Internationalization (i18n)", () => {
  const locales = [
    {
      code: "en-US",
      name: "English (US)",
      openMenu: "Open menu",
      signIn: "Login",
      requiredError: "This field is required",
    },
    {
      code: "es-US",
      name: "Español (US)",
      openMenu: "Abrir menú",
      signIn: "Iniciar Sesión",
      requiredError: "Este campo es requerido",
    },
    {
      code: "es-MX",
      name: "Español (MX)",
      openMenu: "Abrir menú",
      signIn: "Iniciar Sesión",
      requiredError: "Este campo es obligatorio",
    },
    {
      code: "pt-BR",
      name: "Português (BR)",
      openMenu: "Abrir menu",
      signIn: "Entrar",
      requiredError: "Este campo é obrigatório",
    },
  ];

  for (const locale of locales) {
    test(`should update UI text and validation errors for ${locale.code}`, async ({ page }) => {
      // Set the locale in sessionStorage before the page loads to avoid slow UI interactions
      await page.addInitScript((code) => {
        sessionStorage.setItem("locale", code);
      }, locale.code);

      await page.goto("/auth");

      // Verify UI text update
      await expect(page.getByRole("tab", { name: new RegExp(locale.signIn, "i") })).toBeVisible({
        timeout: 10000,
      });

      // Verify Validation Errors
      const loginBtn = page.getByRole("button", { name: /login|iniciar|entrar/i });
      await loginBtn.click();
      await expect(page.getByText(locale.requiredError).first()).toBeVisible();
    });
  }
});
