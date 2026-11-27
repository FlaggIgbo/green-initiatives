import fs from "fs";
import path from "path";
import { NAMESPACES } from "./namespace-list";

const LOCALES = ["en-US", "es-US", "es-MX", "pt-BR"];
const LOCALES_DIR = path.resolve(__dirname);

/**
 * Load and merge all namespace files for a locale (split structure).
 * Uses require for Jest compatibility.
 */
function loadLocaleFromNamespaces(locale) {
  const merged = {};

  for (const ns of NAMESPACES) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(`./${locale}/${ns}.json`);
    merged[ns] = mod.default ?? mod;
  }

  // projectNotFound was top-level in original structure
  const errors = merged.errors;
  if (errors?.projectNotFound) {
    merged.projectNotFound = errors.projectNotFound;
  }

  return merged;
}

/**
 * Recursively get all keys from a nested object
 */
function getAllKeys(obj, prefix = "") {
  const keys = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys.sort();
}

/**
 * Get missing and extra keys between two sets
 */
function compareSets(set1, set2) {
  const missing = set1.filter((key) => !set2.includes(key));
  const extra = set2.filter((key) => !set1.includes(key));
  return { missing, extra };
}

describe("Locale File Validation (Split Namespaces)", () => {
  const locales = {};
  for (const locale of LOCALES) {
    locales[locale] = loadLocaleFromNamespaces(locale);
  }

  const enUSKeys = () => getAllKeys(locales["en-US"]);

  it("should have all locale files", () => {
    expect(locales["en-US"]).toBeDefined();
    expect(locales["es-US"]).toBeDefined();
    expect(locales["es-MX"]).toBeDefined();
    expect(locales["pt-BR"]).toBeDefined();
  });

  it("should have the same top-level sections in all locales", () => {
    const enUSTopLevel = Object.keys(locales["en-US"]).sort();
    expect(Object.keys(locales["es-US"]).sort()).toEqual(enUSTopLevel);
    expect(Object.keys(locales["es-MX"]).sort()).toEqual(enUSTopLevel);
    expect(Object.keys(locales["pt-BR"]).sort()).toEqual(enUSTopLevel);
  });

  it("all locales should have the exact same keys as en-US", () => {
    const enUSKeyList = enUSKeys();
    const localeTestCases = [
      { name: "es-US", data: locales["es-US"] },
      { name: "es-MX", data: locales["es-MX"] },
      { name: "pt-BR", data: locales["pt-BR"] },
    ];

    localeTestCases.forEach((testCase) => {
      const localeKeys = getAllKeys(testCase.data);
      const { missing, extra } = compareSets(enUSKeyList, localeKeys);

      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    });
  });

  it("should not have any empty translation values in any locale", () => {
    const checkForEmptyValues = (obj, path = "") => {
      const emptyKeys = [];

      for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof obj[key] === "object" && obj[key] !== null) {
          emptyKeys.push(...checkForEmptyValues(obj[key], currentPath));
        } else if (obj[key] === "" || obj[key] === null || obj[key] === undefined) {
          emptyKeys.push(currentPath);
        }
      }

      return emptyKeys;
    };

    const localeTestCases = [
      { name: "en-US", data: locales["en-US"] },
      { name: "es-US", data: locales["es-US"] },
      { name: "es-MX", data: locales["es-MX"] },
      { name: "pt-BR", data: locales["pt-BR"] },
    ];

    localeTestCases.forEach((testCase) => {
      const emptyKeys = checkForEmptyValues(testCase.data);
      expect(emptyKeys).toEqual([]);
    });
  });

  it("every locale folder should contain exactly one JSON file per namespace", () => {
    for (const locale of LOCALES) {
      const dir = path.join(LOCALES_DIR, locale);
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""))
        .sort();

      const expected = [...NAMESPACES].sort();
      const missing = expected.filter((ns) => !files.includes(ns));
      const extra = files.filter((f) => !expected.includes(f));

      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    }
  });

  it("no stale flat locale files should exist alongside namespace folders", () => {
    const flatFiles = fs
      .readdirSync(LOCALES_DIR)
      .filter((f) => f.endsWith(".json") && LOCALES.some((l) => f === `${l}.json`));

    expect(flatFiles).toEqual([]);
  });

  it("should print summary of all locale keys for debugging", () => {
    // eslint-disable-next-line no-console
    console.log("\n📊 Locale File Statistics (Split Namespaces):");
    // eslint-disable-next-line no-console
    console.log(`   en-US: ${enUSKeys().length} keys`);
    // eslint-disable-next-line no-console
    console.log(`   es-US: ${getAllKeys(locales["es-US"]).length} keys`);
    // eslint-disable-next-line no-console
    console.log(`   es-MX: ${getAllKeys(locales["es-MX"]).length} keys`);
    // eslint-disable-next-line no-console
    console.log(`   pt-BR: ${getAllKeys(locales["pt-BR"]).length} keys`);
    // eslint-disable-next-line no-console
    console.log(`\n✓ All locale files are in sync!\n`);
  });
});
