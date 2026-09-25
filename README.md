# scripted-skills

## Monthly birthdays

As a Tech in your friends circle, [`birthday-list`](birthday-list/SKILL.md) extracts birthdays from a local CSV or Google Sheets link using a Rust CLI. It defaults to the current month, sorts by birthday day, formats mailing addresses, flags issues, and adds Team and Generation columns.

```bash
cargo run --quiet --locked --manifest-path birthday-list/scripts/Cargo.toml -- contacts.csv
cargo run --quiet --locked --manifest-path birthday-list/scripts/Cargo.toml -- contacts.csv --month 10 --year 2026 --output birthdays-2026-10.csv
```

For a colored workbook with a legend, add `--output birthdays-2026-10.xlsx`. Data rows are pale green for Team, pale blue for Generation, and pale red for address issues, with red taking priority over blue over green. Fixed headers stay neutral. Import the XLSX into Sheets to preserve colors.

Requires Rust/Cargo; Sheets downloads also require curl. Private sheets can be exported to CSV locally. Run with `--help` for options. Dates are day-first with four-digit years. Existing outputs are protected unless `--overwrite` is supplied.

To make the skill available in Codex, link this repository's `birthday-list` folder into `~/.codex/skills/`. Then ask: “Use $birthday-list to pull next month's birthdays from contacts.csv.” This is an on-demand workflow, not a scheduled task.

Run validation:

```bash
cargo test --locked --manifest-path birthday-list/scripts/Cargo.toml
```
