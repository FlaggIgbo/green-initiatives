#!/usr/bin/env node

/**
 * Checks for translation keys in en-US.json that are not referenced
 * anywhere in the client source code.
 *
 * Usage:
 *   node scripts/check-unused-translations.mjs [--delete]
 *
 * Flags:
 *   --delete   Remove unused keys from ALL locale files instead of just warning.
 *
 * Exit codes:
 *   0  - No unused translations (or --delete cleaned them up)
 *   1  - Unused translations found (warning mode)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const LOCALES_DIR = join(ROOT, "client/src/locales");
const SRC_DIR = join(ROOT, "client/src");
const REFERENCE_LOCALE = "en-US.json";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively flatten a nested object into dot-separated key paths. */
function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** Recursively collect all source files under `dir`. */
function collectSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "locales") continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Delete a nested key from an object given its dot-separated path.
 * Prunes empty parent objects left behind after deletion.
 */
function deleteNestedKey(obj, path) {
  const parts = path.split(".");
  const stack = [];
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) return;
    stack.push({ obj: current, key: parts[i] });
    current = current[parts[i]];
  }

  delete current[parts[parts.length - 1]];

  // Prune empty parent objects bottom-up
  for (let i = stack.length - 1; i >= 0; i--) {
    const { obj: parent, key } = stack[i];
    if (Object.keys(parent[key]).length === 0) {
      delete parent[key];
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const deleteMode = process.argv.includes("--delete");

// 1. Load and flatten reference locale
const refPath = join(LOCALES_DIR, REFERENCE_LOCALE);
const refJson = JSON.parse(readFileSync(refPath, "utf-8"));
const allKeys = flattenKeys(refJson);

// 2. Read all source files into one big string for fast substring matching.
//    We search for "t.<key>" patterns since the codebase accesses translations
//    as typed properties: t.home.title, t.common.save, etc.
const sourceFiles = collectSourceFiles(SRC_DIR);
const sourceContent = sourceFiles.map((f) => readFileSync(f, "utf-8")).join("\n");

// 3. Check each key.
//    Access patterns to match:
//      t.profile.title        (standard)
//      t.profile?.title       (optional chaining)
//    We build a regex for each key where dots can be either "." or "?."
const unusedKeys = [];
for (const key of allKeys) {
  const escapedSegments = key.split(".").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Separator matches both "." and "?." (optional chaining)
  const sep = "\\??\\.";
  const pattern = new RegExp(`\\bt${sep}` + escapedSegments.join(sep));
  if (!pattern.test(sourceContent)) {
    unusedKeys.push(key);
  }
}

// 4. Report
if (unusedKeys.length === 0) {
  console.log(`✅ All ${allKeys.length} translation keys are in use.`);
  process.exit(0);
}

console.log(
  `\n⚠️  Found ${unusedKeys.length} unused translation key(s) out of ${allKeys.length} total:\n`,
);
for (const key of unusedKeys) {
  console.log(`  • ${key}`);
}

if (!deleteMode) {
  console.log("\nRun with --delete to remove these keys from all locale files.\n");
  process.exit(1);
}

// 5. Delete mode – remove unused keys from every locale file

// 5a. Monolithic locale files (e.g. en-US.json)
const monolithicFiles = readdirSync(LOCALES_DIR).filter(
  (f) => f.endsWith(".json") && statSync(join(LOCALES_DIR, f)).isFile(),
);

for (const file of monolithicFiles) {
  const filePath = join(LOCALES_DIR, file);
  const json = JSON.parse(readFileSync(filePath, "utf-8"));

  let removed = 0;
  for (const key of unusedKeys) {
    const before = JSON.stringify(json);
    deleteNestedKey(json, key);
    if (JSON.stringify(json) !== before) removed++;
  }

  writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n");
  console.log(`  🗑️  ${file}: removed ${removed} key(s)`);
}

// 5b. Split namespace files (e.g. en-US/common.json)
// Group unused keys by their top-level namespace so we can target the right file.
const unusedByNamespace = new Map();
for (const key of unusedKeys) {
  const dotIdx = key.indexOf(".");
  if (dotIdx === -1) continue; // top-level keys only live in monolithic files
  const ns = key.slice(0, dotIdx);
  const rest = key.slice(dotIdx + 1);
  if (!unusedByNamespace.has(ns)) unusedByNamespace.set(ns, []);
  unusedByNamespace.get(ns).push(rest);
}

const localeDirs = readdirSync(LOCALES_DIR).filter((f) =>
  statSync(join(LOCALES_DIR, f)).isDirectory(),
);

for (const localeDir of localeDirs) {
  let dirRemoved = 0;

  for (const [ns, keys] of unusedByNamespace) {
    const nsPath = join(LOCALES_DIR, localeDir, `${ns}.json`);
    let nsJson;
    try {
      nsJson = JSON.parse(readFileSync(nsPath, "utf-8"));
    } catch {
      continue;
    }

    for (const key of keys) {
      const before = JSON.stringify(nsJson);
      deleteNestedKey(nsJson, key);
      if (JSON.stringify(nsJson) !== before) dirRemoved++;
    }

    writeFileSync(nsPath, JSON.stringify(nsJson, null, 2) + "\n");
  }

  console.log(`  🗑️  ${localeDir}/: removed ${dirRemoved} key(s)`);
}

console.log("\n✅ Unused translations deleted from all locale files.\n");
process.exit(0);
