#!/usr/bin/env python3
"""
Shared GEDCOM utilities for tests.
"""

from pathlib import Path


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
