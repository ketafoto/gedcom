#!/usr/bin/env python3
"""
Shared GEDCOM utilities and test data for tests.
"""

from pathlib import Path

# Minimal but representative GEDCOM for tests that need importable data.
# Covers: header, submitter, two individuals (M/F), one family with a child,
# birth/death events, marriage, and a media reference.
MINIMAL_GEDCOM = """\
0 HEAD
1 SOUR TEST
2 NAME Test Suite
2 VERS 1.0
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
1 SUBM @U1@
0 @U1@ SUBM
1 NAME Test Runner
0 @I1@ INDI
1 NAME John /Doe/
1 SEX M
1 BIRT
2 DATE 01 JAN 1960
2 PLAC Springfield
1 DEAT
2 DATE 15 MAR 2020
2 PLAC Shelbyville
1 OBJE
2 FILE media/john_35.jpg
2 FORM photo
2 TITL Portrait at 35
1 FAMS @F1@
0 @I2@ INDI
1 NAME Jane /Smith/
1 SEX F
1 BIRT
2 DATE 22 JUL 1962
1 FAMS @F1@
0 @I3@ INDI
1 NAME Jimmy /Doe/
1 SEX M
1 BIRT
2 DATE 05 SEP 1990
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 30 JUN 1985
2 PLAC City Hall
0 TRLR
"""


def write_minimal_gedcom(directory: Path) -> Path:
    """Write MINIMAL_GEDCOM to a file in directory, return its Path."""
    ged_file = directory / "minimal.ged"
    ged_file.write_text(MINIMAL_GEDCOM, encoding="utf-8")
    return ged_file


def compare_gedcom_files(expected_path: Path, actual_path: Path) -> tuple[bool, str]:
    """Compare GEDCOM files, skipping dynamic header fields.

    Lines containing @SKIP@ in expected file are skipped.
    Lines starting with "1 DATE ", "2 TIME ", "1 FILE " are skipped in both files.

    Args:
        expected_path: Path to the expected/golden GEDCOM file
        actual_path: Path to the actual/generated GEDCOM file

    Returns:
        (match: bool, diff_message: str)
        - match is True if files are equivalent
        - diff_message contains human-readable differences if not matching
    """
    def normalize_lines(path: Path, is_expected: bool = False) -> list[str]:
        lines = []
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.rstrip()
                # Skip dynamic header fields
                if line.startswith("1 DATE ") or line.startswith("2 TIME ") or line.startswith("1 FILE "):
                    continue
                # Skip lines marked with @SKIP@ in expected file
                if is_expected and "@SKIP@" in line:
                    continue
                lines.append(line)
        return lines

    expected_lines = normalize_lines(expected_path, is_expected=True)
    actual_lines = normalize_lines(actual_path, is_expected=False)

    if expected_lines == actual_lines:
        return True, ""

    # Build diff message
    diff_parts = []
    max_lines = max(len(expected_lines), len(actual_lines))
    diff_count = 0

    for i in range(max_lines):
        exp = expected_lines[i] if i < len(expected_lines) else "<missing>"
        act = actual_lines[i] if i < len(actual_lines) else "<missing>"
        if exp != act:
            diff_parts.append(f"Line {i+1}:")
            diff_parts.append(f"  Expected: {exp}")
            diff_parts.append(f"  Actual:   {act}")
            diff_count += 1
            if diff_count >= 10:
                diff_parts.append("... (more differences)")
                break

    return False, "\n".join(diff_parts)


def normalize_gedcom_text(text: str, skip_dynamic_fields: bool = False) -> str:
    """Normalize GEDCOM text for comparison.

    Args:
        text: GEDCOM text content
        skip_dynamic_fields: If True, skip fields that change on each export
                            (DATE/TIME timestamps, FILE name)

    Returns:
        Normalized text with consistent line endings
    """
    lines = []
    for line in text.strip().splitlines():
        line = line.rstrip()
        if skip_dynamic_fields:
            # Skip the DATE line in header (export timestamp)
            if line.startswith("1 DATE "):
                continue
            # Skip the TIME line in header (export timestamp)
            if line.startswith("2 TIME "):
                continue
            # Skip the FILE line in header (output filename)
            if line.startswith("1 FILE "):
                continue
        lines.append(line)
    return '\n'.join(lines)
