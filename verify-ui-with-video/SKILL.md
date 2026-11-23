---
name: verify-ui-with-video
description: Record headless Playwright videos, one per viewport width, that prove a page meets its acceptance criteria with a live pass/fail overlay, and measure Core Web Vitals in separate clean runs.
disable-model-invocation: true
---

# Verify UI with video

Record one video per width in which every acceptance criterion is **verifiable** from the frames alone: a viewer reads the measured value and its ✅/❌ on screen, without trusting the narration. Core Web Vitals come from **clean runs** of the same journey, with nothing on the page except the vitals collector.

`scripts/record.mjs` drives headless Chromium. For each width it runs the clean runs first, then the **evidence run**: it injects `scripts/overlay.js` and your checks after each page load, records `<width>px.webm`, and ends the video on the clean-run vitals. The checks for each task are yours to write.

## 1. Set up once

In this skill's folder: `npm install`, then `npx playwright install chromium`. The runner resolves `playwright` and `web-vitals` from this folder first, then from the working directory.

Done when both commands exit 0.

## 2. Map criteria to observables

For every criterion, write down:

- **Observable**: the DOM value that proves it (`scrollLeft`, `disabled`, a rect, `visibility`, `location.href`).
- **Unit**: the unit the criterion itself names. "Moves 2 cards" is counted in cards (the index of the first fully visible card), not pixels. A proxy unit logs false ❌ on correct behaviour, for example after scroll-snap or a clamp at the end.
- **Widths**: both sides of every breakpoint the criterion names (719 and 720), plus one mobile and one wide width. Read breakpoint values from source.

Include the empty, loading, error, disabled, focus and overflow states the criteria touch. Clipping, overlap and focus visibility need a frame, not only a DOM value; mark those partial until you have inspected one.

Done when every criterion has an observable, a unit and a width list.

## 3. Write the checks file

One function expression in a scratchpad file. It registers the checks, then returns the journey for one width. Drive every interaction with `qa.act`: it is trusted Playwright input, so it produces the interactions INP measures.

```js
(qa) => {
  qa.hide('#cookie-banner');
  const row = document.querySelector('[data-cards]');
  const prev = document.querySelector('[data-prev]');
  const next = document.querySelector('[data-next]');
  qa.focus(row);
  qa.onLoad('start', () => ({ pass: prev.disabled, detail: `card #${qa.firstFullyVisible(row)}` }));
  qa.check('Next contrast', () => {
    const ratio = qa.contrast(qa.color(next), qa.background(next));
    return { pass: ratio >= 3, detail: `${ratio.toFixed(2)}:1` };
  });

  return async () => {
    qa.step(`${qa.width}px · start`);
    await qa.sleep(1500);
    qa.step(`${qa.width}px · click Next`);
    const scrolled = new Promise((resolve) => row.addEventListener('scrollend', resolve, { once: true }));
    await qa.act('click', '[data-next]');
    await Promise.race([scrolled, qa.sleep(1500)]);
    await qa.logSettled('next', () => ({ pass: qa.firstFullyVisible(row) === 1, detail: `card #${qa.firstFullyVisible(row)}` }));
    await qa.sleep(1500);
  };
};
```

The same file runs in both modes. In a clean run `act`, `sleep`, `settle` and the measuring helpers work, and everything that touches the page or evaluates a check does nothing: `hide`, `focus`, `step`, `log`, `check`, `onLoad`; `logSettled` resolves `undefined`. Keep the journey's control flow independent of what those return.

Hide third-party widgets that cover the overlay or the element under test with `qa.hide(selector)`: the evidence run discloses it on screen and the clean runs keep the widget, so vitals measure the real page.

## 4. Dry run

```sh
node <skill-dir>/scripts/record.mjs --url <url> --widths 390,719,720,1440 --checks <checks.js> --wait-for '<selector>' --no-video
```

`--wait-for` is the element your checks query first. Client-rendered pages add it after the `load` event, so without it the checks run against an empty page.

Done when every width prints ✅ for every key and every vital, or each ❌ is a real defect you can explain in the criterion's unit. An unavailable vital is a ❌: INP needs at least one `qa.act` in the journey. The exit code is 0 only when everything passes.

## 5. Record and report

The same command without `--no-video`, plus `--out <dir>`. Read back the frames that carry visual criteria and the final vitals frame:

```sh
node <skill-dir>/scripts/frame.mjs <dir>/390px.webm <seconds|end> <frame.png>
```

Report each video path, the per-width results with measured values, the vitals medians, worst values and conditions line, every hidden widget, and each criterion you could only partly prove. The vitals are lab values under the printed conditions; Google assesses Core Web Vitals at the 75th percentile of real-user page loads.

## Runner options

| Option | Default | Use |
| --- | --- | --- |
| `--url`, `--widths`, `--checks` | required | Page, comma-separated widths, checks file |
| `--wait-for <selector>` | none | Wait until the element is in the DOM before injecting |
| `--out <dir>` | `verify-videos` | Where `<width>px.webm` goes |
| `--height <px>` | `900` | Viewport and video height |
| `--timeout <ms>` | `60000` | Per run; a journey that never finishes fails that run |
| `--runs <n>` | `3` | Clean runs per width; the report gives the median and worst |
| `--throttle` | off | Clean runs only: Lighthouse's mobile preset (CPU 4×, 562.5ms latency, 1474.56/675 Kbps) |
| `--budget-lcp`, `--budget-inp`, `--budget-cls` | `2500`, `200`, `0.1` | Budgets for the median; use the criterion's own when it is stricter |
| `--no-video` | off | Dry run |

## Overlay API

| Call | Use |
| --- | --- |
| `qa.check(label, () => ({ pass, detail }))` | Live line, evaluated every frame and recorded once the journey ends; shows ⏳ while a finite animation runs |
| `qa.onLoad(key, () => ({ pass, detail }))` | Evaluated once after transitions settle, before the journey starts; recorded |
| `qa.logSettled(key, () => ({ pass, detail }))` | Waits for transitions to settle, then logs and records; use for every state read after an action |
| `qa.act(action, selector, target?)` | Trusted input: `click`, `hover`, `drag` (to `target`), `press` (key name as `selector`) |
| `qa.hide(selector)` | Hide a covering widget in the evidence run and disclose it |
| `qa.log(text, pass?, key?)` | Event log line; with a `key` it is also recorded, and a recorded ❌ stays ❌ |
| `qa.color(el)`, `qa.background(el)`, `qa.contrast(fg, bg)` | Text colour, first fully opaque ancestor background, unrounded WCAG ratio for opaque RGB |
| `qa.firstFullyVisible(scroller)` | Index of the first child with both edges in view, or -1: the card unit for carousels |
| `qa.settle()` | Resolves once finite animations finish; rejects after 5s |
| `qa.step(text)`, `qa.focus(el)` | Step heading; outline `el` and scroll it below any sticky header |
| `qa.shifts(root)` | Raw layout-shift entries from page load whose sources are inside `root`; diagnostic, not CLS |
| `qa.record(key, pass)`, `qa.sleep(ms)`, `qa.width`, `qa.ok(pass)` | Write a result, pacing, width at load, ✅/❌/⏳ |

A throw while the checks load or the journey runs is recorded as a failing `setup` or `script` key.

## Reference

- **Real input**: `qa.act` waits until the element can take the input. An element hidden at a width makes it wait until `--timeout` fails the run; guard the call with a visibility check when hiding is expected.
- **Smooth scrolling**: `qa.settle()` covers animations, not scrolling. Wait for `scrollend` with a bounded fallback before reading a scroll position.
- **No layout shift**: `qa.shifts(section).length === 0` is the evidence for one section, because the observer is buffered from page load and so includes hydration. Page-level stability is the CLS vital.
