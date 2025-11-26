import sqlite3
from pathlib import Path
from typing import List, Tuple, Any, Optional
import pytest


class DatabaseUtils:
    """Generic database utility for running queries and fetching results."""

    def __init__(self, db_file: Path):
        self.db_file = db_file

    def execute_query(self, sql: str, params: Tuple[Any, ...] = ()) -> List[dict]:
        """
        Execute a SQL query and return results as a list of dictionaries.

        Args:
            sql: SQL query string
            params: Tuple of parameters for parameterized queries

        Returns:
            List of dictionaries where each dict represents a row
        """
        if not self.db_file.exists():
            pytest.fail(f"Test database file {self.db_file} does not exist!")

        conn = sqlite3.connect(str(self.db_file))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            cursor.execute(sql, params)
            results = [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

        return results

    def execute_query_single(self, sql: str, params: Tuple[Any, ...] = ()) -> Optional[dict]:
        """
        Execute a SQL query and return a single result as a dictionary.

        Args:
            sql: SQL query string
            params: Tuple of parameters for parameterized queries

        Returns:
            Dictionary representing a row, or None if no result
        """
        results = self.execute_query(sql, params)
        return results[0] if results else None


class IndividualVerifier:
    """Table-specific verifier for Individuals. Uses generic DatabaseUtils."""

    def __init__(self, db: DatabaseUtils):
        self.db = db

    def individual_exists(self, individual_id: int) -> bool:
        """Check if an individual with given ID exists."""
        result = self.db.execute_query_single(
            "SELECT * FROM main_individuals WHERE id = ?",
            (individual_id,)
        )
        return result is not None

    def individual_by_gedcom_id(self, gedcom_id: str) -> List[dict]:
        """Get all individuals with a given GEDCOM ID."""
        return self.db.execute_query(
            "SELECT * FROM main_individuals WHERE gedcom_id = ?",
            (gedcom_id,)
        )

    def individual_names(self, individual_id: int) -> List[dict]:
        """Get all name records for an individual."""
        return self.db.execute_query(
            "SELECT * FROM main_individual_names WHERE individual_id = ?",
            (individual_id,)
        )

    def all_individuals(self) -> List[dict]:
        """Get all individuals."""
        return self.db.execute_query("SELECT * FROM main_individuals")


class FamilyVerifier:
    """Table-specific verifier for Families. Uses generic DatabaseUtils."""

    def __init__(self, db: DatabaseUtils):
        self.db = db

    def family_exists(self, family_id: int) -> bool:
        """Check if a family with given ID exists."""
        result = self.db.execute_query_single(
            "SELECT * FROM main_families WHERE id = ?",
            (family_id,)
        )
        return result is not None

    def all_families(self) -> List[dict]:
        """Get all families."""
        return self.db.execute_query("SELECT * FROM main_families")
