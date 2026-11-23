---
name: verify-ui-t3code-edition
description: Verify responsive UI acceptance criteria in T3 Code's preview, then record a video with measured pass/fail evidence.
disable-model-invocation: true
---

# Verify UI in T3 Code's preview

Prove UI behaviour with visible measurements in T3 Code's preview. The agent drives the preview step by step and records one video across all widths. Write checks for the actual acceptance criteria with the overlay in [metrics.js](scripts/metrics.js).

This edition does not measure Core Web Vitals. When the criteria include LCP, INP or CLS, use the `verify-ui-with-video` skill.

## 1. Define the evidence

Map every acceptance criterion to an observable, its stated unit, expected value, action, and viewport widths. Read breakpoints from source; include both sides (for example 719 and 720), one mobile width, and one wide width. Count “moves two cards” in card indices, allowing for snapping and end clamps. Include relevant empty, loading, error, disabled, keyboard focus, and overflow states.

Inspect the rendered page as well as DOM values: clipping, overlap, unreadable text, missing assets, and focus visibility need visual evidence. A matching DOM property alone cannot prove the UI looks correct. Mark subjective or inaccessible evidence as partial.

Done when every criterion has an evidence plan.

## 2. Prepare the preview

For local pages, start the server in the background with noninteractive flags/environment variables. Wait for HTTP 200 at the exact page URL.

Use `preview_open` with `reuseExistingTab: false` and `target: { kind: 'environment-port', port }`, then `preview_resize` with `freeform`. Confirm `innerWidth` using `preview_evaluate`; use measured widths. Discover the available tool signatures. If these tools are unavailable, use an available browser/recording equivalent and report any unsupported recording or input capability.

## 3. Write checks and the journey

Read [overlay setup and examples](references/overlay.md) when writing checks or installing the overlay. Keep one checks file in the scratchpad: it registers the criteria and returns the scripted part of the journey for one width. Use bounded waits and read final state after transitions and scrolling settle.

Keep the scratchpad as the source of truth when updating browser checks. Reinstall after navigation and wait for app readiness. Hide widgets that cover the evidence with `qa.hide`, and verify them separately when they are under test.

Done when every criterion has a check or an explicit manual visual/input step, and the script has bounded waits.

## 4. Dry run and inspect

For every width: resize → navigate to a fresh load → wait for readiness → install and run. Inspect frames for the visual criteria, use `preview_act` for hover, drag, focus, and real clicks, and log their measured outcomes with `qa.logSettled`.

Read state after transitions settle. Capture listeners can correlate click/scroll events with before/after values. To check drag-suppressed navigation, inspect `event.defaultPrevented` after dispatch and compare the URL. Preserve actual failure measurements; repair checks only when their observable or unit is wrong.

Done when each width has a result for every criterion: pass, real defect, or explicitly unverified. Pending is never a pass.

## 5. Record the evidence

Start `preview_recording_start`, then repeat the dry-run sequence for every width. Each width ends on its results line from `qa.run()`. Keep each measured state readable. Resizing must precede navigation so prior scroll state does not leak into the run.

The overlay may cover content. Frame the target so it remains visible; record a separate unobstructed view for covered visual details.

Done when the video visibly demonstrates each provable criterion and identifies partial evidence.

## 6. Deliver

Stop recording with `preview_recording_stop`, remove only aborted takes created by this run, and close the preview with `t3_preview_close` (or the available equivalent). Report:

- Video path and per-width UI results with measured values, expected values, and partial/unverified criteria.
- Every widget hidden for evidence.
- Real defects and criteria you could only partly prove.

If recording is unavailable, deliver screenshots and results and explicitly mark the video requirement incomplete.
