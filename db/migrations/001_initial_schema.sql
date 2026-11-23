-- Migration: 001_initial_schema
-- Schema only: business profile, branches, menu structure, and menu image mappings.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS business (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    profile_history TEXT NOT NULL,
    dining_experience TEXT,
    additional_notes TEXT,
    summary TEXT,
    whatsapp TEXT,
    email TEXT,
    instagram TEXT,
    tiktok TEXT,
    linktree TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    starting_price_note TEXT,
    features_json TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (business_id) REFERENCES business (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS business_sauces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    note TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (business_id) REFERENCES business (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    branch_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    area TEXT NOT NULL,
    address TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES business (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    badge TEXT,
    description TEXT,
    upgrade_price_idr INTEGER,
    upgrade_description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    flavor_note TEXT,
    availability_note TEXT,
    group_label TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES menu_categories (id) ON DELETE CASCADE,
    UNIQUE (category_id, slug)
);

CREATE TABLE IF NOT EXISTS menu_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    menu_code TEXT NOT NULL UNIQUE,
    variant_name TEXT NOT NULL,
    price_idr INTEGER NOT NULL CHECK (price_idr >= 0),
    is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_code TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'image/webp',
    alt_text TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_code) REFERENCES menu_variants (menu_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_packages_business_id ON business_packages (business_id);
CREATE INDEX IF NOT EXISTS idx_business_sauces_business_id ON business_sauces (business_id);
CREATE INDEX IF NOT EXISTS idx_branches_business_id ON branches (business_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items (category_id);
CREATE INDEX IF NOT EXISTS idx_menu_variants_item_id ON menu_variants (menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_variants_code ON menu_variants (menu_code);
CREATE INDEX IF NOT EXISTS idx_menu_images_code ON menu_images (menu_code);
