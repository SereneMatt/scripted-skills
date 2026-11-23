#!/usr/bin/env node
// Playwright's bundled ffmpeg only encodes, so frames are read back by seeking the video in Chromium.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [video, seconds, out] = process.argv.slice(2);
if (!video || seconds === undefined || !out) {
  console.error('Usage: node frame.mjs <video.webm> <seconds|end> <out.png>');
  process.exit(2);
}

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(skillDir, 'index.js'))('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<style>body{margin:0;background:#000}</style><video muted></video>');
// A blob URL is seekable and avoids about:blank being refused file:// access.
const base64 = (await readFile(video)).toString('base64');
const size = await page.evaluate(async ([data, at]) => {
  const element = document.querySelector('video');
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  await new Promise((resolve, reject) => {
    element.onloadeddata = resolve;
    element.onerror = () => reject(new Error('Chromium could not decode the video'));
    element.src = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }));
  });
  // MediaRecorder-style WebM files can report an infinite duration until the end has been seeked once.
  if (!Number.isFinite(element.duration)) {
    element.currentTime = 1e9;
    await new Promise((resolve) => (element.ondurationchange = resolve));
  }
  element.currentTime = at === 'end' ? Math.max(0, element.duration - 0.05) : Math.min(Number(at), element.duration);
  await new Promise((resolve) => (element.onseeked = resolve));
  return { width: element.videoWidth, height: element.videoHeight };
}, [base64, seconds]);
await page.setViewportSize(size);
await page.locator('video').screenshot({ path: out });
await browser.close();
console.log(out);
