# Overlay setup and examples

Read this when writing checks, installing the overlay, or choosing a helper API. The implementation lives in [metrics.js](../scripts/metrics.js); always install it in evidence mode.

## Checks file

One function expression in a scratchpad file. It registers checks and may return an async journey for the scripted parts of one width.

```js
(qa) => {
  const row = document.querySelector('[data-cards]');
  const prev = document.querySelector('[data-prev]');
  if (!row || !prev) {
    throw new Error('Missing carousel controls');
  }
  qa.hide('#cookie-banner');
  qa.focus(row);
  qa.onLoad('start', () => ({ pass: prev.disabled, detail: `card #${qa.firstFullyVisible(row)}` }));
  qa.check('overflow', () => ({
    pass: document.documentElement.scrollWidth <= innerWidth,
    detail: `${document.documentElement.scrollWidth}px content / ${innerWidth}px viewport`
  }));
  return async () => {
    qa.step(`${qa.width}px · start`);
    await qa.sleep(1500);
  };
}
```

## Install

After each navigation and readiness wait, install in one `preview_evaluate`. Replace `METRICS` with the full contents of `metrics.js` and `CHECKS` with the checks file. Both contain template literals, so wrap them in a function rather than a string:

```js
const install = () => (METRICS)(CHECKS, 'evidence');
sessionStorage.qaInstall = `(${install})()`;
install();
```

After a later same-origin navigation, reinstall without resending either source:

```js
new Function(sessionStorage.qaInstall)();
```

A different origin, or an edited checks file, needs the full install again. Browser-only patches leave stale checks.

## Trusted input

`qa.act` is wired only by the Playwright runner, so do not call it here. Drive real input with `preview_act` between evaluations:

1. `preview_evaluate`: ``qa.step(`${qa.width}px · click Next`)``
2. `preview_act` the click, hover, drag or key press.
3. `preview_evaluate` the outcome:

```js
qa.sleep(300).then(() =>
  qa.logSettled('next', () => {
    const index = qa.firstFullyVisible(document.querySelector('[data-cards]'));
    return { pass: index === 1, detail: `card #${index}` };
  })
)
```

For smooth scrolling, wait for a bounded `scrollend` or a stable scroll position before reading the index; `qa.settle()` covers animations, not scrolling.

## Finish a width

Evaluate `qa.run()` last. It waits for the on-load checks, runs the returned journey, records every live check, shows the width's results line, and returns the results object. Results live on the page, so keep each width's return value for the report.

## Overlay API

| Call | Use |
| --- | --- |
| `qa.check(label, () => ({ pass, detail }))` | Live line, evaluated every frame and recorded by `qa.run()`; shows ⏳ while a finite animation runs |
| `qa.onLoad(key, () => ({ pass, detail }))` | Evaluated once after transitions settle, before the journey starts; recorded |
| `qa.logSettled(key, () => ({ pass, detail }))` | Waits for transitions to settle, then logs and records; use for every state read after an action |
| `qa.hide(selector)` | Hide a covering widget and disclose it on screen |
| `qa.log(text, pass?, key?)` | Event log line; with a `key` it is also recorded, and a recorded ❌ stays ❌ |
| `qa.run()`, `qa.table()` | Finish the width and return its results; read the current results line |
| `qa.color(el)`, `qa.background(el)`, `qa.contrast(fg, bg)` | Text colour, first fully opaque ancestor background, unrounded WCAG ratio for opaque RGB |
| `qa.firstFullyVisible(scroller)` | Index of the first child with both edges in view, or -1: the card unit for carousels |
| `qa.settle()` | Resolves once finite animations finish; rejects after 5s |
| `qa.step(text)`, `qa.focus(el)` | Step heading; outline `el` and scroll it below any sticky header |
| `qa.shifts(root)` | Raw layout-shift entries from page load whose sources are inside `root`; diagnostic only |
| `qa.record(key, pass)`, `qa.sleep(ms)`, `qa.width`, `qa.ok(pass)` | Write a result, pacing, width at install, ✅/❌/⏳ |
