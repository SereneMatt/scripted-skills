use chrono::{Datelike, Local, NaiveDate};
use clap::Parser;
use regex::Regex;
use rust_xlsxwriter::{Format, Workbook};
use std::{
    collections::BTreeMap,
    error::Error,
    fs::{self, OpenOptions},
    path::PathBuf,
    process::Command,
};

type Result<T> = std::result::Result<T, Box<dyn Error>>;

#[derive(Parser)]
#[command(about = "Extract monthly birthdays and prepare mailing addresses")]
struct Args {
    /// Local UTF-8 CSV or Google Sheets share URL
    source: String,
    #[arg(long, value_parser = clap::value_parser!(u32).range(1..=12), conflicts_with = "all")]
    month: Option<u32>,
    #[arg(long, value_parser = clap::value_parser!(i32).range(1..=9999))]
    year: Option<i32>,
    #[arg(long)]
    all: bool,
    /// Output .csv or .xlsx (Excel includes colors and a legend)
    #[arg(long)]
    output: Option<PathBuf>,
    #[arg(long)]
    overwrite: bool,
    #[arg(long)]
    no_sort: bool,
    #[arg(long)]
    no_check: bool,
    #[arg(long)]
    no_split: bool,
    /// Reference date for ages, default local today
    #[arg(long)]
    as_of: Option<NaiveDate>,
}

fn col(headers: &[String], names: &[&str]) -> Option<usize> {
    headers
        .iter()
        .position(|h| names.contains(&h.trim().to_lowercase().as_str()))
}
fn dob(raw: &str) -> Option<NaiveDate> {
    let parts: Vec<_> = raw.trim().split(['/', '.', '-']).collect();
    if parts.len() != 3
        || parts[2].len() != 4
        || parts
            .iter()
            .any(|s| s.is_empty() || !s.bytes().all(|b| b.is_ascii_digit()))
    {
        return None;
    }
    NaiveDate::from_ymd_opt(
        parts[2].parse().ok()?,
        parts[1].parse().ok()?,
        parts[0].parse().ok()?,
    )
}
fn age(born: NaiveDate, today: NaiveDate) -> i32 {
    today.year()
        - born.year()
        - i32::from((today.month(), today.day()) < (born.month(), born.day()))
}
fn export_url(source: &str) -> Result<String> {
    let re = Regex::new(r"^https://docs\.google\.com/spreadsheets/d/([A-Za-z0-9_-]+)(?:/|\?|#|$)")?;
    let caps = re
        .captures(source)
        .ok_or("Expected an https://docs.google.com/spreadsheets/d/... URL")?;
    let gid_re = Regex::new(r"[?#&]gid=(\d+)")?;
    let gid = gid_re
        .captures(source)
        .map(|c| format!("&gid={}", &c[1]))
        .unwrap_or_default();
    Ok(format!(
        "https://docs.google.com/spreadsheets/d/{}/export?format=csv{gid}",
        &caps[1]
    ))
}
fn load(source: &str) -> Result<String> {
    let text = if source.starts_with("http:") || source.starts_with("https:") {
        let output = Command::new("curl")
            .args([
                "--fail",
                "--silent",
                "--show-error",
                "--location",
                "--max-time",
                "30",
                "--proto",
                "=https",
                "--proto-redir",
                "=https",
                &export_url(source)?,
            ])
            .output()?;
        if !output.status.success() {
            return Err("Couldn't download sheet. Use a local CSV export for private sheets; also check network connectivity.".into());
        }
        String::from_utf8(output.stdout)?
    } else {
        fs::read_to_string(source)?
    };
    let text = text.trim_start_matches('\u{feff}').to_string();
    if text.trim_start().starts_with('<') {
        return Err(
            "Received HTML instead of CSV. Use a local CSV export for a private sheet.".into(),
        );
    }
    Ok(text)
}

struct AddressRules {
    country: Regex,
    street: Regex,
}
impl AddressRules {
    fn new() -> Self {
        Self { country: Regex::new(r"(?i)\b(Germany|Czechia|Colombia|India)\b").unwrap(), street: Regex::new(r"(?i)(stra(ß|ss)e|str\.?|weg|allee|ring|ufer|chaussee|platz|gasse|damm|pocket|garden)").unwrap() }
    }
    fn process(&self, raw: &str, zip: &str, city: &str) -> (String, Vec<String>) {
        let zip = zip.trim();
        let city = city.trim();
        let country = self
            .country
            .find(raw)
            .map(|m| {
                let s = m.as_str().to_lowercase();
                format!("{}{}", s[..1].to_uppercase(), &s[1..])
            })
            .unwrap_or_default();
        let clean = self.country.replace_all(raw, "");
        let clean = clean.trim_matches(|c: char| c.is_whitespace() || c == ',');
        let street = if !zip.is_empty() && clean.contains(zip) {
            clean.split_once(zip).unwrap().0
        } else if !city.is_empty() && clean.contains(city) {
            clean.split_once(city).unwrap().0
        } else {
            clean
        };
        let street = street.trim_matches(|c: char| c.is_whitespace() || c == ',');
        let locality = format!("{zip} {city}").trim().to_string();
        let mut notes = Vec::new();
        if street.is_empty() && locality.is_empty() {
            notes.push("No address".into());
        } else {
            if street.is_empty() {
                notes.push("No street (only city/postal code)".into());
            } else if !street.chars().any(|c| c.is_ascii_digit()) && self.street.is_match(street) {
                notes.push("Missing house number".into());
            }
            if zip.is_empty() {
                notes.push("Missing postal code".into());
            }
            if city.is_empty() {
                notes.push("Missing city".into());
            }
        }
        let plz = zip.len() == 5 && zip.bytes().all(|b| b.is_ascii_digit());
        if !zip.is_empty() && country == "Germany" && !plz {
            notes.push(format!("Invalid postal code ({zip})"));
        }
        if plz
            && !country.is_empty()
            && country != "Germany"
            && city.to_lowercase().contains("berlin")
        {
            notes.push("Country mismatch (Berlin postal code, non-German country)".into());
        }
        if raw.to_lowercase().contains("gemany") || city.to_lowercase().contains("gemany") {
            notes.push("City typo".into());
        }
        (
            [street, locality.as_str(), country.as_str()]
                .into_iter()
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join("\n"),
            notes,
        )
    }
}
fn colored_workbook(csv_bytes: &[u8]) -> Result<Vec<u8>> {
    let mut reader = csv::Reader::from_reader(csv_bytes);
    let headers = reader.headers()?.clone();
    let notes = headers.iter().position(|h| h == "Notes");
    let team = headers.iter().position(|h| h == "Team");
    let generation = headers.iter().position(|h| h == "Generation");
    let base = Format::new().set_text_wrap();
    let green = base.clone().set_background_color("#F3FAF0");
    let blue = base.clone().set_background_color("#EFF7FD");
    let red = base.clone().set_background_color("#FDEEEE");
    let heading = base.clone().set_bold().set_background_color("#F2F2F2");
    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet().set_name("Birthdays")?;
    sheet.set_freeze_panes(1, 3)?;
    for (c, h) in headers.iter().enumerate() {
        sheet.write_string_with_format(0, c as u16, h, &heading)?;
        sheet.set_column_width(
            c as u16,
            match h {
                "Notes" | "Address" => 42,
                "Team" | "Generation" => 13,
                _ => 22,
            },
        )?;
    }
    let mut count = 0;
    for (r, record) in reader.records().enumerate() {
        let record = record?;
        let issue = notes.is_some_and(|i| !record[i].is_empty());
        let row = (r + 1) as u32;
        count = row;
        sheet.set_row_height(row, 48)?;
        let format = if issue {
            &red
        } else if generation.is_some_and(|i| &record[i] == "Yes") {
            &blue
        } else if team.is_some_and(|i| &record[i] == "Yes") {
            &green
        } else {
            &base
        };
        for (c, value) in record.iter().enumerate() {
            sheet.write_string_with_format(row, c as u16, value, format)?;
        }
    }
    sheet.autofilter(0, 0, count, (headers.len() - 1) as u16)?;
    let legend = workbook.add_worksheet().set_name("Legend")?;
    legend.set_column_width(0, 44)?;
    legend.set_column_width(1, 65)?;
    legend.write_string_with_format(0, 0, "Legend", &heading)?;
    for (row, label, explanation, format) in [
        (
            1,
            "Team people",
            "Green row: department is filled in",
            &green,
        ),
        (
            2,
            "Next Generation (15 and younger)",
            "Blue row: age 0–15 on the reference date",
            &blue,
        ),
        (
            3,
            "Invalid address",
            "Red row: address issues to review",
            &red,
        ),
    ] {
        legend.write_string_with_format(row, 0, label, format)?;
        legend.write_string(row, 1, explanation)?;
    }
    legend.write_string(5, 0, "Overlapping categories")?;
    legend.write_string(
        5,
        1,
        "Priority: Invalid address, then Generation, then Team",
    )?;
    workbook.save_to_buffer().map_err(Into::into)
}

fn run(args: Args) -> Result<()> {
    let today = args.as_of.unwrap_or_else(|| Local::now().date_naive());
    let month = args.month.unwrap_or(today.month());
    let year = args.year.unwrap_or(today.year());
    let output = args.output.unwrap_or_else(|| {
        PathBuf::from(if args.all {
            "contacts-processed.csv".into()
        } else {
            format!("birthdays-{year}-{month:02}.csv")
        })
    });
    if output.exists() && fs::canonicalize(&output).ok() == fs::canonicalize(&args.source).ok() {
        return Err("Output must differ from source".into());
    }
    let text = load(&args.source)?;
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(text.as_bytes());
    let mut records = Vec::new();
    for record in reader.records() {
        let r = record?;
        if r.iter().any(|v| !v.trim().is_empty()) {
            records.push(r.iter().map(String::from).collect::<Vec<_>>());
        }
    }
    if records.is_empty() {
        return Err("No data found".into());
    }
    let mut headers = records.remove(0);
    let width = headers.len();
    let dob_i = col(
        &headers,
        &["date of birth", "dob", "birthday", "day of birth"],
    );
    let addr_i = col(
        &headers,
        &["full mailing address", "address", "mailing address"],
    );
    let zip_i = col(
        &headers,
        &["zip code / plz", "zip", "plz", "postal code", "zip code"],
    );
    let city_i = col(&headers, &["city", "town"]);
    let dept_i = col(&headers, &["department", "departments"]);
    if dob_i.is_none() && !args.all {
        return Err("No Date of Birth column found".into());
    }
    if addr_i.is_none() && (!args.no_check || !args.no_split) {
        eprintln!("No address column: skipping address steps.");
    }
    let check = !args.no_check && addr_i.is_some();
    let split = !args.no_split && addr_i.is_some();
    let mut rows = Vec::new();
    let mut invalid = 0;
    for (idx, mut r) in records.into_iter().enumerate() {
        if r.len() > width {
            return Err(format!("Data record {} has more fields than the header", idx + 1).into());
        }
        r.resize(width, String::new());
        let born = dob_i.and_then(|i| dob(&r[i])).filter(|d| *d <= today);
        if dob_i.is_some() && born.is_none() {
            invalid += 1;
        }
        if args.all || born.is_some_and(|d| d.month() == month) {
            rows.push((r, born));
        }
    }
    if !args.no_sort {
        rows.sort_by_key(|(_, d)| {
            d.map(|d| (d.day(), d.month(), d.year()))
                .unwrap_or((99, 99, 9999))
        });
    }
    if split {
        headers[addr_i.unwrap()] = "Address".into();
    }
    if check {
        headers.push("Notes".into());
    }
    if dept_i.is_some() {
        headers.push("Team".into());
    }
    if dob_i.is_some() {
        headers.push("Generation".into());
    }
    let rules = AddressRules::new();
    let mut summary = BTreeMap::<String, usize>::new();
    let mut writer = csv::Writer::from_writer(Vec::new());
    headers.rotate_left(width);
    writer.write_record(&headers)?;
    for (mut row, born) in rows.iter().cloned() {
        let team = dept_i.map(|i| {
            if row[i].trim().is_empty() {
                "No"
            } else {
                "Yes"
            }
        });
        if check || split {
            let i = addr_i.unwrap();
            let (address, notes) = rules.process(
                &row[i],
                zip_i.map(|i| row[i].as_str()).unwrap_or(""),
                city_i.map(|i| row[i].as_str()).unwrap_or(""),
            );
            if split {
                row[i] = address;
            }
            if check {
                row.push(notes.join("; "));
                for note in notes {
                    *summary
                        .entry(note.split(" (").next().unwrap().into())
                        .or_default() += 1;
                }
            }
        }
        if let Some(team) = team {
            row.push(team.into());
        }
        if dob_i.is_some() {
            row.push(
                match born {
                    Some(b) if age(b, today) <= 15 => "Yes",
                    Some(_) => "No",
                    None => "Unknown",
                }
                .into(),
            );
        }
        row.rotate_left(width);
        writer.write_record(row)?;
    }
    let bytes = writer.into_inner()?;
    let bytes = if output
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("xlsx"))
    {
        colored_workbook(&bytes)?
    } else {
        bytes
    };
    let mut options = OpenOptions::new();
    options.write(true);
    if args.overwrite {
        options.create(true).truncate(true);
    } else {
        options.create_new(true);
    }
    let mut file = options.open(&output).map_err(|e| {
        format!(
            "Cannot write {}: {e} (existing files require --overwrite)",
            output.display()
        )
    })?;
    use std::io::Write;
    file.write_all(&bytes)?;
    println!("Wrote {} contacts to {}", rows.len(), output.display());
    eprintln!(
        "Invalid or future DOBs: {invalid} ({})",
        if args.all {
            "retained with Unknown age classification"
        } else {
            "omitted"
        }
    );
    for (note, count) in summary {
        eprintln!("{count:>3}  {note}");
    }
    Ok(())
}
fn main() {
    if let Err(e) = run(Args::parse()) {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dates_and_ages() {
        assert!(dob("31/02/2010").is_none());
        assert!(dob("1/2/10").is_none());
        assert!(dob("1/2/2010 junk").is_none());
        assert!(dob("29.02.2012").is_some());
        assert_eq!(
            age(dob("26-09-2010").unwrap(), dob("25/09/2026").unwrap()),
            15
        );
        assert_eq!(
            age(dob("25/09/2010").unwrap(), dob("25/09/2026").unwrap()),
            16
        );
    }
    #[test]
    fn sheets_links() {
        assert_eq!(
            export_url("https://docs.google.com/spreadsheets/d/abc/edit?usp=sharing").unwrap(),
            "https://docs.google.com/spreadsheets/d/abc/export?format=csv"
        );
        assert_eq!(
            export_url("https://docs.google.com/spreadsheets/d/abc-123/edit#gid=42").unwrap(),
            "https://docs.google.com/spreadsheets/d/abc-123/export?format=csv&gid=42"
        );
        assert!(export_url("https://evil.example/spreadsheets/d/abc").is_err());
    }
    #[test]
    fn mailing_addresses() {
        let rules = AddressRules::new();
        let (a, notes) = rules.process("Hauptstraße 4, 01234 Dresden, germany", "01234", "Dresden");
        assert_eq!(a, "Hauptstraße 4\n01234 Dresden\nGermany");
        assert!(notes.is_empty());
        assert!(rules
            .process("Hauptstraße, Germany", "1234", "Berlin")
            .1
            .iter()
            .any(|s| s.starts_with("Invalid postal code")));
        assert!(rules.process("", "", "").1.contains(&"No address".into()));
    }
}
