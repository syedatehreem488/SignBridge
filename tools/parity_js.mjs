// Helper for parity_test.py: computes features with the REAL web/src/lib/landmarks.js.
// Usage (called automatically): node tools/parity_js.mjs input.json output.json
import { readFileSync, writeFileSync } from 'node:fs';
import { staticFeatures, dynamicFeatures } from '../web/src/lib/landmarks.js';

const [input, output] = process.argv.slice(2);
const cases = JSON.parse(readFileSync(input, 'utf8'));
const result = cases.map((c) => ({
  static: staticFeatures(c.frames[0]),
  dynamic: dynamicFeatures(c.frames),
}));
writeFileSync(output, JSON.stringify(result));