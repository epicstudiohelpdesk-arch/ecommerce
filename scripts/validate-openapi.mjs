#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openapiPath = path.resolve(__dirname, '../docs/api/OPENAPI.yaml');

console.log('Validating OpenAPI specification:', openapiPath);

if (!fs.existsSync(openapiPath)) {
  console.error('Error: OpenAPI file does not exist at', openapiPath);
  process.exit(1);
}

const fileContent = fs.readFileSync(openapiPath, 'utf8');
let doc;

try {
  doc = YAML.parse(fileContent);
} catch (err) {
  console.error('YAML Parsing Error:', err.message);
  process.exit(1);
}

// 1. Basic Structure Checks
if (!doc.openapi || !doc.openapi.startsWith('3.')) {
  console.error('Validation Error: Expected OpenAPI 3.x document, found:', doc.openapi);
  process.exit(1);
}

if (!doc.info || !doc.info.title || !doc.info.version) {
  console.error('Validation Error: Missing info.title or info.version');
  process.exit(1);
}

if (!doc.paths || Object.keys(doc.paths).length === 0) {
  console.error('Validation Error: No paths defined in specification');
  process.exit(1);
}

console.log(`✓ OpenAPI version: ${doc.openapi}`);
console.log(`✓ Specification title: ${doc.info.title} (${doc.info.version})`);
console.log(`✓ Defined path count: ${Object.keys(doc.paths).length}`);

// 2. Collect all schema, response, and parameter keys
const components = doc.components || {};
const schemas = components.schemas || {};
const responses = components.responses || {};
const parameters = components.parameters || {};

// 3. Scan for dangling $ref references
const allRefs = [];
function findRefs(obj, currentPath = '') {
  if (!obj || typeof obj !== 'object') return;
  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') {
      allRefs.push({ ref: value, sourcePath: currentPath });
    } else if (typeof value === 'object') {
      findRefs(value, `${currentPath}.${key}`);
    }
  }
}
findRefs(doc);

console.log(`✓ Scanned $ref references: ${allRefs.length}`);

let refErrors = 0;
for (const { ref, sourcePath } of allRefs) {
  if (ref.startsWith('#/components/schemas/')) {
    const name = ref.replace('#/components/schemas/', '');
    if (!schemas[name]) {
      console.error(`Missing schema ref: ${ref} referenced at ${sourcePath}`);
      refErrors++;
    }
  } else if (ref.startsWith('#/components/responses/')) {
    const name = ref.replace('#/components/responses/', '');
    if (!responses[name]) {
      console.error(`Missing response ref: ${ref} referenced at ${sourcePath}`);
      refErrors++;
    }
  } else if (ref.startsWith('#/components/parameters/')) {
    const name = ref.replace('#/components/parameters/', '');
    if (!parameters[name]) {
      console.error(`Missing parameter ref: ${ref} referenced at ${sourcePath}`);
      refErrors++;
    }
  } else {
    console.error(`Unrecognized ref format: ${ref} at ${sourcePath}`);
    refErrors++;
  }
}

if (refErrors > 0) {
  console.error(`Validation Failed: ${refErrors} dangling references found.`);
  process.exit(1);
}

console.log('✓ All $ref targets resolved successfully!');
console.log('==========================================');
console.log('OpenAPI Specification is 100% Valid!');
console.log('==========================================');
