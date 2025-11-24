-- run "sqlite3 gedcom.db < schema.sql" to generate file with SQLite database

-- Lookup table for sexes
CREATE TABLE IF NOT EXISTS types_sex (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

INSERT OR IGNORE INTO types_sex (code, description) VALUES
  ('M', 'Male'),
  ('F', 'Female'),
  ('NB', 'Non-binary'),
  ('U', 'Unknown');

-- Lookup table for event types
CREATE TABLE IF NOT EXISTS types_event (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

INSERT OR IGNORE INTO types_event (code, description) VALUES
  ('BIRT', 'Birth'),
  ('DEAT', 'Death'),
  ('MARR', 'Marriage'),
  ('DIV',  'Divorce'),
  ('BAPM', 'Baptism'),
  ('CHR',  'Christening'),
  ('ADOP', 'Adoption'),
  ('EVEN', 'Other Event'),
  ('STUD_START', 'Study Start'),
  ('STUD_END', 'Study End'),
  ('WORK_START', 'Work/Job Start'),
  ('WORK_END', 'Work/Job End'),
  ('RELOC', 'Relocation To');

-- Lookup table for media types
CREATE TABLE IF NOT EXISTS types_media (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

INSERT OR IGNORE INTO types_media (code, description) VALUES
  ('photo', 'Photograph'),
  ('audio', 'Audio'),
  ('video', 'Video');

-- Lookup table for family member roles
CREATE TABLE IF NOT EXISTS types_family_member_roles (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

INSERT OR IGNORE INTO types_family_member_roles (code, description) VALUES
  ('husband', 'Husband'),
  ('wife', 'Wife'),
  ('partner', 'Unmarried Partner');

-- Individuals table
CREATE TABLE IF NOT EXISTS main_individuals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gedcom_id TEXT UNIQUE,
  sex_code TEXT REFERENCES types_sex(code),
  birth_date TEXT,
  birth_place TEXT,
  death_date TEXT,
  death_place TEXT,
  notes TEXT
);

-- Individual Names table
CREATE TABLE IF NOT EXISTS main_individual_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  individual_id INTEGER REFERENCES main_individuals(id),
  name_type TEXT,
  given_name TEXT,
  family_name TEXT,
  prefix TEXT,
  suffix TEXT,
  name_order INTEGER
);

-- Families table
CREATE TABLE IF NOT EXISTS main_families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gedcom_id TEXT UNIQUE,
  marriage_date TEXT,
  marriage_place TEXT,
  divorce_date TEXT,
  family_type TEXT DEFAULT 'marriage',
  notes TEXT
);

-- Family Members table
CREATE TABLE IF NOT EXISTS main_family_members (
  family_id INTEGER REFERENCES main_families(id),
  individual_id INTEGER REFERENCES main_individuals(id),
  role TEXT REFERENCES types_family_member_roles(code),
  PRIMARY KEY(family_id, individual_id)
);

-- Family Children table
CREATE TABLE IF NOT EXISTS main_family_children (
  family_id INTEGER REFERENCES main_families(id),
  child_id INTEGER REFERENCES main_individuals(id),
  PRIMARY KEY (family_id, child_id)
);

-- Events table
CREATE TABLE IF NOT EXISTS main_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  individual_id INTEGER REFERENCES main_individuals(id),
  family_id INTEGER REFERENCES main_families(id),
  event_type_code TEXT REFERENCES types_event(code),
  event_date TEXT,
  event_place TEXT,
  description TEXT
);

-- Sources table
CREATE TABLE IF NOT EXISTS main_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  author TEXT,
  publication TEXT,
  publish_date TEXT,
  notes TEXT
);

-- Media table
CREATE TABLE IF NOT EXISTS main_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  individual_id INTEGER REFERENCES main_individuals(id),
  family_id INTEGER REFERENCES main_families(id),
  file_path TEXT,
  media_type_code TEXT REFERENCES types_media(code),
  media_date TEXT,
  description TEXT
);
