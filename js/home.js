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
  orderMode: "takeAway",
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

function isAddonCategory(cat) {
  const slug = String(cat.slug || "").toLowerCase();
  const name = String(cat.name || "").toLowerCase();
  return slug.includes("add-on") || name.includes("add-on");
}

function getCategoryBadgeMeta(cat, item) {
  if (cat.badge) {
    const isReguler = cat.slug.includes("reguler");
    return {
      text: i18n.tx(cat.badge),
      cls: isReguler ? "ax-badge-success" : "ax-badge-primary",
    };
  }
  if (cat.slug.includes("ekonomis")) {
    return { text: "EKONOMIS", cls: "ax-badge-soft" };
  }
  if (cat.slug.includes("alacarte")) {
    return { text: "ALACARTE", cls: "ax-badge-muted" };
  }
  if (item.flavor_note) {
    return { text: i18n.tx(item.flavor_note), cls: "ax-badge-warning" };
  }
  return null;
}

function renderHeroAndHighlights() {
  const { business, branches, menu } = state.data;
  document.title = i18n.t("meta.homeTitle");

  const headerBrand = document.getElementById("brand-name-header");
  const sidenavBrand = document.getElementById("brand-name-sidenav");
  const footerBrand = document.getElementById("brand-name-footer");
  const heroTitle = document.getElementById("hero-title");
  const heroLead = document.getElementById("hero-lead");
  const sideBranches = document.getElementById("sidenav-branches-summary");

  if (headerBrand) headerBrand.textContent = business.name;
  if (sidenavBrand) sidenavBrand.textContent = business.name.replace(/^Chicken\s+/i, "");
  if (footerBrand) footerBrand.textContent = business.name;
  if (heroTitle) heroTitle.textContent = business.name;
  if (heroLead) heroLead.textContent = i18n.tx(business.summary || business.profile_history);
  if (sideBranches && branches.length > 0) {
    sideBranches.textContent = branches.map((b) => b.area).join(" · ");
  }

  const regulerCat = menu.find((c) => c.slug.includes("reguler"));
  const regulerBannerText = document.getElementById("reguler-guarantee-text");
  if (regulerBannerText && regulerCat && regulerCat.description) {
    regulerBannerText.textContent = i18n.tx(regulerCat.description);
  }

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
    const card = el("div", "ax-card flex flex-col justify-center");
    card.appendChild(el("div", "ax-caption text-text-accent mb-0.5", entry.label));
    card.appendChild(el("div", "text-xs sm:text-sm font-extrabold text-text-primary leading-snug", entry.value));
    strip.appendChild(card);
  });
}

function formatSideNavCategoryLabel(cat) {
  const raw = i18n.tx(cat.name)
    .replace(/\s+BY\s+LESSFILLE/i, "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bLessfille\b/g, "LessFille");
  if (cat.badge) {
    return `${raw} (${i18n.tx(cat.badge)})`;
  }
  return raw;
}

function renderCategoryNavigation() {
  if (!state.data) return;
  const mobileTabs = document.getElementById("category-tabs");
  const sideNav = document.getElementById("sidenav-categories");

  const tabs = [
    { slug: "all", label: i18n.t("menu.allCategories"), sideLabel: i18n.t("menu.allCategories") },
    ...state.data.menu.map((cat) => ({
      slug: cat.slug,
      label: i18n.tx(cat.name),
      sideLabel: formatSideNavCategoryLabel(cat),
    })),
  ];

  if (mobileTabs) {
    mobileTabs.innerHTML = "";
    tabs.forEach((tab) => {
      const btn = el(
        "button",
        `ax-pill-tab${state.activeCategory === tab.slug ? " is-active" : ""}`,
        tab.label
      );
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(state.activeCategory === tab.slug));
      btn.addEventListener("click", () => {
        state.activeCategory = tab.slug;
        renderCategoryNavigation();
        renderMenu();
      });
      mobileTabs.appendChild(btn);
    });
  }

  if (sideNav) {
    sideNav.innerHTML = "";
    tabs.forEach((tab) => {
      const btn = el(
        "button",
        `ax-nav-item${state.activeCategory === tab.slug ? " is-active" : ""}`
      );
      btn.type = "button";
      btn.appendChild(el("span", "truncate", tab.sideLabel));
      btn.addEventListener("click", () => {
        state.activeCategory = tab.slug;
        renderCategoryNavigation();
        renderMenu();
        document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
      });
      sideNav.appendChild(btn);
    });
  }
}

function buildStepperControl(cartKey, qty) {
  const stepper = el("div", "ax-stepper");
  const decBtn = el("button", "ax-stepper-dec", "−");
  decBtn.type = "button";
  decBtn.setAttribute("aria-label", "Decrease quantity");
  decBtn.addEventListener("click", () => cart.updateQty(cartKey, -1));

  const val = el("span", "ax-stepper-val", String(qty));

  const incBtn = el("button", "ax-stepper-inc", "+");
  incBtn.type = "button";
  incBtn.setAttribute("aria-label", "Increase quantity");
  incBtn.addEventListener("click", () => cart.updateQty(cartKey, 1));

  stepper.append(decBtn, val, incBtn);
  return stepper;
}

function createMenuCard(cat, item) {
  const itemKey = `${cat.slug}::${item.slug}`;
  const sel = getCardState(itemKey);
  const variant = item.variants[sel.variantIdx] || item.variants[0];
  const upgradeExtra = cat.upgrade && sel.upgradeCombo ? cat.upgrade.price_idr : 0;
  const activePrice = variant.price_idr + upgradeExtra;
  const cartKey = cart.buildKey(variant.menu_code, Boolean(cat.upgrade && sel.upgradeCombo));
  const qty = cart.getQty(cartKey);

  // Astryx Card Pattern: Outer 12px radius, 12px padding, Inner 8px concentric image
  const card = el("article", "ax-card flex flex-col justify-between gap-2.5");

  const topGroup = el("div", "flex flex-col gap-2");
  const media = el("div", "ax-card-media aspect-[4/3] w-full");
  const img = el("img", "menu-img h-full w-full object-cover");
  img.loading = "lazy";
  img.alt = `${i18n.tx(item.name)} — ${i18n.tx(variant.variant_name)}`;
  bindMenuImage(img, variant.menu_code, BASE_PATH, state.data.mode);
  media.appendChild(img);

  const badgeMeta = getCategoryBadgeMeta(cat, item);
  if (badgeMeta) {
    media.appendChild(
      el("span", `ax-badge ${badgeMeta.cls} absolute top-2 left-2 shadow-2xs`, badgeMeta.text)
    );
  }
  topGroup.appendChild(media);

  const info = el("div", "space-y-0.5");
  info.appendChild(
    el("h4", "text-xs sm:text-sm lg:text-[15px] font-extrabold leading-snug text-text-primary break-words", i18n.tx(item.name))
  );

  const subParts = [`${i18n.t("menu.codePrefix")} ${variant.menu_code}`];
  if (item.flavor_note) subParts.push(i18n.tx(item.flavor_note));
  else if (cat.badge) subParts.push(i18n.tx(cat.badge));
  info.appendChild(
    el("p", "text-[11px] sm:text-xs text-text-secondary leading-snug", subParts.join(" · "))
  );

  if (item.availability_note) {
    info.appendChild(
      el("div", "pt-0.5 text-[10px] font-bold text-text-secondary", i18n.tx(item.availability_note))
    );
  }
  topGroup.appendChild(info);

  if (item.variants.length > 1) {
    const vRow = el("div", "ax-segmented grid grid-cols-2 w-full");
    item.variants.forEach((v, idx) => {
      const vBtn = el(
        "button",
        `ax-segmented-btn text-[11px] min-h-[30px] px-1.5 py-0.5${idx === sel.variantIdx ? " is-active" : ""}`,
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
    topGroup.appendChild(vRow);
  }

  if (cat.upgrade) {
    const upBtn = el(
      "button",
      `ax-btn w-full min-h-[32px] px-2 py-1 text-[11px] ${
        sel.upgradeCombo ? "ax-btn-primary" : "ax-btn-soft"
      }`,
      i18n.t("menu.upgradeToggle")
    );
    upBtn.type = "button";
    upBtn.setAttribute("aria-pressed", String(sel.upgradeCombo));
    upBtn.addEventListener("click", () => {
      sel.upgradeCombo = !sel.upgradeCombo;
      renderMenu();
    });
    topGroup.appendChild(upBtn);
  }

  card.appendChild(topGroup);

  const footer = el(
    "div",
    "mt-auto flex flex-wrap items-center justify-between gap-1.5 border-t border-border-subtle pt-2"
  );
  const priceBlock = el("div", "min-w-0");
  priceBlock.appendChild(
    el("div", "text-xs sm:text-sm lg:text-[15px] font-extrabold text-text-accent tabular-nums", i18n.formatIDR(activePrice))
  );
  priceBlock.appendChild(
    el("div", "text-[10px] text-text-secondary hidden sm:block", `${i18n.t("menu.codePrefix")} ${variant.menu_code}`)
  );
  footer.appendChild(priceBlock);

  if (qty > 0) {
    footer.appendChild(buildStepperControl(cartKey, qty));
  } else {
    const addBtn = el(
      "button",
      "ax-btn ax-btn-primary min-h-[34px] px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-extrabold",
      `+ ${i18n.t("menu.addToCart")}`
    );
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

  card.appendChild(footer);
  return card;
}

function createAddonRow(cat, item) {
  const variant = item.variants[0];
  const cartKey = cart.buildKey(variant.menu_code, false);
  const qty = cart.getQty(cartKey);

  // Astryx Principle #3: Dense data renders as edge-to-edge rows with dividers
  const row = el("article", "ax-list-item");

  const left = el("div", "flex min-w-0 items-center gap-3");
  const thumbWrap = el("div", "ax-card-media h-10 w-10 shrink-0");
  const img = el("img", "menu-img h-full w-full object-cover");
  img.loading = "lazy";
  img.alt = i18n.tx(item.name);
  bindMenuImage(img, variant.menu_code, BASE_PATH, state.data.mode);
  thumbWrap.appendChild(img);
  left.appendChild(thumbWrap);

  const meta = el("div", "min-w-0");
  meta.appendChild(el("h4", "text-xs sm:text-sm font-extrabold text-text-primary truncate", i18n.tx(item.name)));
  const subParts = [`${i18n.t("menu.codePrefix")} ${variant.menu_code}`];
  if (item.group_label) subParts.push(i18n.tx(item.group_label));
  else subParts.push(i18n.tx(cat.name));
  meta.appendChild(el("p", "text-[11px] text-text-secondary truncate", subParts.join(" · ")));
  left.appendChild(meta);

  const right = el("div", "flex shrink-0 items-center gap-3");
  right.appendChild(
    el("span", "text-xs sm:text-sm font-extrabold text-text-primary tabular-nums", i18n.formatIDR(variant.price_idr))
  );

  if (qty > 0) {
    right.appendChild(buildStepperControl(cartKey, qty));
  } else {
    const addBtn = el(
      "button",
      "ax-btn ax-btn-soft min-h-[34px] px-3 py-1.5 text-xs font-extrabold",
      `+ ${i18n.t("menu.addToCart")}`
    );
    addBtn.type = "button";
    addBtn.addEventListener("click", () => {
      cart.addItem({
        menuCode: variant.menu_code,
        itemName: item.name,
        variantName: variant.variant_name,
        categoryName: cat.name,
        upgradeCombo: false,
        unitPrice: variant.price_idr,
      });
    });
    right.appendChild(addBtn);
  }

  row.append(left, right);
  return row;
}

function renderMenu() {
  const container = document.getElementById("menu-container");
  const subEl = document.getElementById("menu-section-subtitle");
  if (!container || !state.data) return;
  container.innerHTML = "";

  const totalItemsCount = state.data.menu.reduce((acc, c) => acc + c.items.length, 0);
  if (subEl) {
    subEl.textContent = i18n.t("shell.allPickedSub", { count: totalItemsCount });
  }

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

    const block = el("div", "mb-7 last:mb-0");
    block.id = `cat-${cat.slug}`;

    const head = el("div", "mb-2.5 flex flex-wrap items-center gap-2");
    head.appendChild(el("h3", "text-base sm:text-lg font-extrabold text-text-primary", i18n.tx(cat.name)));
    if (cat.badge) {
      head.appendChild(el("span", "ax-badge ax-badge-primary", i18n.tx(cat.badge)));
    }
    head.appendChild(
      el("span", "ml-auto text-xs font-bold text-text-secondary", i18n.t("menu.itemCount", { count: filteredItems.length }))
    );
    block.appendChild(head);

    if (cat.description) {
      block.appendChild(
        el(
          "p",
          "mb-3 rounded-[var(--radius-element)] border-l-4 border-accent bg-bg-card px-3.5 py-2.5 text-xs leading-relaxed text-text-secondary shadow-[var(--shadow-low)]",
          i18n.tx(cat.description)
        )
      );
    }
    if (cat.upgrade && cat.upgrade.description) {
      block.appendChild(
        el(
          "p",
          "mb-3 rounded-[var(--radius-element)] border-l-4 border-accent bg-bg-card px-3.5 py-2.5 text-xs leading-relaxed text-text-secondary shadow-[var(--shadow-low)]",
          i18n.tx(cat.upgrade.description)
        )
      );
    }

    if (isAddonCategory(cat)) {
      const list = el("div", "ax-list");
      filteredItems.forEach((item) => list.appendChild(createAddonRow(cat, item)));
      block.appendChild(list);
    } else {
      // 2 columns on mobile (< 1024px), 3 columns on desktop AppShell (>= 1024px)
      const grid = el("div", "grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-3");
      filteredItems.forEach((item) => grid.appendChild(createMenuCard(cat, item)));
      block.appendChild(grid);
    }

    container.appendChild(block);
  });

  if (matchedCategories === 0) {
    const empty = el("div", "ax-card-padded flex flex-col items-center gap-3 py-8 text-center");
    empty.appendChild(el("p", "text-sm text-text-secondary", i18n.t("menu.emptySearch")));
    const resetBtn = el("button", "ax-btn ax-btn-outline", i18n.t("menu.resetFilter"));
    resetBtn.type = "button";
    resetBtn.addEventListener("click", () => {
      state.activeCategory = "all";
      state.searchQuery = "";
      const searchEl = document.getElementById("menu-search");
      const searchMobEl = document.getElementById("menu-search-mobile");
      if (searchEl) searchEl.value = "";
      if (searchMobEl) searchMobEl.value = "";
      renderCategoryNavigation();
      renderMenu();
    });
    empty.appendChild(resetBtn);
    container.appendChild(empty);
  }
}

function populateInspectorBranches() {
  const select = document.getElementById("inspector-branch");
  if (!select || !state.data) return;
  const previous = select.value;
  select.innerHTML = "";

  const placeholder = el("option", "", i18n.t("cart.branchPlaceholder"));
  placeholder.value = "";
  select.appendChild(placeholder);

  state.data.branches.forEach((branch) => {
    const opt = el("option", "", branch.name);
    opt.value = branch.name;
    select.appendChild(opt);
  });

  if (previous) select.value = previous;
  else if (state.data.branches[0]) select.value = state.data.branches[0].name;
}

function updateCartChrome() {
  const { totalItems, subtotal } = cart.getTotals();
  const items = cart.getItems();

  const badge = document.getElementById("header-cart-badge");
  if (badge) badge.textContent = String(totalItems);

  const bnavBadge = document.getElementById("bottom-nav-cart-badge");
  if (bnavBadge) {
    bnavBadge.textContent = String(totalItems);
    bnavBadge.hidden = totalItems <= 0;
  }

  // Mobile floating cart bar
  const floatWrap = document.getElementById("floating-cart");
  const floatBadge = document.getElementById("floating-cart-badge");
  const floatCount = document.getElementById("floating-cart-count");
  const floatTotal = document.getElementById("floating-cart-total");

  if (floatWrap) {
    if (totalItems > 0) {
      floatWrap.hidden = false;
      if (floatBadge) floatBadge.textContent = String(totalItems);
      if (floatCount) floatCount.textContent = i18n.t("floatingCart.items", { count: totalItems });
      if (floatTotal) floatTotal.textContent = i18n.formatIDR(subtotal);
    } else {
      floatWrap.hidden = true;
    }
  }

  // Desktop Right Cart Inspector
  const inspBadge = document.getElementById("inspector-count-badge");
  const inspItems = document.getElementById("inspector-items");
  const inspSubLabel = document.getElementById("inspector-subtotal-label");
  const inspSub = document.getElementById("inspector-subtotal");
  const inspTotal = document.getElementById("inspector-total");
  const inspCheckoutBtn = document.getElementById("inspector-checkout-btn");

  if (inspBadge) inspBadge.textContent = i18n.t("cart.itemBadge", { count: totalItems });
  if (inspSubLabel) inspSubLabel.textContent = i18n.t("cart.subtotalItems", { count: totalItems });
  if (inspSub) inspSub.textContent = i18n.formatIDR(subtotal);
  if (inspTotal) inspTotal.textContent = i18n.formatIDR(subtotal);
  if (inspCheckoutBtn) inspCheckoutBtn.disabled = items.length === 0;

  if (!inspItems) return;
  inspItems.innerHTML = "";

  if (items.length === 0) {
    const empty = el("div", "py-8 text-center space-y-1");
    empty.appendChild(el("div", "text-xs font-bold text-text-primary", i18n.t("cart.emptyTitle")));
    empty.appendChild(el("p", "text-[11px] text-text-secondary leading-relaxed", i18n.t("cart.emptyText")));
    inspItems.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = el("div", "py-3 flex items-start justify-between gap-2.5");
    const left = el("div", "min-w-0 flex-1 space-y-0.5");
    left.appendChild(el("div", "text-xs font-extrabold text-text-primary break-words", i18n.tx(item.itemName)));

    const subParts = [];
    if (item.upgradeCombo) subParts.push(i18n.t("menu.upgradeShort"));
    if (item.variantName && item.variantName !== "Regular") subParts.push(i18n.tx(item.variantName));
    subParts.push(item.menuCode);
    left.appendChild(el("div", "text-[11px] text-text-secondary", subParts.join(" · ")));
    left.appendChild(
      el("div", "text-xs font-extrabold text-text-accent pt-0.5 tabular-nums", i18n.formatIDR(item.qty * item.unitPrice))
    );

    const right = el("div", "shrink-0 pt-1");
    right.appendChild(buildStepperControl(item.key, item.qty));

    row.append(left, right);
    inspItems.appendChild(row);
  });
}

function handleInspectorCheckout() {
  const feedback = document.getElementById("inspector-feedback");
  const branchVal = document.getElementById("inspector-branch")?.value.trim() || "";
  const customerName = document.getElementById("inspector-customer-name")?.value.trim() || "";
  const items = cart.getItems();
  if (items.length === 0 || !state.data) return;

  if (!branchVal) {
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = i18n.t("cart.validationBranch");
    }
    document.getElementById("inspector-branch")?.focus();
    return;
  }

  if (feedback) feedback.hidden = true;
  const { subtotal } = cart.getTotals();
  const branchObj = state.data.branches.find((b) => b.name === branchVal);
  const branchLine = branchObj && branchObj.address ? `${branchVal} (${branchObj.address})` : branchVal;

  const lines = [
    i18n.t("cart.waGreeting"),
    "",
    `${i18n.t("cart.waBranch")}: ${branchLine}`,
  ];
  if (customerName) {
    lines.push(`${i18n.t("cart.waCustomer")}: ${customerName}`);
  }
  lines.push(
    `${i18n.t("cart.waOrderType")}: ${i18n.t(`cart.${state.orderMode}`)}`,
    "",
    `${i18n.t("cart.waItems")}:`
  );

  items.forEach((item, idx) => {
    const extras = [];
    if (item.variantName && item.variantName !== "Regular") extras.push(i18n.tx(item.variantName));
    if (item.upgradeCombo) extras.push(i18n.t("menu.upgradeShort"));
    const extraText = extras.length ? ` (${extras.join(", ")})` : "";
    lines.push(
      `${idx + 1}. ${i18n.tx(item.itemName)}${extraText} [${item.menuCode}] x${item.qty} = ${i18n.formatIDR(
        item.qty * item.unitPrice
      )}`
    );
  });

  lines.push("", `${i18n.t("cart.waTotal")}: ${i18n.formatIDR(subtotal)}`);
  const waNumber = normalizeWaNumber(state.data.business.contact.whatsapp);
  const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function renderBusinessSection() {
  const container = document.getElementById("business-container");
  if (!container || !state.data) return;
  const { business } = state.data;
  container.innerHTML = "";

  const historyCard = el("article", "ax-card-padded min-w-0 lg:col-span-12");
  historyCard.appendChild(el("h3", "mb-2 text-sm sm:text-base font-extrabold text-text-primary", i18n.t("business.historyTitle")));
  historyCard.appendChild(el("p", "text-xs sm:text-sm leading-relaxed text-text-secondary", i18n.tx(business.profile_history)));

  if (business.packages.length > 0) {
    const pkgWrap = el("div", "mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2");
    business.packages.forEach((pkg) => {
      const box = el("div", "min-w-0 overflow-hidden rounded-[var(--radius-element)] border border-border-default bg-bg-muted p-4");
      const head = el("div", "mb-2.5 flex flex-col items-start gap-1.5");
      head.appendChild(el("h4", "text-xs sm:text-sm font-extrabold text-text-primary", i18n.tx(pkg.name)));
      if (pkg.starting_price_note) {
        head.appendChild(el("span", "ax-badge ax-badge-soft", i18n.tx(pkg.starting_price_note)));
      }
      box.appendChild(head);
      const list = el("ul", "list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-text-secondary");
      pkg.features.forEach((feat) => list.appendChild(el("li", "break-words", i18n.tx(feat))));
      box.appendChild(list);
      pkgWrap.appendChild(box);
    });
    historyCard.appendChild(pkgWrap);
  }
  container.appendChild(historyCard);

  const expCard = el("article", "ax-card-padded min-w-0 lg:col-span-6");
  expCard.appendChild(el("h3", "mb-2 text-sm sm:text-base font-extrabold text-text-primary", i18n.t("business.experienceTitle")));
  const expList = el("ul", "list-disc space-y-2 pl-4 text-xs sm:text-sm leading-relaxed text-text-secondary");
  business.dining_experience.forEach((line) => expList.appendChild(el("li", "break-words", i18n.tx(line))));
  expCard.appendChild(expList);

  if (business.sauces.length > 0) {
    expCard.appendChild(
      el("h3", "mt-4 mb-2 text-xs sm:text-sm font-extrabold text-text-primary", i18n.tx(business.sauces_note) || i18n.t("business.saucesTitle"))
    );
    const pills = el("div", "flex flex-wrap gap-1.5");
    business.sauces.forEach((s) =>
      pills.appendChild(
        el("span", "ax-badge ax-badge-muted", i18n.tx(s))
      )
    );
    expCard.appendChild(pills);
  }
  container.appendChild(expCard);

  if (business.additional_notes.length > 0) {
    const notesCard = el("article", "ax-card-padded min-w-0 lg:col-span-6");
    notesCard.appendChild(el("h3", "mb-2 text-sm sm:text-base font-extrabold text-text-primary", i18n.t("business.notesTitle")));
    const notesList = el("ul", "list-disc space-y-2 pl-4 text-xs sm:text-sm leading-relaxed text-text-secondary");
    business.additional_notes.forEach((note) => notesList.appendChild(el("li", "break-words", i18n.tx(note))));
    notesCard.appendChild(notesList);
    container.appendChild(notesCard);
  }

  if (business.summary) {
    const sumCard = el("article", "ax-hero-card min-w-0 p-4 sm:p-5 lg:col-span-12");
    sumCard.appendChild(el("h3", "mb-2 text-sm sm:text-base font-extrabold text-white", i18n.t("business.summaryTitle")));
    sumCard.appendChild(el("p", "text-xs sm:text-sm leading-relaxed text-[#DDE4E2]", i18n.tx(business.summary)));
    container.appendChild(sumCard);
  }
}

function renderBranches() {
  const container = document.getElementById("branches-container");
  if (!container || !state.data) return;
  container.innerHTML = "";

  state.data.branches.forEach((branch) => {
    const card = el("article", "ax-card-padded flex flex-col gap-2.5");
    card.appendChild(
      el("span", "ax-badge ax-badge-soft w-fit", i18n.t("branches.branchLabel", { num: branch.branch_number }))
    );
    card.appendChild(el("h3", "text-sm sm:text-base font-extrabold text-text-primary", branch.name));
    card.appendChild(el("p", "flex-1 text-xs sm:text-sm leading-relaxed text-text-secondary", branch.address));

    const mapLink = el("a", "ax-btn ax-btn-outline mt-1 w-full sm:w-fit text-xs", i18n.t("branches.openMap"));
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
      "ax-card-padded flex flex-col justify-center gap-1 transition-colors hover:border-accent"
    );
    link.href = item.href;
    if (item.href.startsWith("http")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    link.appendChild(el("span", "ax-caption text-text-secondary", item.label));
    link.appendChild(el("span", "text-xs sm:text-sm font-extrabold text-text-primary break-words", item.value));
    container.appendChild(link);
  });
}

function renderAll() {
  i18n.applyStaticTranslations();
  if (!state.data) return;
  renderHeroAndHighlights();
  renderCategoryNavigation();
  renderMenu();
  renderBusinessSection();
  renderBranches();
  renderContact();
  populateInspectorBranches();
  updateCartChrome();
}

async function boot() {
  await i18n.init();
  i18n.mountToggle("#lang-toggle");
  i18n.mountThemeToggle("[data-theme-toggle]");
  i18n.applyStaticTranslations();

  const searchInput = document.getElementById("menu-search");
  const searchMobileInput = document.getElementById("menu-search-mobile");

  const handleSearch = (val, sourceEl) => {
    state.searchQuery = val;
    if (searchInput && sourceEl !== searchInput) searchInput.value = val;
    if (searchMobileInput && sourceEl !== searchMobileInput) searchMobileInput.value = val;
    renderMenu();
  };

  if (searchInput) {
    searchInput.addEventListener("input", (event) => handleSearch(event.target.value, searchInput));
  }
  if (searchMobileInput) {
    searchMobileInput.addEventListener("input", (event) =>
      handleSearch(event.target.value, searchMobileInput)
    );
  }

  // Mobile Bottom Navigation Bar active state (click + scroll spy)
  const bnavItems = Array.from(document.querySelectorAll("#mobile-bottom-nav [data-bnav-target]"));
  const setActiveBnav = (targetId) => {
    bnavItems.forEach((item) => {
      const match = item.getAttribute("data-bnav-target") === targetId;
      item.classList.toggle("is-active", match);
    });
  };

  bnavItems.forEach((item) => {
    const targetId = item.getAttribute("data-bnav-target");
    if (targetId && targetId !== "cart") {
      item.addEventListener("click", () => setActiveBnav(targetId));
    }
  });

  if ("IntersectionObserver" in window) {
    const observedIds = ["menu", "hero-promo", "branches", "about"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveBnav(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0.01 }
    );
    observedIds.forEach((id) => {
      const sec = document.getElementById(id);
      if (sec) observer.observe(sec);
    });
  }

  document.querySelectorAll("#inspector-order-type [data-order-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.orderMode = btn.getAttribute("data-order-mode") || "takeAway";
      document.querySelectorAll("#inspector-order-type [data-order-mode]").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
    });
  });

  document.getElementById("inspector-checkout-btn")?.addEventListener("click", handleInspectorCheckout);

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
      container.appendChild(el("div", "ax-card-padded text-center text-sm text-text-secondary", i18n.t("menu.error")));
    }
    console.error(err);
  }
}

boot();
