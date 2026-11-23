const CART_KEY = "lessfille_cart_v1";

export class CartStore {
  constructor() {
    this.items = this._load();
    this.listeners = new Set();
  }

  _load() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  _save() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(this.items));
    } catch (_) {}
    this.listeners.forEach((fn) => fn(this.items));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  buildKey(menuCode, upgradeCombo = false) {
    return `${menuCode}${upgradeCombo ? "::paket" : ""}`;
  }

  getItems() {
    return this.items;
  }

  getQty(key) {
    const found = this.items.find((item) => item.key === key);
    return found ? found.qty : 0;
  }

  addItem(entry) {
    const key = this.buildKey(entry.menuCode, Boolean(entry.upgradeCombo));
    const existing = this.items.find((item) => item.key === key);
    if (existing) {
      existing.qty += 1;
    } else {
      this.items.push({
        key,
        menuCode: entry.menuCode,
        itemName: entry.itemName,
        variantName: entry.variantName,
        categoryName: entry.categoryName,
        upgradeCombo: Boolean(entry.upgradeCombo),
        unitPrice: Number(entry.unitPrice) || 0,
        qty: 1,
        note: "",
      });
    }
    this._save();
  }

  updateQty(key, delta) {
    const idx = this.items.findIndex((item) => item.key === key);
    if (idx === -1) return;
    const nextQty = this.items[idx].qty + delta;
    if (nextQty <= 0) {
      this.items.splice(idx, 1);
    } else {
      this.items[idx].qty = nextQty;
    }
    this._save();
  }

  setNote(key, note) {
    const found = this.items.find((item) => item.key === key);
    if (!found) return;
    found.note = String(note || "").slice(0, 140);
    this._save();
  }

  removeItem(key) {
    this.items = this.items.filter((item) => item.key !== key);
    this._save();
  }

  clear() {
    this.items = [];
    this._save();
  }

  getTotals() {
    let totalItems = 0;
    let subtotal = 0;
    for (const item of this.items) {
      totalItems += item.qty;
      subtotal += item.qty * item.unitPrice;
    }
    return { totalItems, subtotal };
  }
}
