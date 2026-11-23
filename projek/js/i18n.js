const STORAGE_KEY = "lessfille_lang";

export class I18n {
  constructor(basePath = "./") {
    this.basePath = basePath;
    this.lang = this._readInitialLang();
    this.dictionaries = {};
    this.listeners = new Set();
  }

  _readInitialLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "id" || saved === "en") return saved;
    } catch (_) {}
    return "id";
  }

  async init() {
    const [idDict, enDict] = await Promise.all([
      fetch(`${this.basePath}i18n/id.json`).then((r) => r.json()),
      fetch(`${this.basePath}i18n/en.json`).then((r) => r.json()),
    ]);
    this.dictionaries = { id: idDict, en: enDict };
    this._syncDocumentLang();
  }

  _syncDocumentLang() {
    document.documentElement.lang = this.lang === "en" ? "en" : "id";
  }

  setLang(nextLang) {
    if (nextLang !== "id" && nextLang !== "en") return;
    if (this.lang === nextLang) return;
    this.lang = nextLang;
    try {
      localStorage.setItem(STORAGE_KEY, nextLang);
    } catch (_) {}
    this._syncDocumentLang();
    this.listeners.forEach((fn) => fn(this.lang));
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  t(key, vars = {}) {
    const dict = this.dictionaries[this.lang] || this.dictionaries.id || {};
    const parts = key.split(".");
    let val = dict;
    for (const part of parts) {
      val = val && typeof val === "object" ? val[part] : undefined;
    }
    if (typeof val !== "string") return key;
    return val.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
  }

  // Translates dynamic phrases parsed from source files/DB when English is active.
  tx(rawText) {
    if (!rawText) return "";
    const trimmed = String(rawText).trim();
    if (this.lang === "id") return trimmed;
    const contentMap = (this.dictionaries.en && this.dictionaries.en.content) || {};
    return contentMap[trimmed] || trimmed;
  }

  formatIDR(amount) {
    const num = Number(amount) || 0;
    const locale = this.lang === "en" ? "en-US" : "id-ID";
    return `Rp ${num.toLocaleString(locale)}`;
  }

  applyStaticTranslations(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = this.t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", this.t(el.getAttribute("data-i18n-placeholder")));
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", this.t(el.getAttribute("data-i18n-aria")));
    });
    root.querySelectorAll("[data-i18n-alt]").forEach((el) => {
      el.setAttribute("alt", this.t(el.getAttribute("data-i18n-alt")));
    });
  }

  mountToggle(container) {
    if (!container) return;
    const render = () => {
      container.innerHTML = "";
      container.setAttribute("role", "group");
      container.setAttribute("aria-label", this.t("lang.label"));

      const options = [
        { code: "id", label: this.t("lang.id") },
        { code: "en", label: this.t("lang.en") },
      ];
      options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `lang-btn${this.lang === opt.code ? " is-active" : ""}`;
        btn.setAttribute("aria-pressed", String(this.lang === opt.code));
        btn.textContent = opt.label;
        btn.addEventListener("click", () => this.setLang(opt.code));
        container.appendChild(btn);
      });
    };
    render();
    this.onChange(render);
  }
}
