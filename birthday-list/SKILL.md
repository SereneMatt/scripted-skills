---
name: birthday-list
description: Pull a monthly birthday list from a contacts CSV or Google Sheets link, sort birthdays, format mailing addresses, and flag address issues using Rust.
---

# Monthly birthday list

Use the Rust CLI bundled in `scripts/`. Ask for the contacts CSV path or Google Sheets link if none is available. Default to the current local month; resolve “next month” to an explicit month and year, including December rollover.

Run from any directory, replacing `<skill>` with this skill's absolute directory:

```bash
cargo run --quiet --locked --manifest-path <skill>/scripts/Cargo.toml -- contacts.csv
cargo run --quiet --locked --manifest-path <skill>/scripts/Cargo.toml -- 'https://docs.google.com/spreadsheets/d/FILE_ID/edit#gid=0' --month 10 --year 2026 --output birthdays-2026-10.csv
```

Requires Rust/Cargo and, for Sheets downloads, `curl`. First build downloads Cargo dependencies. If Cargo is absent from PATH, check `~/.cargo/bin/cargo` before proposing installation.

The source is read only. Sheets must already allow unauthenticated CSV export; for private sheets request a local CSV export instead of changing sharing permissions. Do not upload contacts or write back to Sheets as part of pulling a list.

The CLI filters by birth month, sorts by birthday day, preserves original columns, replaces addresses with in-cell line breaks, labels the formatted address column `Address`, and places Notes, Team (nonempty department), and Generation (age 0–15 on the run date) before the original columns, in that order. Notes contains address issue explanations; no separate justification column is added. `--year` names the reporting period; it does not change the age reference date. Use `--as-of YYYY-MM-DD` for reproducible ages. Invalid, ambiguous two-digit-year, or future DOBs are reported to stderr and omitted from monthly results. Use `--all` to process all rows, with invalid dates last. Dates are day-first with `/`, `.`, or `-` separators and four-digit years.

Flags `--no-sort`, `--no-check`, and `--no-split` disable the corresponding original workflow steps. Output defaults to `birthdays-YYYY-MM.csv` (or `contacts-processed.csv` with `--all`). Existing output is refused unless `--overwrite` is explicitly supplied; never overwrite the source. Address checks are heuristics, not postal validation. Do not flag missing or unrecognized countries. Write Notes messages in sentence case, not uppercase.

Report the output path, number of included contacts, omitted DOB count, and address issue summary without dumping contact details into chat. No matching birthdays still produces a CSV header. Missing DOB columns are errors for monthly extraction. Missing address columns skip address processing with a warning.

For Google Sheets, import the resulting CSV into a new sheet; quoted multiline fields preserve address line breaks. Running this skill each month is on demand; it does not install a scheduler.

## Colored workbook

For color highlighting, supply `--output birthdays-YYYY-MM.xlsx`. CSV cannot retain colors. Excel output includes a Birthdays sheet and a Legend sheet. Use very pale green (`#F3FAF0`) for Team=Yes rows, very pale blue (`#EFF7FD`) for Generation=Yes rows (age 0–15), and very pale red (`#FDEEEE`) for rows with address issues. Fill the entire data row; keep fixed headers neutral. When categories overlap, use red before blue before green, and explain this priority in the legend. Missing countries do not trigger red. The legend labels are Team people, Next Generation (15 and younger), and Invalid address; address flags are suggestions for review.

Import the XLSX into Google Sheets to retain formatting. Direct formatting of a linked sheet requires a confirmed editing connection and a user request to modify that sheet; a public CSV link alone cannot write formatting.
