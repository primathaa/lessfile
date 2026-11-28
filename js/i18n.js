const STORAGE_KEY = "lessfille_lang";
const THEME_KEY = "lessfille_astryx_theme";

export class I18n {
  constructor(basePath = "./") {
    this.basePath = basePath;
    this.lang = this._readInitialLang();
    this.theme = this._readInitialTheme();
    this.dictionaries = {};
    this.listeners = new Set();
    this._applyThemeAttr();
  }

  _readInitialLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "id" || saved === "en") return saved;
    } catch (_) {}
    return "id";
  }

  _readInitialTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "Light" || saved === "Dark") return saved;
    } catch (_) {}
    try {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "Dark";
      }
    } catch (_) {}
    return "Light";
  }

  _applyThemeAttr() {
    if (this.theme === "Dark") {
      document.documentElement.setAttribute("data-astryx-colors", "Dark");
    } else {
      document.documentElement.removeAttribute("data-astryx-colors");
    }
  }

  setTheme(nextTheme) {
    const mode = nextTheme === "Dark" ? "Dark" : "Light";
    this.theme = mode;
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (_) {}
    this._applyThemeAttr();
    this._syncThemeButtons();
  }

  toggleTheme() {
    this.setTheme(this.theme === "Dark" ? "Light" : "Dark");
  }

  async init() {
    const [idDict, enDict] = await Promise.all([
      fetch(`${this.basePath}i18n/id.json`).then((r) => r.json()),
      fetch(`${this.basePath}i18n/en.json`).then((r) => r.json()),
    ]);
    this.dictionaries = { id: idDict, en: enDict };
    this._syncDocumentLang();
    this._applyThemeAttr();
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
    this._syncThemeButtons();
  }

  mountToggle(container) {
    if (!container) return;
    const targets =
      typeof container === "string"
        ? Array.from(document.querySelectorAll(container))
        : [container];

    const render = () => {
      targets.forEach((box) => {
        if (!box) return;
        box.innerHTML = "";
        box.setAttribute("role", "group");
        box.setAttribute("aria-label", this.t("lang.label"));

        const options = [
          { code: "id", label: this.t("lang.id") },
          { code: "en", label: this.t("lang.en") },
        ];
        options.forEach((opt) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `ax-segmented-btn${this.lang === opt.code ? " is-active" : ""}`;
          btn.setAttribute("aria-pressed", String(this.lang === opt.code));
          btn.textContent = opt.label;
          btn.addEventListener("click", () => this.setLang(opt.code));
          box.appendChild(btn);
        });
      });
    };
    render();
    this.onChange(render);
  }

  _syncThemeButtons() {
    const isDark = this.theme === "Dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(isDark));
      btn.setAttribute("aria-label", this.t("theme.toggleAria"));
      const labelEl = btn.querySelector("[data-theme-label]") || btn;
      labelEl.textContent = isDark ? this.t("theme.dark") : this.t("theme.light");
    });
  }

  mountThemeToggle(selector = "[data-theme-toggle]") {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", () => this.toggleTheme());
    });
    this._syncThemeButtons();
    this.onChange(() => this._syncThemeButtons());
  }
}
