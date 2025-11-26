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
  birth_date_approx TEXT,   -- Raw GEDCOM date string for non-exact dates, e.g. 'ABT 1970'
  birth_place TEXT,
  death_date TEXT,
  death_date_approx TEXT,   -- Raw GEDCOM date string for non-exact dates, e.g. 'ABT 1970'
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
  marriage_date_approx TEXT,  -- Raw GEDCOM date string for non-exact dates, e.g. 'ABT 1970'
  marriage_place TEXT,
  divorce_date TEXT,
  divorce_date_approx TEXT,   -- Raw GEDCOM date string for non-exact dates, e.g. 'ABT 1970'
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
  event_date_approx TEXT,     -- Raw GEDCOM date string for non-exact dates, e.g. 'ABT 1970'
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
  media_date_approx TEXT,     -- Raw GEDCOM date string for non-exact dates, e.g. 'ABT 1970'
  description TEXT
);

-- GEDCOM Header/Submitter metadata table (singleton - one record per database)
-- Stores information from HEAD and SUBM records for round-trip fidelity
CREATE TABLE IF NOT EXISTS meta_header (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Only one record allowed
  -- Source system (SOUR)
  source_system_id TEXT,      -- e.g., "GEDCOM-Export-System"
  source_system_name TEXT,    -- SOUR.NAME e.g., "Genealogy Database GEDCOM Export"
  source_version TEXT,        -- SOUR.VERS e.g., "5.5.1"
  source_corporation TEXT,    -- SOUR.CORP
  -- File info
  file_name TEXT,             -- FILE tag
  creation_date TEXT,         -- DATE tag (raw GEDCOM format)
  creation_time TEXT,         -- DATE.TIME tag
  -- GEDCOM version (GEDC)
  gedcom_version TEXT DEFAULT '5.5.1',    -- GEDC.VERS
  gedcom_form TEXT DEFAULT 'LINEAGE-LINKED', -- GEDC.FORM
  -- Other header fields
  charset TEXT DEFAULT 'UTF-8',           -- CHAR
  language TEXT,                          -- LANG
  copyright TEXT,                         -- COPR
  destination TEXT,                       -- DEST
  note TEXT,                              -- NOTE
  -- Submitter info (SUBM record)
  submitter_id TEXT,          -- @U00001@ etc.
  submitter_name TEXT,        -- SUBM.NAME
  submitter_address TEXT,     -- SUBM.ADDR
  submitter_city TEXT,        -- SUBM.ADDR.CITY
  submitter_state TEXT,       -- SUBM.ADDR.STAE
  submitter_postal TEXT,      -- SUBM.ADDR.POST
  submitter_country TEXT,     -- SUBM.ADDR.CTRY
  submitter_phone TEXT,       -- SUBM.PHON
  submitter_email TEXT,       -- SUBM.EMAIL
  submitter_fax TEXT,         -- SUBM.FAX
  submitter_www TEXT,         -- SUBM.WWW
  -- Timestamps for tracking
  imported_at TEXT,           -- When the GEDCOM was imported
  last_modified TEXT          -- Last modification date (for export)
);
