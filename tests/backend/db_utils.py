import sqlite3
from typing import List, Tuple, Any, Optional
import pytest
from tests.backend.conftest import TEST_DB_FILE


class DatabaseUtils:
    """Generic database utility for running queries and fetching results."""

    @staticmethod
    def execute_query(sql: str, params: Tuple[Any, ...] = ()) -> List[dict]:
        """
        Execute a SQL query and return results as a list of dictionaries.

        Args:
            sql: SQL query string
            params: Tuple of parameters for parameterized queries

        Returns:
            List of dictionaries where each dict represents a row
        """
        import os
        if not os.path.exists(TEST_DB_FILE):
            pytest.fail(f"Test database file {TEST_DB_FILE} does not exist!")

        conn = sqlite3.connect(TEST_DB_FILE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            cursor.execute(sql, params)
            results = [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

        return results

    @staticmethod
    def execute_query_single(sql: str, params: Tuple[Any, ...] = ()) -> Optional[dict]:
        """
        Execute a SQL query and return a single result as a dictionary.

        Args:
            sql: SQL query string
            params: Tuple of parameters for parameterized queries

        Returns:
            Dictionary representing a row, or None if no result
        """
        results = DatabaseUtils.execute_query(sql, params)
        return results[0] if results else None


class IndividualVerifier:
    """Table-specific verifier for Individuals. Uses generic DatabaseUtils."""

    @staticmethod
    def individual_exists(individual_id: int) -> bool:
        """Check if an individual with given ID exists."""
        result = DatabaseUtils.execute_query_single(
            "SELECT * FROM main_individuals WHERE id = ?",
            (individual_id,)
        )
        return result is not None

    @staticmethod
    def individual_by_gedcom_id(gedcom_id: str) -> List[dict]:
        """Get all individuals with a given GEDCOM ID."""
        return DatabaseUtils.execute_query(
            "SELECT * FROM main_individuals WHERE gedcom_id = ?",
            (gedcom_id,)
        )

    @staticmethod
    def individual_names(individual_id: int) -> List[dict]:
        """Get all name records for an individual."""
        return DatabaseUtils.execute_query(
            "SELECT * FROM main_individual_names WHERE individual_id = ?",
            (individual_id,)
        )

    @staticmethod
    def all_individuals() -> List[dict]:
        """Get all individuals."""
        return DatabaseUtils.execute_query("SELECT * FROM main_individuals")


class FamilyVerifier:
    """Table-specific verifier for Families. Uses generic DatabaseUtils."""

    @staticmethod
    def family_exists(family_id: int) -> bool:
        """Check if a family with given ID exists."""
        result = DatabaseUtils.execute_query_single(
            "SELECT * FROM main_families WHERE id = ?",
            (family_id,)
        )
        return result is not None

    @staticmethod
    def all_families() -> List[dict]:
        """Get all families."""
        return DatabaseUtils.execute_query("SELECT * FROM main_families")
