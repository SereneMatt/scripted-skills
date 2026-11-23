# Core Web Vitals measurement

Use the page's existing telemetry or the official [`web-vitals`](https://github.com/GoogleChrome/web-vitals) library, preferably its attribution build. Record the installed version. Bundle it using the project's existing tooling or a temporary local harness; keep diagnostic instrumentation out of the shipped product unless requested.

## Budgets and interpretation

Default good targets are **LCP ≤2500ms**, **INP ≤200ms**, and **CLS ≤0.1**; preserve stricter acceptance criteria. [Google's Web Vitals guidance](https://web.dev/articles/vitals) assesses field performance at the 75th percentile, segmented by mobile and desktop. A few local runs establish a lab baseline and regressions; report field status as unknown unless representative field data is available.

Collect at least three comparable clean runs per selected device profile and report every sample plus the median and worst. Record production/development build, URL, viewport, browser/device, CPU/network profile, cache state, and tested interactions. Keep cold and warm results separate. Compare before/after under identical conditions. Lighthouse can support load diagnosis; its score or Total Blocking Time does not establish INP.

## Collection bridge for the overlay

Initialize a fresh collector on each full page load, before the tested interactions. Load the following through an early local harness entrypoint with `web-vitals` resolved by the bundler:

```js
import { onCLS, onINP, onLCP } from 'web-vitals/attribution';
window.__qaVitals = {};
const report = (metric) => {
  window.__qaVitals[metric.name] = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id
  };
  // Retain attribution and complete metrics in the harness's raw artifacts.
  console.debug('[qa-vital]', metric);
};
onLCP(report, { reportAllChanges: true });
onINP(report, { reportAllChanges: true });
onCLS(report, { reportAllChanges: true });
```

Capture console output or send reports to a local test collector so results survive navigation. Use the same collector without the overlay for clean performance runs. If early instrumentation cannot be installed, document late-collection limits or use an existing browser trace; avoid reporting a complete startup measurement from incomplete evidence. Check the browser supports the required performance entry types. An absent callback is unavailable, never zero or a pass.

Use trusted browser pointer/keyboard input for representative interactions (menu opening, filtering, typing, carousel controls, form submission). Scripted `.click()` and elapsed handler time do not measure INP. Record the tested journey and input method. Keep the page in the foreground; after the journey, transition it to hidden through real browser lifecycle controls and collect final callbacks before closing/navigating. A manual synthetic `visibilitychange` event does not finalize a real page lifecycle. Overlay values remain provisional snapshots.

## Diagnose measured failures

- **LCP:** retain the LCP element/resource and timing breakdown. Inspect server response, resource discovery/loading, and render delay; inspect the initial viewport before interaction. The QA overlay itself can contaminate LCP, which is why the clean run is authoritative.
- **INP:** retain the slow interaction target and input delay, processing time, and presentation delay. Repeat the affected trusted interaction under the same device/CPU profile. Missing interactions leave INP unverified.
- **CLS:** use the official library's maximum session-window calculation (gaps under 1 second, windows under 5 seconds, excluding recent-input shifts). A lifetime sum of shift values is not CLS. Inspect loading/hydration, images, fonts, and post-interaction content. `qa.shifts(root)` includes raw diagnostic entries, including recent-input shifts; source attribution can help locate a problem but is not a standardized per-element CLS score. Zero observed shifts covers only the tested duration and supported observation scope, not the entire site.

Keep the video journey representative, but collect performance without the overlay, focus outlines, hidden widgets, or recording overhead. If the UI evidence needs a hidden cookie banner, disclose that change and measure the normal page separately. Preserve the raw artifacts alongside the result table so failures can be reproduced.
