# Flip squares

An 8×8 checkerboard where hovering a square flips it between black and white. Reset restores the board. It is a showcase for [`verify-ui-with-web-vitals`](../../verify-ui-with-web-vitals/SKILL.md): [checks.js](checks.js) proves the criteria below, and [videos](videos) holds the evidence runs at 390px and 1440px.

| Criterion | Check |
| --- | --- |
| The board loads as a checkerboard | `checkerboard` |
| Hovering a black square turns it white | `black→white` |
| Hovering a white square turns it black | `white→black` |
| Leaving a square and hovering it again flips it back | `re-hover flips` |
| Squares the pointer never entered keep their colour | `others unchanged` |
| Reset restores the checkerboard | `reset` |
| The board fits the viewport without horizontal overflow | `fits viewport` |

Reset exists so the journey has a click: INP measures clicks, taps and key presses, not hovers.

## Re-run

From the repository root, after the skill's one-time setup:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory examples/flip-squares &
node verify-ui-with-web-vitals/scripts/record.mjs --url http://127.0.0.1:4173/ --widths 390,1440 \
  --checks examples/flip-squares/checks.js --wait-for '[data-square]' --throttle --out examples/flip-squares/videos
```
