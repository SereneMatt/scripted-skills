# scripted-skills

Engineering skills backed by scripts for UI verification and performance measurement.

## verify-ui-with-web-vitals

[`verify-ui-with-web-vitals`](verify-ui-with-web-vitals/SKILL.md) runs one command that drives headless Chromium through Playwright. Pick it for any project and for CI: it needs only Node and a one-time `npm install` and `npx playwright install chromium` in the skill folder, and its exit code is 0 only when every criterion and every vital passes.

## verify-ui-t3code-edition

[`verify-ui-t3code-edition`](verify-ui-t3code-edition/SKILL.md) needs no separate Playwright or Chromium install. The agent drives T3 Code's built-in preview one tool call at a time and records one video across all widths. Pick it inside T3 Code when you don't want to install Playwright and Chromium. It does not measure Core Web Vitals though; use `verify-ui-with-web-vitals` for those.

| | `verify-ui-with-web-vitals` | `verify-ui-t3code-edition` |
| --- | --- | --- |
| Browser | Headless Chromium, launched by Playwright | T3 Code's preview |
| Driven by | Custom script | The agent, one preview tool call at a time |
| Video | One `.webm` per width | One recording across all widths |
| Result | Exit code 0 or 1, usable in CI | Report written by the agent |
| Setup | `npm install` and `npx playwright install chromium` in the skill folder | None beyond T3 Code; no separate Playwright or Chromium install |

