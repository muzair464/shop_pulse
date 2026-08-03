/**
 * build.mjs — production build script for ShopPulse frontend.
 *
 * Reads API_URL from the system environment (set in Vercel dashboard as an
 * environment variable) and injects it into the Angular bundle at compile
 * time via esbuild's --define flag.
 *
 * Vercel sets the build command to "node build.mjs" (via package.json "build").
 * Local dev uses "npm run build:dev" which talks to localhost:3000 directly
 * via the fallback in api.client.ts — no define needed for dev.
 *
 * Usage:
 *   API_URL=https://your-api.vercel.app npm run build
 */

import { execSync } from 'child_process';

const apiUrl = process.env['API_URL'] ?? 'https://shop-pulse-api.vercel.app';

// Validate — catch a missing or obviously wrong value before wasting a build.
try {
  new URL(apiUrl);
} catch {
  console.error(`[build.mjs] API_URL is not a valid URL: "${apiUrl}"`);
  console.error('Set the API_URL environment variable to your backend URL.');
  process.exit(1);
}

// Wrap in JSON so the define value is a proper quoted string literal that
// esbuild replaces verbatim in the source — e.g.  API_URL → "https://..."
const defineValue = JSON.stringify(apiUrl);  // produces: "https://..."

const cmd = `npx ng build --configuration production --define "API_URL=${defineValue}"`;

console.log(`[build.mjs] Building with API_URL=${apiUrl}`);
console.log(`[build.mjs] Running: ${cmd}`);

execSync(cmd, { stdio: 'inherit' });
