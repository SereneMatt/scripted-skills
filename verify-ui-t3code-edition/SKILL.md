---
name: verify-ui-t3code-edition
description: Verify responsive UI acceptance criteria and Core Web Vitals, then record a preview video with measured pass/fail evidence.
disable-model-invocation: true
---

# Verify UI with video

Prove UI behaviour with visible measurements and assess loading, responsiveness, and visual stability with Core Web Vitals. Use the [overlay helper](scripts/verify.js); write checks for the actual acceptance criteria. A video demonstrates the tested journey; performance conclusions come from measurements.

## 1. Define the evidence

Map every acceptance criterion to an observable, its stated unit, expected value, action, and viewport widths. Read breakpoints from source; include both sides (for example 719 and 720), one mobile width, and one wide width. Count “moves two cards” in card indices, allowing for snapping and end clamps. Include relevant empty, loading, error, disabled, keyboard focus, and overflow states.

Inspect the rendered page as well as DOM values: clipping, overlap, unreadable text, missing assets, and focus visibility need visual evidence. A matching DOM property alone cannot prove the UI looks correct. Mark subjective or inaccessible evidence as partial.

Read [Core Web Vitals measurement](references/performance.md) before preparing runs. Define LCP, INP, and CLS budgets, representative interactions, and test conditions. Done when every criterion has an evidence plan and each vital has a measurement method or an explicit unavailable reason.

## 2. Prepare the browser and performance baseline

For local pages, start the server in the background with noninteractive flags/environment variables. Wait for HTTP 200 at the exact page URL. Use a production build for performance where available; label development-server measurements.

In T3 Code, use `preview_open` with `reuseExistingTab: false` and `target: { kind: 'environment-port', port }`, then `preview_resize` with `freeform`. Confirm `innerWidth` using `preview_evaluate`; use measured widths. Discover the available tool signatures. If these tools are unavailable, use an available browser/recording equivalent and report any unsupported recording or input capability.

Measure a baseline on a clean page before adding the overlay or recording. Install the performance collector before navigation/first interaction as described in the reference. Keep URL, build, browser, viewport, CPU/network throttling, and cache state with the raw results. Done when the baseline has measurements or explicit gaps for all three vitals.

## 3. Write checks and the journey

Read [overlay setup and examples](references/overlay.md) when writing checks or installing the helper. Keep one setup function in a scratchpad file: it registers the criteria and returns the journey for one width. Use bounded waits and read final state after transitions and scrolling settle.

Keep the scratchpad as the source of truth when updating browser checks. Reinstall after navigation, wait for app readiness, and clear dry-run results before recording. Disclose widgets hidden for evidence and verify them separately when they are under test.

Done when every criterion has a check or an explicit manual visual/input step, and the script has bounded waits.

## 4. Dry run and inspect

For every width: resize → navigate to a fresh load → wait for readiness → reinstall and run. Inspect frames for the visual criteria, use real pointer and keyboard tools for hover, drag, focus, and responsiveness, and log their measured outcomes with `qa.logSettled`. `element.click()` is useful for deterministic UI state checks; it does not generate trusted Event Timing interactions for INP.

Read state after transitions settle. Capture listeners can correlate click/scroll events with before/after values. To check drag-suppressed navigation, inspect `event.defaultPrevented` after dispatch and compare the URL. Preserve actual failure measurements; repair checks only when their observable or unit is wrong.

Done when each width has a result for every criterion: pass, real defect, or explicitly unverified. Pending/unavailable is never a pass. Investigate performance budget failures using attribution and repeat comparable clean runs after fixes within the authorized scope.

## 5. Record the evidence

Start `preview_recording_start`, repeat the dry-run sequence for every width, and end on a summary step with `qa.table()`. Keep each measured state readable. Resizing must precede navigation so prior scroll state does not leak into the run. Real hover/drag/keyboard actions can be driven with `preview_act` between evaluations, followed by `qa.logSettled`.

The overlay adds rendering work and may cover content. Frame the target so it remains visible; record a separate unobstructed view for covered visual details. Use clean, unrecorded runs for reported performance budgets, and label any overlay vitals as provisional local samples.

Done when the video visibly demonstrates each provable criterion and identifies partial evidence.

## 6. Deliver

Stop recording with `preview_recording_stop`, remove only aborted takes created by this run, and close the preview with `t3_preview_close` (or the available equivalent). Report:

- Video path and per-width UI results with measured values, expected values, and partial/unverified criteria.
- LCP/INP/CLS values, budgets, run count, test conditions, and clean-run artifacts; compare with the baseline when fixes were made.
- Real defects, unsupported metrics, and remaining field-validation needs.

If recording is unavailable, deliver screenshots and results and explicitly mark the video requirement incomplete.
