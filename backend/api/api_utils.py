from sqlalchemy.orm import Session
from sqlalchemy import inspect

def generate_gedcom_id(db: Session, model) -> str:
    """
    Generate a unique GEDCOM ID for the given table/model.
    Assumes model has 'gedcom_id' string column with format: Letter + digits.

    Args:
        db: SQLAlchemy Session object
        model: SQLAlchemy model class to generate ID for (e.g., Individual)

    Returns:
        New unique gedcom_id string (e.g., 'I00001')
    """
    max_id = 0
    # Reflect column presence for safety
    mapper = inspect(model)
    if 'gedcom_id' not in mapper.columns:
        raise ValueError(f'Model {model} does not have a gedcom_id column')

    items = db.query(model).filter(model.gedcom_id != None).all()

    for item in items:
        gedcom_id = item.gedcom_id
        if gedcom_id and len(gedcom_id) > 1 and gedcom_id[1:].isdigit():
            if gedcom_id[0].isalpha():
                num = int(gedcom_id[1:])
                if num > max_id:
                    max_id = num

    return f"{max_id + 1:05d}"
