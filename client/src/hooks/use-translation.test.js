import { interpolate, detectBrowserLocale } from "./use-translation";

/**
 * Test suite for use-translation.tsx
 * Tests the interpolation function and browser locale detection
 */

describe("Translation Interpolation", () => {
  const testCases = [
    {
      name: "should replace placeholders with string and number values",
      template: "{{greeting}} {{name}}, you have {{count}} messages",
      values: { greeting: "Hello", name: "Alice", count: 5 },
      expected: "Hello Alice, you have 5 messages",
    },
    {
      name: "should leave unmatched placeholders unchanged",
      template: "Hello {{name}}, {{unmatched}} placeholder",
      values: { name: "Bob" },
      expected: "Hello Bob, {{unmatched}} placeholder",
    },
    {
      name: "should handle template without placeholders",
      template: "Hello World!",
      values: { name: "Alice" },
      expected: "Hello World!",
    },
  ];

  testCases.forEach((testCase) => {
    it(testCase.name, () => {
      const result = interpolate(testCase.template, testCase.values);
      expect(result).toBe(testCase.expected);
    });
  });
});

describe("Browser Locale Detection", () => {
  let originalNavigator;

  beforeEach(() => {
    originalNavigator = window.navigator;
  });

  afterEach(() => {
    Object.defineProperty(window, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  const localeTestCases = [
    {
      name: "should return exact locale match",
      navigatorLanguage: "es-MX",
      expected: "es-MX",
    },
    {
      name: "should map language code to default locale (es->es-US, pt->pt-BR)",
      navigatorLanguage: "es",
      expected: "es-US",
    },
    {
      name: "should fallback to en-US for unsupported languages",
      navigatorLanguage: "fr-FR",
      expected: "en-US",
    },
    {
      name: "should use userLanguage when language is undefined",
      navigatorLanguage: undefined,
      navigatorUserLanguage: "pt-BR",
      expected: "pt-BR",
    },
    {
      name: "should default to en-US when no language detected",
      navigatorLanguage: undefined,
      navigatorUserLanguage: undefined,
      expected: "en-US",
    },
  ];

  localeTestCases.forEach((testCase) => {
    it(testCase.name, () => {
      Object.defineProperty(window, "navigator", {
        value: {
          language: testCase.navigatorLanguage,
          userLanguage: testCase.navigatorUserLanguage,
        },
        writable: true,
        configurable: true,
      });

      const result = detectBrowserLocale();
      expect(result).toBe(testCase.expected);
    });
  });
});
