# Scripted skills

Agent skills backed by scripts. The UI verification skills prove acceptance criteria with recorded, on-screen evidence.

## UI verification

**Edition**:
One implementation of the UI verification skill, defined by the browser driver it uses. Editions share the same evidence model and overlay API.
_Avoid_: Version, variant, flavour

**T3 Code edition**:
The edition where the agent drives T3 Code's preview tools step by step.
_Avoid_: T3 version, preview edition

**Playwright edition**:
The edition where a Playwright runner script drives headless Chromium. This is the default edition.
_Avoid_: Headless edition, CLI edition

**Overlay**:
The on-page panel that shows each criterion's measured value and its pass/fail mark while the video records.
_Avoid_: HUD, banner

**Evidence run**:
A recorded run that proves criteria on screen. It never measures Core Web Vitals.
_Avoid_: Recording run, video run

**Clean run**:
An unrecorded run of the same journey with nothing added to the page except the vitals collector. It is the only source of Core Web Vitals.
_Avoid_: Baseline run, perf run, benchmark

**Criterion**:
One acceptance criterion, stated in its own unit, that the run must prove or mark as partial.
_Avoid_: Requirement, assertion
