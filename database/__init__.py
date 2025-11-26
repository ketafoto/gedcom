# The __init__.py file marks a directory as a Python package, enabling imports of modules inside it using dot notation
# (e.g., from backend.api import individuals).
# Without __init__.py, relative and absolute imports within project may fail.
# They help with namespace and module resolution inside project, which is vital for all the relative imports used in FastAPI apps.
#
# Even an empty __init__.py (0 bytes) file suffices.

# To enable import gedcom_import.py and gedcom_export.py from within tests, run by pytest:
#
from . import db
from . import models
from . import user_info

__all__ = ["db", "models", "user_info"]
