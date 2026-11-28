# Chicken LessFille Solo — Web Application

Website for **Chicken LessFille Solo** built with minimal dependencies, custom bilingual i18n (`Bahasa Indonesia` default / `English`), dynamic file/database loading, and GitHub Pages compatibility.

## Structure

- `index.html` — Homepage (AI-generated hero banner, menu with code-paired images, business profile, official branches, social/contact, floating cart bar)
- `cart/index.html` — Cart & WhatsApp order page (`/cart`)
- `css/input.css` — Tailwind CSS v4 source + Astryx Design System (`@astryxdesign/core`) semantic tokens, Light/Dark modes (`[data-astryx-colors="Dark"]`), concentric radii, 4dp spacing, geometric typography, and motion tokens
- `css/style.css` — Precompiled production Tailwind CSS stylesheet (zero runtime JS)
- `js/` — Native ES modules (`i18n.js`, `parser.js`, `data-loader.js`, `cart-store.js`, `home.js`, `cart.js`)
- `i18n/` — Custom translation dictionaries (`id.json`, `en.json`)
- `db/` — SQLite/SQL schema and migration (`schema.sql`, `migrations/001_initial_schema.sql`, DDL only)
- `server.py` — Minimal Python backend (uses Flask if installed, otherwise Python stdlib)
- `assets/hero-banner.jpg` — AI-generated hero banner image
- `scripts/sync-assets.sh` — Copies source `.txt` files and `material/*.webp` images for static GitHub Pages builds

## Database Migration

Schema only (no seed/test data):

```bash
sqlite3 db/lessfille.db < db/migrations/001_initial_schema.sql
```

## Run Locally

By default, `server.py` reads directly from `../Chicken LessFille Solo.txt`, `../lessfilemenu.txt`, and `../material/` (falling back to `./data` and `./material`), or from `db/lessfille.db` when populated.

```bash
python3 server.py
```

Optional Flask install:

```bash
pip install -r requirements.txt
python3 server.py
```

Open `http://localhost:8000` (homepage) and `http://localhost:8000/cart` (cart).

Environment variables (optional):
- `LESSFILE_DATA_DIR` — Directory containing `Chicken LessFille Solo.txt` and `lessfilemenu.txt`
- `LESSFILE_MATERIAL_DIR` — Directory containing menu images named by menu code
- `LESSFILE_DB_PATH` — Path to SQLite database
- `PORT` — Server port (default `8000`)

## Deploy to GitHub Pages

1. Sync latest source files and menu images if updated:
   ```bash
   bash scripts/sync-assets.sh
   ```
2. Push this directory to a GitHub repository.
3. In **Settings → Pages**, set Source to **Deploy from a branch** (`main`, `/ (root)`).
4. Both `https://<user>.github.io/<repo>/` and `https://<user>.github.io/<repo>/cart/` work out of the box on desktop and mobile devices.
