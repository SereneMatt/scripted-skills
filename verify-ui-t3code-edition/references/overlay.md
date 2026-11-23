# Overlay setup and examples

Read this when writing checks, installing the overlay, or choosing a helper API. The reusable implementation lives in [verify.js](../scripts/verify.js). For the vitals collector, read [Core Web Vitals measurement](performance.md).

## Setup and example

Keep one setup function in a scratchpad file. It registers checks and returns an async script for one width. If a third-party widget obscures the UI, first insert a narrowly scoped stylesheet for the evidence run and disclose it. Verify consent UI separately if it is under test; keep the clean performance run representative.

```js
(qa) => {
  const row = document.querySelector('[data-cards]');
  const next = document.querySelector('[data-next]');
  if (!row || !next) throw new Error('Missing carousel controls');
  qa.focus(row);
  qa.onLoad('start', () => ({
    pass: qa.firstFullyVisible(row) === 0,
    detail: `first fully visible card: ${qa.firstFullyVisible(row)} (zero-based)`
  }));
  qa.check('overflow', () => ({
    pass: document.documentElement.scrollWidth <= innerWidth,
    detail: `${document.documentElement.scrollWidth}px content / ${innerWidth}px viewport`
  }));
  // Register only when the collector described in the reference is installed.
  for (const name of ['LCP', 'INP', 'CLS']) qa.check(name, () => qa.vital(name));
  return async () => {
    qa.step(`${qa.width}px · initial state`);
    await qa.sleep(1500);
    qa.step(`${qa.width}px · next card`);
    const started = performance.now();
    let position = row.scrollLeft;
    let stableSince = started;
    next.click();
    // Allow scrolling to start, then require 200ms of stable position.
    while (true) {
      await qa.sleep(50);
      const now = performance.now();
      if (row.scrollLeft !== position) {
        position = row.scrollLeft;
        stableSince = now;
      }
      if (now - started >= 3000) throw new Error('Carousel did not settle within 3s');
      if (now - started >= 300 && now - stableSince >= 200) break;
    }
    await qa.logSettled('next', () => ({
      pass: qa.firstFullyVisible(row) === 1,
      detail: `first fully visible card: ${qa.firstFullyVisible(row)}; expected 1`
    }));
    await qa.sleep(1500);
  };
};
```

Adapt the expected index to the actual criterion. For animated scrolling, wait for a bounded `scrollend` or stable scroll position before reading the final index; animation settling alone does not cover smooth scrolling.

Install in one evaluation: assign the scratchpad function's source to `sessionStorage.qaChecks`, remove `qaResults`, then execute the full contents of `../scripts/verify.js`. The helper stores its own source in `sessionStorage.verifyWithVideo`.

After each same-origin navigation, reinstall and run in one evaluation:

```js
new Function(sessionStorage.verifyWithVideo)();
await qa.run();
```

Wait for the app's ready condition before this call. A different origin requires reinstalling both sources. Edit the scratchpad, then resend it; browser-only patches leave stale checks. Clear results between dry run and recording with `qa.reset()`.

## Overlay API

| Call | Evidence |
| --- | --- |
| `qa.check(label, evaluate)` | Live `{ pass, detail }` line, sampled every 250ms; snapshot recorded at script completion. Use `logSettled` for intermediate states. |
| `qa.onLoad(key, evaluate)` | Settled initial-state measurement; awaited before the script. |
| `qa.logSettled(key, evaluate)` | Settled action measurement, recorded in results; repeated keyed failures persist. |
| `qa.log(text, pass?, key?)` | Event log; provide a key to persist a result. |
| `qa.run()`, `qa.table()` | Run the journey and return the cross-width summary; read the current summary. |
| `qa.vital(name)` | Read `window.__qaVitals` collector data; unavailable metrics remain pending. |
| `qa.firstFullyVisible(scroller)` | Zero-based child index with both horizontal edges in view, or -1. |
| `qa.shifts(root)` | Buffered raw layout-shift entries attributed to root descendants; diagnostic only, not CLS. |
| `qa.color(el)`, `qa.background(el)`, `qa.contrast(fg, bg)` | Simple opaque RGB contrast helper; use a dedicated tool for alpha, gradients, images, or other colour spaces. Compare the unrounded ratio with the criterion. |
| `qa.focus(el)`, `qa.step(text)` | Outline/scroll target below headers; set visible step heading. |
| `qa.settle()`, `qa.sleep(ms)` | Await finite animations or pacing; bound application-specific waits separately. |
| `qa.record(key, pass)`, `qa.reset()` | Write one result or clear the stored table. |
| `qa.width`, `qa.ok(pass)` | Width at installation; status mark (`⏳` for unavailable). |
