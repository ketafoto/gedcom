import pytest

@pytest.fixture
def log_test_step():
    def printer(message: str):
        print("  " + message)  # Prints only visible with pytest -s
    return printer
