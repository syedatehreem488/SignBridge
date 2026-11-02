// Copies MediaPipe's WebAssembly files into public/ so the app works without a CDN
// (useful for demos in labs with weak internet). Runs automatically before dev/build.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
const src = 'node_modules/@mediapipe/tasks-vision/wasm';
const dest = 'public/mediapipe/wasm';
if (!existsSync(src)) {
  console.error('MediaPipe not installed - run npm install first');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('Copied MediaPipe wasm to', dest);