import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const loadJson = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
};

const en = loadJson('src/locales/en/common.json');
const fr = loadJson('src/locales/fr/common.json');

const flatten = (value, prefix = '', output = new Map()) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      const next = prefix ? `${prefix}.${key}` : key;
      flatten(child, next, output);
    }
    return output;
  }

  output.set(prefix, value);
  return output;
};

const placeholderSet = (text) => {
  const matches = String(text).match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) ?? [];
  return new Set(matches.map((match) => match.replace(/\{|\}|\s/g, '')));
};

const enFlat = flatten(en);
const frFlat = flatten(fr);

const errors = [];

for (const key of enFlat.keys()) {
  if (!frFlat.has(key)) {
    errors.push(`Missing fr key: ${key}`);
    continue;
  }

  const enValue = enFlat.get(key);
  const frValue = frFlat.get(key);
  if (typeof enValue !== typeof frValue) {
    errors.push(`Type mismatch for key: ${key} (en=${typeof enValue}, fr=${typeof frValue})`);
    continue;
  }

  if (typeof enValue === 'string') {
    const enPlaceholders = placeholderSet(enValue);
    const frPlaceholders = placeholderSet(frValue);
    const enList = [...enPlaceholders].sort().join(',');
    const frList = [...frPlaceholders].sort().join(',');
    if (enList !== frList) {
      errors.push(`Placeholder mismatch for key: ${key} (en=[${enList}] fr=[${frList}])`);
    }
  }
}

for (const key of frFlat.keys()) {
  if (!enFlat.has(key)) {
    errors.push(`Unexpected fr key (missing in en): ${key}`);
  }
}

if (errors.length > 0) {
  console.error('i18n check failed');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`i18n check passed (${enFlat.size} keys)`);
