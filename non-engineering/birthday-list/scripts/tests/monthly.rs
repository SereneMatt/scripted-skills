use std::{fs, process::Command};
#[test]
fn monthly_csv_and_output_protection() {
    let dir = std::env::temp_dir().join(format!("birthday-test-{}", std::process::id()));
    fs::create_dir_all(&dir).unwrap();
    let source = dir.join("contacts.csv");
    let output = dir.join("result.csv");
    fs::write(&source, "\u{feff}Name,DOB,Address,PLZ,City,Department\nOlder,25/09/2010,\"Hauptstraße 4, 01234 Dresden, Germany\",01234,Dresden,Music\nChild,02/09/2012,\"Parkweg 1\n01234 Dresden\nGermany\",01234,Dresden,\nOther,01/10/2000,,,,\nInvalid,31/09/2000\nFuture,01/09/2030,,,,\n").unwrap();
    let invoke = |extra: &[&str]| {
        Command::new(env!("CARGO_BIN_EXE_birthday-list"))
            .arg(&source)
            .args([
                "--month",
                "9",
                "--year",
                "2026",
                "--as-of",
                "2026-09-25",
                "--output",
            ])
            .arg(&output)
            .args(extra)
            .output()
            .unwrap()
    };
    let result = invoke(&[]);
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(String::from_utf8_lossy(&result.stderr).contains("DOBs: 2"));
    let mut reader = csv::Reader::from_path(&output).unwrap();
    assert_eq!(
        reader.headers().unwrap().iter().collect::<Vec<_>>(),
        vec![
            "Notes",
            "Team",
            "Generation",
            "Name",
            "DOB",
            "Address",
            "PLZ",
            "City",
            "Department"
        ]
    );
    let rows: Vec<_> = reader.records().map(|r| r.unwrap()).collect();
    assert_eq!(rows.len(), 2);
    assert_eq!(&rows[0][3], "Child");
    assert_eq!(&rows[0][2], "Yes");
    assert_eq!(&rows[1][1], "Yes");
    assert_eq!(&rows[1][2], "No");
    assert_eq!(&rows[1][5], "Hauptstraße 4\n01234 Dresden\nGermany");
    let before = fs::read(&output).unwrap();
    assert!(!invoke(&[]).status.success());
    assert_eq!(fs::read(&output).unwrap(), before);
    assert!(invoke(&["--overwrite"]).status.success());
    let empty = Command::new(env!("CARGO_BIN_EXE_birthday-list"))
        .arg(&source)
        .args(["--month", "12", "--output"])
        .arg(dir.join("empty.csv"))
        .output()
        .unwrap();
    assert!(empty.status.success());
    assert_eq!(
        csv::Reader::from_path(dir.join("empty.csv"))
            .unwrap()
            .records()
            .count(),
        0
    );
    let same = Command::new(env!("CARGO_BIN_EXE_birthday-list"))
        .arg(&source)
        .args(["--output"])
        .arg(&source)
        .arg("--overwrite")
        .output()
        .unwrap();
    assert!(!same.status.success());
    fs::remove_dir_all(&dir).unwrap();
}
