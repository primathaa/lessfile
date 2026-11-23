import { CartStore } from "./cart-store.js";
import { bindMenuImage, loadSiteData } from "./data-loader.js";
import { I18n } from "./i18n.js";

const BASE_PATH = "./";
const i18n = new I18n(BASE_PATH);
const cart = new CartStore();

const state = {
  data: null,
  activeCategory: "all",
  searchQuery: "",
  cardSelections: new Map(),
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function normalizeWaNumber(raw) {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function getCardState(itemKey) {
  if (!state.cardSelections.has(itemKey)) {
    state.cardSelections.set(itemKey, { variantIdx: 0, upgradeCombo: false });
  }
  return state.cardSelections.get(itemKey);
}

function updateCartChrome() {
  const { totalItems, subtotal } = cart.getTotals();
  const badge = document.getElementById("header-cart-badge");
  if (badge) badge.textContent = String(totalItems);

  const floatWrap = document.getElementById("floating-cart");
  const floatCount = document.getElementById("floating-cart-count");
  const floatTotal = document.getElementById("floating-cart-total");

  if (!floatWrap) return;
  if (totalItems > 0) {
    floatWrap.hidden = false;
    floatCount.textContent = i18n.t("floatingCart.items", { count: totalItems });
    floatTotal.textContent = i18n.formatIDR(subtotal);
  } else {
    floatWrap.hidden = true;
  }
}

function renderHeroAndHighlights() {
  const { business, branches } = state.data;
  document.title = i18n.t("meta.homeTitle");

  const headerBrand = document.getElementById("brand-name-header");
  const footerBrand = document.getElementById("brand-name-footer");
  const heroTitle = document.getElementById("hero-title");
  const heroLead = document.getElementById("hero-lead");

  if (headerBrand) headerBrand.textContent = business.name;
  if (footerBrand) footerBrand.textContent = business.name;
  if (heroTitle) heroTitle.textContent = business.name;
  if (heroLead) heroLead.textContent = i18n.tx(business.summary || business.profile_history);

  const strip = document.getElementById("highlights-strip");
  if (!strip) return;
  strip.innerHTML = "";

  const highlightEntries = [];
  business.packages.forEach((pkg) => {
    highlightEntries.push({
      label: i18n.tx(pkg.name),
      value: i18n.tx(pkg.starting_price_note || pkg.features[0] || ""),
    });
  });
  if (branches.length > 0) {
    highlightEntries.push({
      label: i18n.t("branches.sectionEyebrow"),
      value: branches.map((b) => b.area).join(" · "),
    });
  }

  highlightEntries.slice(0, 3).forEach((entry) => {
    const card = el("div", "ui-card p-3.5 sm:p-4");
    card.appendChild(el("div", "mb-1 text-[11px] font-extrabold uppercase tracking-wider text-primary", entry.label));
    card.appendChild(el("div", "text-sm font-bold text-ink leading-snug", entry.value));
    strip.appendChild(card);
  });
}

function renderCategoryTabs() {
  const container = document.getElementById("category-tabs");
  if (!container || !state.data) return;
  container.innerHTML = "";

  const tabs = [
    { slug: "all", label: i18n.t("menu.allCategories") },
    ...state.data.menu.map((cat) => ({
      slug: cat.slug,
      label: i18n.tx(cat.name),
    })),
  ];

  tabs.forEach((tab) => {
    const btn = el("button", `ui-tab${state.activeCategory === tab.slug ? " is-active" : ""}`, tab.label);
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(state.activeCategory === tab.slug));
    btn.addEventListener("click", () => {
      state.activeCategory = tab.slug;
      renderCategoryTabs();
      renderMenu();
    });
    container.appendChild(btn);
  });
}

function createMenuCard(cat, item) {
  const itemKey = `${cat.slug}::${item.slug}`;
  const sel = getCardState(itemKey);
  const variant = item.variants[sel.variantIdx] || item.variants[0];
  const upgradeExtra = cat.upgrade && sel.upgradeCombo ? cat.upgrade.price_idr : 0;
  const activePrice = variant.price_idr + upgradeExtra;
  const cartKey = cart.buildKey(variant.menu_code, Boolean(cat.upgrade && sel.upgradeCombo));
  const qty = cart.getQty(cartKey);

  const card = el(
    "article",
    "ui-card group overflow-hidden grid grid-cols-[100px_minmax(0,1fr)] sm:flex sm:flex-col transition-shadow hover:shadow-[0_6px_20px_rgba(18,20,22,0.08)]"
  );

  const media = el("div", "relative h-full min-h-[112px] sm:h-auto sm:aspect-square w-full bg-[#141517] overflow-hidden");
  const img = el("img", "menu-img h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]");
  img.loading = "lazy";
  img.alt = `${i18n.tx(item.name)} — ${i18n.tx(variant.variant_name)}`;
  bindMenuImage(img, variant.menu_code, BASE_PATH, state.data.mode);
  media.appendChild(img);
  media.appendChild(
    el("span", "absolute top-2 left-2 rounded-full bg-dark-canvas/80 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white", `#${variant.menu_code}`)
  );
  card.appendChild(media);

  const body = el("div", "flex min-w-0 flex-1 flex-col gap-2.5 p-3 sm:p-4");
  const titleRow = el("div", "flex flex-col gap-1");
  if (item.group_label) {
    titleRow.appendChild(el("span", "text-[11px] font-extrabold uppercase tracking-wider text-primary", i18n.tx(item.group_label)));
  }
  titleRow.appendChild(el("h3", "text-sm sm:text-base font-extrabold leading-snug text-ink break-words", i18n.tx(item.name)));
  if (item.flavor_note) {
    titleRow.appendChild(el("p", "text-xs text-ink-muted leading-snug", i18n.tx(item.flavor_note)));
  }
  if (item.availability_note) {
    titleRow.appendChild(el("span", "ui-badge ui-badge-muted mt-0.5 w-fit", i18n.tx(item.availability_note)));
  }
  body.appendChild(titleRow);

  if (item.variants.length > 1) {
    const vRow = el("div", "flex flex-wrap gap-1.5");
    item.variants.forEach((v, idx) => {
      const vBtn = el(
        "button",
        `ui-variant-btn${idx === sel.variantIdx ? " is-active" : ""}`,
        i18n.tx(v.variant_name)
      );
      vBtn.type = "button";
      vBtn.setAttribute("aria-pressed", String(idx === sel.variantIdx));
      vBtn.addEventListener("click", () => {
        sel.variantIdx = idx;
        renderMenu();
      });
      vRow.appendChild(vBtn);
    });
    body.appendChild(vRow);
  }

  if (cat.upgrade) {
    const upgradeLabel = el(
      "label",
      "flex min-h-[38px] items-center gap-2 rounded-lg border border-dashed border-border bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-ink-secondary cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary"
    );
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "h-4 w-4 shrink-0 accent-primary";
    checkbox.checked = sel.upgradeCombo;
    checkbox.addEventListener("change", () => {
      sel.upgradeCombo = checkbox.checked;
      renderMenu();
    });
    upgradeLabel.appendChild(checkbox);
    upgradeLabel.appendChild(el("span", "leading-tight", i18n.t("menu.upgradeToggle")));
    body.appendChild(upgradeLabel);
  }

  const footer = el("div", "mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5");
  footer.appendChild(el("span", "text-sm sm:text-base font-extrabold text-ink whitespace-nowrap tabular-nums", i18n.formatIDR(activePrice)));

  if (qty > 0) {
    const stepper = el("div", "ui-stepper");
    const decBtn = el("button", "ui-stepper-btn", "−");
    decBtn.type = "button";
    decBtn.setAttribute("aria-label", "Decrease quantity");
    decBtn.addEventListener("click", () => cart.updateQty(cartKey, -1));

    const val = el("span", "ui-stepper-val", String(qty));

    const incBtn = el("button", "ui-stepper-btn", "+");
    incBtn.type = "button";
    incBtn.setAttribute("aria-label", "Increase quantity");
    incBtn.addEventListener("click", () => cart.updateQty(cartKey, 1));

    stepper.append(decBtn, val, incBtn);
    footer.appendChild(stepper);
  } else {
    const addBtn = el("button", "ui-btn-sm ui-btn-primary", `+ ${i18n.t("menu.addToCart")}`);
    addBtn.type = "button";
    addBtn.addEventListener("click", () => {
      cart.addItem({
        menuCode: variant.menu_code,
        itemName: item.name,
        variantName: variant.variant_name,
        categoryName: cat.name,
        upgradeCombo: Boolean(cat.upgrade && sel.upgradeCombo),
        unitPrice: activePrice,
      });
    });
    footer.appendChild(addBtn);
  }

  body.appendChild(footer);
  card.appendChild(body);
  return card;
}

function renderMenu() {
  const container = document.getElementById("menu-container");
  if (!container || !state.data) return;
  container.innerHTML = "";

  const q = state.searchQuery.trim().toLowerCase();
  let matchedCategories = 0;

  state.data.menu.forEach((cat) => {
    if (state.activeCategory !== "all" && state.activeCategory !== cat.slug) {
      return;
    }

    const filteredItems = cat.items.filter((item) => {
      if (!q) return true;
      const haystack = [
        cat.name,
        i18n.tx(cat.name),
        item.name,
        i18n.tx(item.name),
        item.flavor_note,
        i18n.tx(item.flavor_note),
        item.group_label,
        ...item.variants.flatMap((v) => [v.menu_code, v.variant_name]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    if (filteredItems.length === 0) return;
    matchedCategories += 1;

    const block = el("div", "mb-8 last:mb-0");
    const head = el("div", "mb-2.5 flex flex-wrap items-center gap-2");
    head.appendChild(el("h3", "text-base sm:text-lg font-extrabold tracking-tight text-ink", i18n.tx(cat.name)));
    if (cat.badge) {
      head.appendChild(el("span", "ui-badge ui-badge-primary", i18n.tx(cat.badge)));
    }
    head.appendChild(
      el("span", "ml-auto text-xs font-semibold text-ink-muted", i18n.t("menu.itemCount", { count: filteredItems.length }))
    );
    block.appendChild(head);

    if (cat.description) {
      block.appendChild(
        el("p", "mb-3.5 rounded-lg border-l-4 border-primary bg-surface px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed text-ink-secondary shadow-[0_1px_2px_rgba(18,20,22,0.04)]", i18n.tx(cat.description))
      );
    }
    if (cat.upgrade && cat.upgrade.description) {
      block.appendChild(
        el("p", "mb-3.5 rounded-lg border-l-4 border-primary bg-surface px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed text-ink-secondary shadow-[0_1px_2px_rgba(18,20,22,0.04)]", i18n.tx(cat.upgrade.description))
      );
    }

    const grid = el("div", "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4");
    filteredItems.forEach((item) => grid.appendChild(createMenuCard(cat, item)));
    block.appendChild(grid);
    container.appendChild(block);
  });

  if (matchedCategories === 0) {
    const empty = el("div", "ui-card flex flex-col items-center gap-3 p-8 text-center");
    empty.appendChild(el("p", "text-sm text-ink-secondary", i18n.t("menu.emptySearch")));
    const resetBtn = el("button", "ui-btn ui-btn-outline", i18n.t("menu.resetFilter"));
    resetBtn.type = "button";
    resetBtn.addEventListener("click", () => {
      state.activeCategory = "all";
      state.searchQuery = "";
      const searchEl = document.getElementById("menu-search");
      if (searchEl) searchEl.value = "";
      renderCategoryTabs();
      renderMenu();
    });
    empty.appendChild(resetBtn);
    container.appendChild(empty);
  }
}

function renderBusinessSection() {
  const container = document.getElementById("business-container");
  if (!container || !state.data) return;
  const { business } = state.data;
  container.innerHTML = "";

  const historyCard = el("article", "ui-card p-5 sm:p-6 lg:col-span-7");
  historyCard.appendChild(el("h3", "mb-2 text-base sm:text-lg font-extrabold text-ink", i18n.t("business.historyTitle")));
  historyCard.appendChild(el("p", "text-sm leading-relaxed text-ink-secondary", i18n.tx(business.profile_history)));

  if (business.packages.length > 0) {
    const pkgWrap = el("div", "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2");
    business.packages.forEach((pkg) => {
      const box = el("div", "rounded-lg border border-border bg-surface-muted p-4");
      const head = el("div", "mb-2.5 flex flex-wrap items-baseline justify-between gap-2");
      head.appendChild(el("h4", "text-sm sm:text-base font-extrabold text-ink", i18n.tx(pkg.name)));
      if (pkg.starting_price_note) {
        head.appendChild(el("span", "ui-badge ui-badge-soft", i18n.tx(pkg.starting_price_note)));
      }
      box.appendChild(head);
      const list = el("ul", "list-disc space-y-1.5 pl-4 text-xs sm:text-sm text-ink-secondary");
      pkg.features.forEach((feat) => list.appendChild(el("li", "", i18n.tx(feat))));
      box.appendChild(list);
      pkgWrap.appendChild(box);
    });
    historyCard.appendChild(pkgWrap);
  }
  container.appendChild(historyCard);

  const expCard = el("article", "ui-card p-5 sm:p-6 lg:col-span-5");
  expCard.appendChild(el("h3", "mb-2.5 text-base sm:text-lg font-extrabold text-ink", i18n.t("business.experienceTitle")));
  const expList = el("ul", "list-disc space-y-2 pl-4 text-sm text-ink-secondary");
  business.dining_experience.forEach((line) => expList.appendChild(el("li", "", i18n.tx(line))));
  expCard.appendChild(expList);

  if (business.sauces.length > 0) {
    expCard.appendChild(
      el("h3", "mt-5 mb-2.5 text-base font-extrabold text-ink", i18n.tx(business.sauces_note) || i18n.t("business.saucesTitle"))
    );
    const pills = el("div", "flex flex-wrap gap-2");
    business.sauces.forEach((s) =>
      pills.appendChild(el("span", "rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-ink", i18n.tx(s)))
    );
    expCard.appendChild(pills);
  }
  container.appendChild(expCard);

  if (business.additional_notes.length > 0) {
    const notesCard = el("article", "ui-card p-5 sm:p-6 lg:col-span-6");
    notesCard.appendChild(el("h3", "mb-2.5 text-base sm:text-lg font-extrabold text-ink", i18n.t("business.notesTitle")));
    const notesList = el("ul", "list-disc space-y-2 pl-4 text-sm text-ink-secondary");
    business.additional_notes.forEach((note) => notesList.appendChild(el("li", "", i18n.tx(note))));
    notesCard.appendChild(notesList);
    container.appendChild(notesCard);
  }

  if (business.summary) {
    const sumCard = el("article", "rounded-xl bg-dark-canvas p-5 sm:p-6 text-white lg:col-span-6");
    sumCard.appendChild(el("h3", "mb-2 text-base sm:text-lg font-extrabold text-white", i18n.t("business.summaryTitle")));
    sumCard.appendChild(el("p", "text-sm leading-relaxed text-[#DDE4E2]", i18n.tx(business.summary)));
    container.appendChild(sumCard);
  }
}

function renderBranches() {
  const container = document.getElementById("branches-container");
  if (!container || !state.data) return;
  container.innerHTML = "";

  state.data.branches.forEach((branch) => {
    const card = el("article", "ui-card flex flex-col gap-2.5 p-5");
    card.appendChild(
      el("span", "ui-badge ui-badge-soft w-fit", i18n.t("branches.branchLabel", { num: branch.branch_number }))
    );
    card.appendChild(el("h3", "text-base font-extrabold text-ink", branch.name));
    card.appendChild(el("p", "flex-1 text-sm leading-relaxed text-ink-secondary", branch.address));

    const mapLink = el("a", "ui-btn ui-btn-outline mt-1 w-full sm:w-fit text-xs sm:text-sm", i18n.t("branches.openMap"));
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${branch.name} ${branch.address}`
    )}`;
    mapLink.target = "_blank";
    mapLink.rel = "noopener noreferrer";
    card.appendChild(mapLink);

    container.appendChild(card);
  });
}

function renderContact() {
  const container = document.getElementById("contact-container");
  if (!container || !state.data) return;
  const { contact } = state.data.business;
  container.innerHTML = "";

  const items = [];
  if (contact.whatsapp) {
    items.push({
      label: i18n.t("contact.whatsapp"),
      value: contact.whatsapp,
      href: `https://wa.me/${normalizeWaNumber(contact.whatsapp)}`,
    });
  }
  if (contact.email) {
    items.push({
      label: i18n.t("contact.email"),
      value: contact.email,
      href: `mailto:${contact.email}`,
    });
  }
  if (contact.instagram) {
    const handle = contact.instagram.replace(/^@/, "");
    items.push({
      label: i18n.t("contact.instagram"),
      value: contact.instagram,
      href: `https://instagram.com/${handle}`,
    });
  }
  if (contact.tiktok) {
    const handle = contact.tiktok.replace(/^@/, "");
    items.push({
      label: i18n.t("contact.tiktok"),
      value: contact.tiktok,
      href: `https://www.tiktok.com/@${handle}`,
    });
  }
  if (contact.linktree) {
    const href = contact.linktree.startsWith("http")
      ? contact.linktree
      : `https://${contact.linktree}`;
    items.push({
      label: i18n.t("contact.linktree"),
      value: contact.linktree,
      href,
    });
  }

  items.forEach((item) => {
    const link = el(
      "a",
      "ui-card flex min-h-[72px] flex-col justify-center gap-1 p-4 transition-all hover:border-primary hover:-translate-y-0.5"
    );
    link.href = item.href;
    if (item.href.startsWith("http")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    link.appendChild(el("span", "text-[11px] font-extrabold uppercase tracking-wider text-ink-muted", item.label));
    link.appendChild(el("span", "text-sm font-bold text-ink break-words", item.value));
    container.appendChild(link);
  });
}

function renderAll() {
  i18n.applyStaticTranslations();
  if (!state.data) return;
  renderHeroAndHighlights();
  renderCategoryTabs();
  renderMenu();
  renderBusinessSection();
  renderBranches();
  renderContact();
  updateCartChrome();
}

async function boot() {
  await i18n.init();
  i18n.mountToggle(document.getElementById("lang-toggle"));
  i18n.applyStaticTranslations();

  const searchInput = document.getElementById("menu-search");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.searchQuery = event.target.value;
      renderMenu();
    });
  }

  i18n.onChange(() => renderAll());
  cart.subscribe(() => {
    updateCartChrome();
    if (state.data) renderMenu();
  });

  try {
    state.data = await loadSiteData(BASE_PATH);
    renderAll();
  } catch (err) {
    const container = document.getElementById("menu-container");
    if (container) {
      container.innerHTML = "";
      container.appendChild(el("div", "ui-card p-7 text-center text-sm text-ink-secondary", i18n.t("menu.error")));
    }
    console.error(err);
  }
}

boot();
