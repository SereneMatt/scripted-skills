# scripted-skills

Engineering skills backed by scripts for UI verification and performance measurement. Both UI skills prove responsive acceptance criteria with a recorded pass/fail overlay and measure Core Web Vitals (LCP, INP, CLS).

## verify-ui-with-video

[`verify-ui-with-video`](verify-ui-with-video/SKILL.md) runs one command that drives headless Chromium through Playwright. Pick it for any project and for CI: it needs only Node, and its exit code is 0 only when every criterion and every vital passes. Vitals come from clean runs with nothing on the page, never from the recorded run.

## verify-ui-t3code-edition

[`verify-ui-t3code-edition`](verify-ui-t3code-edition/SKILL.md) has the agent drive T3 Code's preview tools step by step. Pick it inside T3 Code when you want to watch and steer the run in the preview pane.

| | `verify-ui-with-video` | `verify-ui-t3code-edition` |
| --- | --- | --- |
| Browser | Headless Chromium, launched by Playwright | T3 Code's preview |
| Driven by | `scripts/record.mjs`, one command | The agent, one preview tool call at a time |
| Video | One `.webm` per width | One recording across all widths |
| Core Web Vitals | `web-vitals` injected before page scripts, in clean runs | `web-vitals` bundled into the app's own build |
| Result | Exit code 0 or 1, usable in CI | Report written by the agent |
| Setup | `npm install` and `npx playwright install chromium` in the skill folder | T3 Code |

Other automations live in [`non-engineering`](non-engineering/README.md).
