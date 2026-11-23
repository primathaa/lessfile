"""Minimal backend for Chicken LessFille Solo.

Loads business, branch, and menu data from SQLite (when populated) or directly
from the provided text files, and resolves menu images by menu code.
Uses Flask when installed, with a stdlib HTTP server fallback.
"""

from __future__ import annotations

import json
import mimetypes
import os
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_ASSET_ROOT = Path(os.environ.get("LESSFILE_DATA_DIR", str(BASE_DIR.parent)))
DB_PATH = Path(os.environ.get("LESSFILE_DB_PATH", str(BASE_DIR / "db" / "lessfille.db")))
IMAGE_EXTENSIONS = (".webp", ".png", ".jpg", ".jpeg")


def resolve_source_file(filename: str) -> Path:
    candidates = [
        DEFAULT_ASSET_ROOT / filename,
        BASE_DIR / "data" / filename,
        BASE_DIR / filename,
    ]
    for path in candidates:
        if path.is_file():
            return path
    return candidates[0]


def resolve_material_dir() -> Path:
    env_dir = os.environ.get("LESSFILE_MATERIAL_DIR")
    candidates = [
        Path(env_dir) if env_dir else None,
        DEFAULT_ASSET_ROOT / "material",
        BASE_DIR / "material",
    ]
    for path in candidates:
        if path and path.is_dir():
            return path
    return DEFAULT_ASSET_ROOT / "material"


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def parse_price_idr(token: str) -> int:
    cleaned = token.strip().upper().replace(".", "").replace(",", "")
    match = re.search(r"(\d+)\s*K", cleaned)
    if match:
        return int(match.group(1)) * 1000
    digits = re.search(r"(\d+)", cleaned)
    return int(digits.group(1)) if digits else 0


def build_image_index(material_dir: Path) -> tuple[dict[str, Path], dict[int, Path]]:
    by_code: dict[str, Path] = {}
    by_number: dict[int, Path] = {}
    if not material_dir.is_dir():
        return by_code, by_number
    for entry in sorted(material_dir.iterdir()):
        if not entry.is_file() or entry.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        stem = entry.stem.strip()
        by_code[stem] = entry
        if stem.isdigit():
            by_number[int(stem)] = entry
    return by_code, by_number


def resolve_menu_image(code: str, material_dir: Path) -> Path | None:
    raw = Path(code).stem.strip()
    by_code, by_number = build_image_index(material_dir)
    if raw in by_code:
        return by_code[raw]
    if raw.isdigit() and int(raw) in by_number:
        return by_number[int(raw)]
    return None


def parse_business_file(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    lines = [line.replace("\u200b", "").strip() for line in text.splitlines()]
    lines = [line for line in lines if line]

    business: dict[str, Any] = {
        "name": "Chicken LessFille Solo",
        "title": lines[0] if lines else "",
        "profile_history": "",
        "packages": [],
        "sauces_note": "",
        "sauces": [],
        "dining_experience": [],
        "branches": [],
        "contact": {},
        "additional_notes": [],
        "summary": "",
    }
    if lines:
        business["name"] = re.split(r"\s*[–—-]\s*", lines[0])[0].strip()

    section = ""
    current_package: dict[str, Any] | None = None
    current_branch: dict[str, Any] | None = None

    for line in lines[1:]:
        if line.startswith("Profil Singkat"):
            section = "profile"
            continue
        if line.startswith("Varian & Harga Menu"):
            section = "packages"
            current_package = None
            continue
        if line.startswith("Varian Saus"):
            section = "sauces"
            business["sauces_note"] = line.rstrip(":")
            continue
        if line.startswith("Pengalaman Makan"):
            section = "experience"
            continue
        if line.startswith("Daftar Cabang Resmi"):
            section = "branches"
            current_branch = None
            continue
        if line.startswith("Kontak & Media Sosial"):
            section = "contact"
            continue
        if line.startswith("Catatan Tambahan"):
            section = "notes"
            continue
        if line == "Rangkuman":
            section = "summary"
            continue

        if section == "profile":
            business["profile_history"] = (
                f"{business['profile_history']} {line}".strip()
                if business["profile_history"]
                else line
            )
        elif section == "packages":
            if not line.startswith("-"):
                current_package = {
                    "slug": slugify(line),
                    "name": line,
                    "starting_price_note": "",
                    "features": [],
                }
                business["packages"].append(current_package)
            elif current_package is not None:
                item = line.lstrip("-").strip()
                if item.lower().startswith("harga:"):
                    current_package["starting_price_note"] = item.split(":", 1)[1].strip()
                else:
                    current_package["features"].append(item)
        elif section == "sauces":
            if line.startswith("-"):
                business["sauces"].append(line.lstrip("-").strip())
        elif section == "experience":
            if line.startswith("-"):
                business["dining_experience"].append(line.lstrip("-").strip())
        elif section == "branches":
            branch_match = re.match(r"^(\d+)\.\s*(.+)$", line)
            if branch_match:
                num = int(branch_match.group(1))
                full_name = branch_match.group(2).strip()
                parts = re.split(r"\s*[–—-]\s*", full_name, maxsplit=1)
                current_branch = {
                    "branch_number": num,
                    "name": full_name,
                    "area": parts[1].strip() if len(parts) > 1 else full_name,
                    "address": "",
                }
                business["branches"].append(current_branch)
            elif line.startswith("-") and current_branch is not None:
                current_branch["address"] = line.lstrip("-").strip()
        elif section == "contact":
            if line.startswith("-") and ":" in line:
                key_raw, val = line.lstrip("-").split(":", 1)
                key_l = key_raw.strip().lower()
                val = val.strip()
                if "whatsapp" in key_l:
                    business["contact"]["whatsapp"] = val
                elif "email" in key_l:
                    business["contact"]["email"] = val
                elif "instagram" in key_l:
                    business["contact"]["instagram"] = val
                elif "tiktok" in key_l:
                    business["contact"]["tiktok"] = val
                elif "link" in key_l:
                    business["contact"]["linktree"] = val
        elif section == "notes":
            if line.startswith("-"):
                business["additional_notes"].append(line.lstrip("-").strip())
        elif section == "summary":
            business["summary"] = (
                f"{business['summary']} {line}".strip() if business["summary"] else line
            )

    return business


def parse_menu_file(path: Path, material_dir: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    raw_lines = [line.replace("\u200b", "").strip() for line in text.splitlines()]
    by_code, by_number = build_image_index(material_dir)

    def image_meta(code: str) -> dict[str, Any]:
        found = by_code.get(code)
        if not found and code.isdigit():
            found = by_number.get(int(code))
        return {
            "menu_code": code,
            "file_name": found.name if found else f"{code}.webp",
            "url": f"material/{code}",
            "available": found is not None,
        }

    categories: list[dict[str, Any]] = []
    current_cat: dict[str, Any] | None = None
    pending_group: dict[str, Any] | None = None

    for line in raw_lines:
        if not line or line.lower() == "menu :":
            continue

        is_heading = (
            "—" not in line
            and not line.startswith("-")
            and not line.startswith("Upgrade ke Paket")
            and not line.startswith("Sudah termasuk")
            and re.match(r"^[A-Z0-9\s\-]+(\([^)]+\))?$", line)
        )
        if is_heading:
            badge = ""
            name = line
            badge_match = re.search(r"\(([^)]+)\)\s*$", line)
            if badge_match:
                badge = badge_match.group(1).strip()
                name = line[: badge_match.start()].strip()
            current_cat = {
                "slug": slugify(name),
                "name": name,
                "badge": badge,
                "description": "",
                "upgrade": None,
                "items": [],
            }
            categories.append(current_cat)
            pending_group = None
            continue

        if current_cat is None:
            continue

        if line.startswith("Upgrade ke Paket"):
            up_match = re.search(r"\(\+(\d+K)\)", line, re.IGNORECASE)
            current_cat["upgrade"] = {
                "price_idr": parse_price_idr(up_match.group(1)) if up_match else 0,
                "description": line,
            }
            continue

        if line.startswith("Sudah termasuk"):
            current_cat["description"] = line
            continue

        if line.startswith("-") and pending_group is not None:
            sub_match = re.match(r"^-\s*(.+?)\s*\((\d+)\)\s*$", line)
            if sub_match:
                sub_name = sub_match.group(1).strip()
                code = sub_match.group(2).strip()
                current_cat["items"].append(
                    {
                        "slug": slugify(sub_name),
                        "name": sub_name,
                        "flavor_note": "",
                        "availability_note": "",
                        "group_label": pending_group["label"],
                        "variants": [
                            {
                                "menu_code": code,
                                "variant_name": "Regular",
                                "price_idr": pending_group["price_idr"],
                                "is_available": True,
                                "image": image_meta(code),
                            }
                        ],
                    }
                )
            continue

        if "—" in line:
            left, right = [part.strip() for part in line.split("—", 1)]
            pending_group = None

            flavor_note = ""
            item_name = left
            flavor_match = re.search(r"\(([^)]+)\)\s*$", left)
            if flavor_match:
                flavor_note = flavor_match.group(1).strip()
                item_name = left[: flavor_match.start()].strip()

            if not re.search(r"\(\d+\)", right):
                pending_group = {
                    "label": item_name,
                    "price_idr": parse_price_idr(right),
                }
                continue

            availability_note = ""
            variants: list[dict[str, Any]] = []
            for part in [segment.strip() for segment in right.split("|")]:
                code_match = re.search(r"\((\d+)\)\s*$", part)
                if not code_match:
                    continue
                code = code_match.group(1).strip()
                before_code = part[: code_match.start()].strip()

                note_match = re.search(r"\(([^)]+)\)", before_code)
                if note_match:
                    availability_note = note_match.group(1).strip()
                    before_code = (
                        before_code[: note_match.start()]
                        + before_code[note_match.end() :]
                    ).strip()

                price_match = re.search(r"(\d+\s*K)", before_code, re.IGNORECASE)
                price_idr = parse_price_idr(price_match.group(1)) if price_match else 0
                variant_label = (
                    before_code[: price_match.start()].strip() if price_match else ""
                )
                if not variant_label:
                    variant_label = "Regular"

                variants.append(
                    {
                        "menu_code": code,
                        "variant_name": variant_label,
                        "price_idr": price_idr,
                        "is_available": True,
                        "image": image_meta(code),
                    }
                )

            current_cat["items"].append(
                {
                    "slug": slugify(item_name),
                    "name": item_name,
                    "flavor_note": flavor_note,
                    "availability_note": availability_note,
                    "group_label": "",
                    "variants": variants,
                }
            )

    return categories


def load_from_sqlite(db_path: Path) -> dict[str, Any] | None:
    if not db_path.is_file():
        return None
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        biz_row = cur.execute("SELECT * FROM business LIMIT 1").fetchone()
        cat_rows = cur.execute(
            "SELECT * FROM menu_categories ORDER BY sort_order, id"
        ).fetchall()
        if not biz_row or not cat_rows:
            conn.close()
            return None

        pkg_rows = cur.execute(
            "SELECT * FROM business_packages WHERE business_id = ? ORDER BY sort_order, id",
            (biz_row["id"],),
        ).fetchall()
        sauce_rows = cur.execute(
            "SELECT * FROM business_sauces WHERE business_id = ? ORDER BY sort_order, id",
            (biz_row["id"],),
        ).fetchall()
        branch_rows = cur.execute(
            "SELECT * FROM branches WHERE business_id = ? ORDER BY sort_order, branch_number",
            (biz_row["id"],),
        ).fetchall()

        business = {
            "name": biz_row["name"],
            "title": biz_row["title"],
            "profile_history": biz_row["profile_history"],
            "packages": [
                {
                    "slug": row["slug"],
                    "name": row["name"],
                    "starting_price_note": row["starting_price_note"] or "",
                    "features": json.loads(row["features_json"] or "[]"),
                }
                for row in pkg_rows
            ],
            "sauces_note": "",
            "sauces": [row["name"] for row in sauce_rows],
            "dining_experience": json.loads(biz_row["dining_experience"] or "[]"),
            "branches": [
                {
                    "branch_number": row["branch_number"],
                    "name": row["name"],
                    "area": row["area"],
                    "address": row["address"],
                }
                for row in branch_rows
            ],
            "contact": {
                "whatsapp": biz_row["whatsapp"] or "",
                "email": biz_row["email"] or "",
                "instagram": biz_row["instagram"] or "",
                "tiktok": biz_row["tiktok"] or "",
                "linktree": biz_row["linktree"] or "",
            },
            "additional_notes": json.loads(biz_row["additional_notes"] or "[]"),
            "summary": biz_row["summary"] or "",
        }

        menu: list[dict[str, Any]] = []
        for cat in cat_rows:
            items = []
            item_rows = cur.execute(
                "SELECT * FROM menu_items WHERE category_id = ? ORDER BY sort_order, id",
                (cat["id"],),
            ).fetchall()
            for item in item_rows:
                var_rows = cur.execute(
                    """
                    SELECT v.*, i.file_name
                    FROM menu_variants v
                    LEFT JOIN menu_images i ON i.menu_code = v.menu_code
                    WHERE v.menu_item_id = ?
                    ORDER BY v.sort_order, v.id
                    """,
                    (item["id"],),
                ).fetchall()
                items.append(
                    {
                        "slug": item["slug"],
                        "name": item["name"],
                        "flavor_note": item["flavor_note"] or "",
                        "availability_note": item["availability_note"] or "",
                        "group_label": item["group_label"] or "",
                        "variants": [
                            {
                                "menu_code": v["menu_code"],
                                "variant_name": v["variant_name"],
                                "price_idr": v["price_idr"],
                                "is_available": bool(v["is_available"]),
                                "image": {
                                    "menu_code": v["menu_code"],
                                    "file_name": v["file_name"] or f"{v['menu_code']}.webp",
                                    "url": f"material/{v['menu_code']}",
                                    "available": True,
                                },
                            }
                            for v in var_rows
                        ],
                    }
                )
            menu.append(
                {
                    "slug": cat["slug"],
                    "name": cat["name"],
                    "badge": cat["badge"] or "",
                    "description": cat["description"] or "",
                    "upgrade": (
                        {
                            "price_idr": cat["upgrade_price_idr"],
                            "description": cat["upgrade_description"] or "",
                        }
                        if cat["upgrade_price_idr"]
                        else None
                    ),
                    "items": items,
                }
            )
        conn.close()
        return {
            "source": "sqlite",
            "business": business,
            "branches": business["branches"],
            "menu": menu,
        }
    except sqlite3.Error:
        return None


def load_site_data() -> dict[str, Any]:
    db_payload = load_from_sqlite(DB_PATH)
    if db_payload is not None:
        return db_payload

    business_path = resolve_source_file("Chicken LessFille Solo.txt")
    menu_path = resolve_source_file("lessfilemenu.txt")
    material_dir = resolve_material_dir()

    business = parse_business_file(business_path)
    menu = parse_menu_file(menu_path, material_dir)
    return {
        "source": "files",
        "business": business,
        "branches": business["branches"],
        "menu": menu,
    }


def create_flask_app():
    from flask import Flask, abort, jsonify, send_file, send_from_directory

    app = Flask(__name__, static_folder=None)

    @app.get("/")
    def index():
        return send_from_directory(BASE_DIR, "index.html")

    @app.get("/cart")
    @app.get("/cart/")
    def cart_page():
        return send_from_directory(BASE_DIR / "cart", "index.html")

    @app.get("/api/site-data")
    def api_site_data():
        return jsonify(load_site_data())

    @app.get("/api/business")
    def api_business():
        return jsonify({"business": load_site_data()["business"]})

    @app.get("/api/branches")
    def api_branches():
        return jsonify({"branches": load_site_data()["branches"]})

    @app.get("/api/menu")
    def api_menu():
        return jsonify({"menu": load_site_data()["menu"]})

    @app.get("/material/<path:code_or_file>")
    def serve_material(code_or_file: str):
        image_path = resolve_menu_image(code_or_file, resolve_material_dir())
        if not image_path:
            abort(404)
        return send_file(image_path)

    @app.get("/<path:rel_path>")
    def static_files(rel_path: str):
        target = (BASE_DIR / rel_path).resolve()
        if not str(target).startswith(str(BASE_DIR)) or not target.is_file():
            abort(404)
        return send_file(target)

    return app


class StdlibRequestHandler(BaseHTTPRequestHandler):
    def _send_bytes(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send_bytes(status, "application/json; charset=utf-8", body)

    def _send_file(self, path: Path) -> None:
        if not path.is_file():
            self._send_json({"error": "Not found"}, status=404)
            return
        mime, _ = mimetypes.guess_type(str(path))
        if path.suffix.lower() == ".webp":
            mime = "image/webp"
        self._send_bytes(200, mime or "application/octet-stream", path.read_bytes())

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        req_path = unquote(parsed.path)

        if req_path == "/":
            self._send_file(BASE_DIR / "index.html")
            return
        if req_path in ("/cart", "/cart/", "/cart/index.html"):
            self._send_file(BASE_DIR / "cart" / "index.html")
            return
        if req_path == "/api/site-data":
            self._send_json(load_site_data())
            return
        if req_path == "/api/business":
            self._send_json({"business": load_site_data()["business"]})
            return
        if req_path == "/api/branches":
            self._send_json({"branches": load_site_data()["branches"]})
            return
        if req_path == "/api/menu":
            self._send_json({"menu": load_site_data()["menu"]})
            return
        if req_path.startswith("/material/"):
            code = req_path.removeprefix("/material/").strip("/")
            image_path = resolve_menu_image(code, resolve_material_dir())
            if image_path:
                self._send_file(image_path)
            else:
                self._send_json({"error": "Image not found"}, status=404)
            return

        rel = req_path.lstrip("/")
        candidate = (BASE_DIR / rel).resolve()
        if str(candidate).startswith(str(BASE_DIR)) and candidate.is_file():
            self._send_file(candidate)
            return

        self._send_json({"error": "Not found"}, status=404)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[lessfille] {self.address_string()} - {format % args}")


def main() -> None:
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))

    try:
        app = create_flask_app()
        print(f"Serving Chicken LessFille Solo (Flask) at http://{host}:{port}")
        app.run(host=host, port=port, debug=False)
    except ImportError:
        server = ThreadingHTTPServer((host, port), StdlibRequestHandler)
        print(f"Serving Chicken LessFille Solo (stdlib) at http://{host}:{port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
