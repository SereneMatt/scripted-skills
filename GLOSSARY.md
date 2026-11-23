# Scripted skills

Agent skills backed by scripts. The UI verification skills prove acceptance criteria with recorded, on-screen evidence.

## UI verification

**T3 Code edition**:
The edition that needs no separate browser tools: the agent drives T3 Code's built-in preview tools step by step.
_Avoid_: T3 version, preview edition

**Playwright edition**:
The edition where a Playwright runner script drives headless Chromium. This is the default edition.
_Avoid_: Headless edition, CLI edition

**Evidence run**:
A recorded run that proves criteria on screen. It never measures Core Web Vitals.
_Avoid_: Recording run, video run

**Criterion**:
One acceptance criterion, stated in its own unit, that the run must prove or mark as partial.
_Avoid_: Requirement, assertion
