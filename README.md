# scripted-skills

Engineering skills backed by scripts for UI verification and performance measurement.

## verify-ui-with-video

[`verify-ui-with-video`](verify-ui-with-video/SKILL.md) runs one command that drives headless Chromium through Playwright. Pick it for any project and for CI: it needs only Node and a one-time `npm install` and `npx playwright install chromium` in the skill folder, and its exit code is 0 only when every criterion and every vital passes.

## verify-ui-t3code-edition

[`verify-ui-t3code-edition`](verify-ui-t3code-edition/SKILL.md) has the agent drive T3 Code's preview tools step by step. Pick it inside T3 Code when you want to watch and steer the run in the preview pane, with no install. It does not measure Core Web Vitals; use `verify-ui-with-video` when the criteria include LCP, INP or CLS.

| | `verify-ui-with-video` | `verify-ui-t3code-edition` |
| --- | --- | --- |
| Browser | Headless Chromium, launched by Playwright | T3 Code's preview |
| Driven by | `scripts/record.mjs`, one command | The agent, one preview tool call at a time |
| Video | One `.webm` per width | One recording across all widths |
| Overlay | `scripts/overlay.js`; `qa.act` for trusted input | `scripts/metrics.js`, a copy of the same overlay; `preview_act` for trusted input |
| Result | Exit code 0 or 1, usable in CI | Report written by the agent |
| Setup | `npm install` and `npx playwright install chromium` in the skill folder | T3 Code |

Other automations live in [`non-engineering`](non-engineering/README.md).
