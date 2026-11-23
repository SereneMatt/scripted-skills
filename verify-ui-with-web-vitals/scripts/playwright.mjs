import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const bases = [skillDir, process.cwd()];
export const setupHint = `Run \`npm install\` and \`npx playwright install chromium\` in ${skillDir}.`;

export const loadChromium = () => {
  for (const base of bases) {
    for (const name of ['playwright', '@playwright/test']) {
      try {
        return createRequire(path.join(base, 'index.js'))(name).chromium;
      } catch {}
    }
  }
  console.error(`Playwright not found. ${setupHint}`);
  process.exit(2);
};
