#!/usr/bin/env node
// Playwright's bundled ffmpeg only encodes, so frames are read back by seeking the video in Chromium.
import { readFile } from 'node:fs/promises';
import { loadChromium } from './playwright.mjs';

const [video, seconds, out] = process.argv.slice(2);
if (!video || seconds === undefined || !out) {
  console.error('Usage: node frame.mjs <video.webm> <seconds|end> <out.png>');
  process.exit(2);
}

const chromium = loadChromium();
const timeoutMs = 10_000;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<style>body{margin:0;background:#000}</style><video muted></video>');
  // A blob URL is seekable and avoids about:blank being refused file:// access.
  const base64 = (await readFile(video)).toString('base64');
  const size = await page.evaluate(async ([data, at, timeoutMs]) => {
    const element = document.querySelector('video');
    const next = (event, action) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`video did not fire ${event} within ${timeoutMs}ms`)), timeoutMs);
        element.addEventListener(event, () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
        element.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Chromium could not decode the video'));
        };
        action();
      });
    const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
    await next('loadeddata', () => (element.src = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }))));
    // MediaRecorder-style WebM files can report an infinite duration until the end has been seeked once.
    if (!Number.isFinite(element.duration)) {
      await next('durationchange', () => (element.currentTime = 1e9));
    }
    const target = at === 'end' ? Math.max(0, element.duration - 0.05) : Math.min(Number(at), element.duration);
    await next('seeked', () => (element.currentTime = target));
    return { width: element.videoWidth, height: element.videoHeight };
  }, [base64, seconds, timeoutMs]);
  await page.setViewportSize(size);
  await page.locator('video').screenshot({ path: out });
} finally {
  await browser.close();
}
console.log(out);
