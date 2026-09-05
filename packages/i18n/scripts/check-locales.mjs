#!/usr/bin/env node
/**
 * Locale parity + translation key usage checker.
 *
 *   synqit-i18n-check --locales <dir> [--locales <dir>...]
 *                     [--usage <srcDir>...] [--usage-warn <srcDir>...] [--reference en]
 *
 * Parity: for each locales dir (containing `<locale>/common.json` folders) every
 * non-reference locale must have exactly the reference's keys with the same value
 * types and `{{placeholders}}`.
 *
 * Usage: every literal `t('some.key')` in the given source trees must exist in the
 * reference dictionary (plural keys may exist as `key_one` / `key_other`).
 * `--usage` fails the run; `--usage-warn` only prints, for trees whose copy is
 * still being written.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const localeDirs = [];
const usageDirs = [];
const usageWarnDirs = [];
let reference = 'en';
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--locales') localeDirs.push(path.resolve(args[++index]));
  else if (arg === '--usage') usageDirs.push(path.resolve(args[++index]));
  else if (arg === '--usage-warn') usageWarnDirs.push(path.resolve(args[++index]));
  else if (arg === '--reference') reference = args[++index];
  else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
}
if (localeDirs.length === 0) {
  console.error(
    'Usage: synqit-i18n-check --locales <dir> [--usage <srcDir>] [--usage-warn <srcDir>] [--reference en]',
  );
  process.exit(2);
}

const flatten = (value, prefix = '', output = new Map()) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, output);
    }
    return output;
  }
  output.set(prefix, value);
  return output;
};

const placeholders = (text) =>
  [...String(text).matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');

const loadDictionary = (dir, locale) =>
  JSON.parse(fs.readFileSync(path.join(dir, locale, 'common.json'), 'utf8'));

const errors = [];
const warnings = [];
let referenceFlat = null;
let totalKeys = 0;

for (const dir of localeDirs) {
  const locales = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (!locales.includes(reference)) {
    errors.push(`${dir}: missing reference locale "${reference}"`);
    continue;
  }
  const ref = flatten(loadDictionary(dir, reference));
  referenceFlat ??= ref;
  totalKeys += ref.size;

  for (const locale of locales.filter((name) => name !== reference)) {
    const other = flatten(loadDictionary(dir, locale));
    for (const [key, refValue] of ref) {
      if (!other.has(key)) {
        errors.push(`[${locale}] missing key: ${key}`);
        continue;
      }
      const otherValue = other.get(key);
      if (typeof refValue !== typeof otherValue) {
        errors.push(`[${locale}] type mismatch: ${key}`);
      } else if (
        typeof refValue === 'string' &&
        placeholders(refValue) !== placeholders(otherValue)
      ) {
        errors.push(`[${locale}] placeholder mismatch: ${key}`);
      }
    }
    for (const key of other.keys()) {
      if (!ref.has(key)) {
        errors.push(`[${locale}] unexpected key (missing in ${reference}): ${key}`);
      }
    }
  }
}

const walkSources = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSources(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(full);
  }
  return files;
};

let usedKeys = 0;
const checkUsage = (dirs, sink) => {
  const keyPattern = /\bt\(\s*'([A-Za-z0-9_.]+)'/g;
  for (const dir of dirs) {
    for (const file of walkSources(dir)) {
      const source = fs.readFileSync(file, 'utf8');
      const reported = new Set();
      for (const match of source.matchAll(keyPattern)) {
        const key = match[1];
        usedKeys += 1;
        const exists =
          referenceFlat.has(key) ||
          referenceFlat.has(`${key}_one`) ||
          referenceFlat.has(`${key}_other`);
        if (!exists && !reported.has(key)) {
          reported.add(key);
          sink.push(`[usage] ${path.relative(process.cwd(), file)}: unknown key "${key}"`);
        }
      }
    }
  }
};
if (referenceFlat) {
  checkUsage(usageDirs, errors);
  checkUsage(usageWarnDirs, warnings);
}

if (warnings.length > 0) {
  console.warn(`i18n usage warnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length > 0) {
  console.error('i18n check failed');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const usageNote =
  usageDirs.length + usageWarnDirs.length ? `, ${usedKeys} literal usages verified` : '';
console.log(`i18n check passed (${totalKeys} keys${usageNote})`);
