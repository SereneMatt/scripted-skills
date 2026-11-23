#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { bases, loadChromium, setupHint, skillDir } from './playwright.mjs';

const usage = `Usage: node record.mjs --url <url> --widths <390,1280> --checks <checks.js> [--wait-for <selector>] [--out <dir>] [--height <px>] [--timeout <ms>] [--runs <n>] [--throttle] [--budget-lcp <ms>] [--budget-inp <ms>] [--budget-cls <score>] [--no-video]`;

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    widths: { type: 'string' },
    checks: { type: 'string' },
    'wait-for': { type: 'string' },
    out: { type: 'string', default: 'verify-videos' },
    height: { type: 'string', default: '900' },
    timeout: { type: 'string', default: '60000' },
    runs: { type: 'string', default: '3' },
    throttle: { type: 'boolean', default: false },
    'budget-lcp': { type: 'string', default: '2500' },
    'budget-inp': { type: 'string', default: '200' },
    'budget-cls': { type: 'string', default: '0.1' },
    'no-video': { type: 'boolean', default: false }
  }
});

if (!values.url || !values.widths || !values.checks) {
  console.error(usage);
  process.exit(2);
}

// web-vitals does not export its IIFE build, so locate the package folder the way Node resolution walks node_modules.
const findPackage = (name) => {
  for (const base of bases) {
    for (let dir = base; ; dir = path.dirname(dir)) {
      const candidate = path.join(dir, 'node_modules', name);
      if (existsSync(path.join(candidate, 'package.json'))) {
        return candidate;
      }
      if (dir === path.dirname(dir)) {
        break;
      }
    }
  }
  console.error(`${name} not found. ${setupHint}`);
  process.exit(2);
};

// Both files hold one function expression; a trailing `;` would break wrapping them in a call.
const readExpression = async (file) => (await readFile(file, 'utf8')).trim().replace(/;$/, '');
const overlaySource = await readExpression(path.join(skillDir, 'scripts', 'overlay.js'));
const checksSource = await readExpression(values.checks);

const webVitalsDir = findPackage('web-vitals');
const webVitalsVersion = JSON.parse(await readFile(path.join(webVitalsDir, 'package.json'), 'utf8')).version;
// One init script, because Playwright does not guarantee the order of several.
const vitalsScript = `${await readFile(path.join(webVitalsDir, 'dist', 'web-vitals.iife.js'), 'utf8')}
;(() => {
  window.__qaVitals = {};
  const report = (metric) => { window.__qaVitals[metric.name] = metric.value; };
  webVitals.onLCP(report, { reportAllChanges: true });
  webVitals.onINP(report, { reportAllChanges: true });
  webVitals.onCLS(report, { reportAllChanges: true });
})();`;

const widths = values.widths.split(',').map(Number);
const height = Number(values.height);
const timeout = Number(values.timeout);
const runs = Number(values.runs);
const recordVideo = !values['no-video'];
const budgets = {
  LCP: Number(values['budget-lcp']),
  INP: Number(values['budget-inp']),
  CLS: Number(values['budget-cls'])
};

// Lighthouse's mobileSlow4G preset, with the DevTools adjustments Lighthouse applies for protocol-level throttling.
const throttle = { cpu: 4, latencyMs: 562.5, downloadKbps: 1474.56, uploadKbps: 675 };
const applyThrottle = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle.cpu });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: throttle.latencyMs,
    downloadThroughput: (throttle.downloadKbps * 1024) / 8,
    uploadThroughput: (throttle.uploadKbps * 1024) / 8
  });
};

const openPage = async (context) => {
  const page = await context.newPage();
  await page.exposeFunction('qaAct', async (action, selector, target) => {
    const actions = {
      click: () => page.click(selector),
      hover: () => page.hover(selector),
      drag: () => page.dragAndDrop(selector, target),
      press: () => page.keyboard.press(selector)
    };
    if (!actions[action]) {
      throw new Error(`qa.act: unknown action "${action}"`);
    }
    await actions[action]();
  });
  return page;
};

const runJourney = async (page, mode) => {
  await page.goto(values.url, { waitUntil: 'load' });
  if (values['wait-for']) {
    await page.waitForSelector(values['wait-for'], { state: 'attached', timeout });
  }
  // A string evaluate runs through CDP, so a page Content-Security-Policy that blocks eval does not apply.
  await page.evaluate(`(${overlaySource})(${checksSource}, ${JSON.stringify(mode)})`);
  let timer;
  const timedOut = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`checks did not finish within ${timeout}ms`)), timeout);
  });
  return Promise.race([page.evaluate('window.qa.run()'), timedOut]).finally(() => clearTimeout(timer));
};

const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const format = (name, value) => (name === 'CLS' ? value.toFixed(3) : `${Math.round(value)}ms`);
const budgetText = (name) => (name === 'CLS' ? `≤${budgets.CLS}` : `≤${budgets[name]}ms`);

const summarise = (samples) =>
  Object.keys(budgets).map((name) => {
    const measured = samples.map((sample) => sample[name]).filter(Number.isFinite);
    if (measured.length < samples.length || measured.length === 0) {
      return { name, pass: false, text: `${name} unavailable in ${samples.length - measured.length}/${samples.length} runs ${budgetText(name)} ❌` };
    }
    const mid = median(measured);
    const pass = mid <= budgets[name];
    return {
      name,
      pass,
      text: `${name} ${format(name, mid)} median / ${format(name, Math.max(...measured))} worst ${budgetText(name)} ${pass ? '✅' : '❌'}`
    };
  });

const chromium = loadChromium();
let browser;
try {
  browser = await chromium.launch();
} catch (error) {
  console.error(`Chromium did not launch: ${error.message.split('\n')[0]}\n${setupHint}`);
  process.exit(2);
}
const conditions = [
  `${runs} clean runs (no overlay, no recording, cold cache)`,
  values.throttle
    ? `throttled: CPU ${throttle.cpu}×, ${throttle.latencyMs}ms latency, ${throttle.downloadKbps}/${throttle.uploadKbps} Kbps`
    : 'not throttled',
  `headless Chromium ${browser.version()}`,
  `web-vitals ${webVitalsVersion}`
].join(' · ');

const rows = [];
try {
  if (recordVideo) {
    await mkdir(values.out, { recursive: true });
  }

  for (const width of widths) {
    const viewport = { width, height };

    const samples = [];
    for (let run = 0; run < runs; run++) {
      const context = await browser.newContext({ viewport });
      const page = await openPage(context);
      try {
        if (values.throttle) {
          await applyThrottle(page);
        }
        await page.addInitScript({ content: vitalsScript });
        await runJourney(page, 'clean');
        // Event Timing entries arrive after the next paint, so INP needs a moment after the last input.
        await page.waitForTimeout(1000);
        samples.push(await page.evaluate('window.__qaVitals'));
      } catch (error) {
        samples.push({});
        console.error(`${width}px clean run ${run + 1}: ${error.message}`);
      }
      await context.close();
    }
    const vitals = summarise(samples);

    const context = await browser.newContext({
      viewport,
      ...(recordVideo ? { recordVideo: { dir: values.out, size: viewport } } : {})
    });
    const page = await openPage(context);
    let results;
    try {
      results = await runJourney(page, 'evidence');
      await page.evaluate(
        ([step, text]) => {
          window.qa.step(step);
          window.qa.summary(text);
        },
        [
          `${width}px · Core Web Vitals, measured in clean runs, not in this video`,
          [conditions, ...vitals.map((vital) => vital.text)].join('\n')
        ]
      );
      await page.waitForTimeout(3000);
    } catch (error) {
      results = { error: false };
      console.error(`${width}px evidence run: ${error.message}`);
    }

    const video = page.video();
    await context.close();
    let videoPath;
    if (video) {
      videoPath = path.resolve(values.out, `${width}px.webm`);
      await video.saveAs(videoPath);
      await video.delete();
    }
    rows.push({ width, results, vitals, videoPath });
  }
} catch (error) {
  console.error(`Runner failed: ${error.message}`);
  await browser.close();
  process.exit(2);
}
await browser.close();

let failed = false;
console.log(conditions);
for (const { width, results, vitals, videoPath } of rows) {
  const entries = Object.entries(results);
  failed ||= entries.length === 0 || entries.some(([, pass]) => pass !== true) || vitals.some((vital) => !vital.pass);
  console.log(`${width}px  ${entries.map(([key, pass]) => `${key}${pass === true ? '✅' : '❌'}`).join(' ') || 'no results ❌'}`);
  for (const vital of vitals) {
    console.log(`       ${vital.text}`);
  }
  if (videoPath) {
    console.log(`       ${videoPath}`);
  }
}
process.exit(failed ? 1 : 0);
