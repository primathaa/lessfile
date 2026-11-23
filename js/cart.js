import { CartStore } from "./cart-store.js";
import { bindMenuImage, loadSiteData } from "./data-loader.js";
import { I18n } from "./i18n.js";

const BASE_PATH = "../";
const i18n = new I18n(BASE_PATH);
const cart = new CartStore();

const state = {
  data: null,
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

function setFeedback(message, type) {
  const box = document.getElementById("form-feedback");
  if (!box) return;
  if (!message) {
    box.hidden = true;
    box.textContent = "";
    box.className = "form-feedback";
    return;
  }
  box.hidden = false;
  box.textContent = message;
  box.className = `form-feedback ${type === "success" ? "is-success" : "is-error"}`;
}

function populateBranches() {
  const select = document.getElementById("branch-select");
  if (!select || !state.data) return;
  const previous = select.value;
  select.innerHTML = "";

  const placeholder = el("option", "", i18n.t("cart.branchPlaceholder"));
  placeholder.value = "";
  select.appendChild(placeholder);

  state.data.branches.forEach((branch) => {
    const opt = el("option", "", `${branch.name} — ${branch.address}`);
    opt.value = branch.name;
    select.appendChild(opt);
  });

  if (previous) select.value = previous;
}

function renderCartItems() {
  const container = document.getElementById("cart-items-container");
  const clearBtn = document.getElementById("clear-cart-btn");
  const submitBtn = document.getElementById("whatsapp-submit-btn");
  const copyBtn = document.getElementById("copy-summary-btn");

  const items = cart.getItems();
  const { totalItems, subtotal } = cart.getTotals();

  document.getElementById("summary-count").textContent = String(totalItems);
  document.getElementById("summary-subtotal").textContent = i18n.formatIDR(subtotal);
  document.getElementById("summary-total").textContent = i18n.formatIDR(subtotal);

  container.innerHTML = "";
  if (items.length === 0) {
    if (clearBtn) clearBtn.hidden = true;
    if (submitBtn) submitBtn.disabled = true;
    if (copyBtn) copyBtn.disabled = true;

    const empty = el("div", "empty-state");
    empty.appendChild(el("h2", "", i18n.t("cart.emptyTitle")));
    empty.appendChild(el("p", "", i18n.t("cart.emptyText")));
    const link = el("a", "btn btn-primary", i18n.t("cart.browseMenu"));
    link.href = "../#menu";
    empty.appendChild(link);
    container.appendChild(empty);
    return;
  }

  if (clearBtn) clearBtn.hidden = false;
  if (submitBtn) submitBtn.disabled = false;
  if (copyBtn) copyBtn.disabled = false;

  const list = el("div", "cart-item-list");
  const mode = state.data ? state.data.mode : "static";

  items.forEach((item) => {
    const row = el("article", "cart-item");

    const img = el("img", "cart-item-thumb");
    img.alt = i18n.tx(item.itemName);
    bindMenuImage(img, item.menuCode, BASE_PATH, mode);
    row.appendChild(img);

    const content = el("div");
    const top = el("div", "cart-item-top");
    const info = el("div");
    info.appendChild(el("h3", "cart-item-name", i18n.tx(item.itemName)));

    const metaParts = [`#${item.menuCode}`, i18n.tx(item.categoryName)];
    if (item.variantName && item.variantName !== "Regular") {
      metaParts.push(i18n.tx(item.variantName));
    }
    if (item.upgradeCombo) {
      metaParts.push(i18n.t("menu.upgradeShort"));
    }
    metaParts.push(i18n.formatIDR(item.unitPrice));
    info.appendChild(el("div", "cart-item-meta", metaParts.join(" · ")));

    const removeBtn = el("button", "cart-item-remove", i18n.t("cart.removeItem"));
    removeBtn.type = "button";
    removeBtn.addEventListener("click", () => cart.removeItem(item.key));

    top.append(info, removeBtn);
    content.appendChild(top);

    const controls = el("div", "cart-item-controls");
    const stepper = el("div", "qty-stepper");

    const dec = el("button", "qty-btn", "−");
    dec.type = "button";
    dec.setAttribute("aria-label", "Decrease quantity");
    dec.addEventListener("click", () => cart.updateQty(item.key, -1));

    const val = el("span", "qty-value", String(item.qty));

    const inc = el("button", "qty-btn", "+");
    inc.type = "button";
    inc.setAttribute("aria-label", "Increase quantity");
    inc.addEventListener("click", () => cart.updateQty(item.key, 1));

    stepper.append(dec, val, inc);
    controls.append(stepper, el("span", "cart-item-subtotal", i18n.formatIDR(item.qty * item.unitPrice)));
    content.appendChild(controls);

    const noteInput = el("input", "cart-note-input");
    noteInput.type = "text";
    noteInput.value = item.note || "";
    noteInput.placeholder = i18n.t("cart.itemNotePlaceholder");
    noteInput.addEventListener("input", (event) => cart.setNote(item.key, event.target.value));
    content.appendChild(noteInput);

    row.appendChild(content);
    list.appendChild(row);
  });

  container.appendChild(list);
}

function buildOrderMessage() {
  const branchVal = document.getElementById("branch-select").value.trim();
  const customerName = document.getElementById("customer-name").value.trim();
  const orderTypeKey = document.querySelector('input[name="orderType"]:checked')?.value || "dineIn";
  const paymentKey =
    document.querySelector('input[name="paymentMethod"]:checked')?.value || "paymentCash";
  const generalNotes = document.getElementById("order-notes").value.trim();

  if (!branchVal) {
    setFeedback(i18n.t("cart.validationBranch"), "error");
    document.getElementById("branch-select").focus();
    return null;
  }
  if (!customerName) {
    setFeedback(i18n.t("cart.validationName"), "error");
    document.getElementById("customer-name").focus();
    return null;
  }

  setFeedback("", "");
  const items = cart.getItems();
  const { subtotal } = cart.getTotals();

  const lines = [
    i18n.t("cart.waGreeting"),
    "",
    `${i18n.t("cart.waBranch")}: ${branchVal}`,
    `${i18n.t("cart.waCustomer")}: ${customerName}`,
    `${i18n.t("cart.waOrderType")}: ${i18n.t(`cart.${orderTypeKey}`)}`,
    `${i18n.t("cart.waPayment")}: ${i18n.t(`cart.${paymentKey}`)}`,
    "",
    `${i18n.t("cart.waItems")}:`,
  ];

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
    if (item.note) {
      lines.push(`   ${i18n.t("cart.waItemNote")}: ${item.note}`);
    }
  });

  lines.push("", `${i18n.t("cart.waTotal")}: ${i18n.formatIDR(subtotal)}`);
  if (generalNotes) {
    lines.push(`${i18n.t("cart.waGeneralNote")}: ${generalNotes}`);
  }
  return lines.join("\n");
}

function renderBrand() {
  document.title = i18n.t("meta.cartTitle");
  if (!state.data) return;
  const headerBrand = document.getElementById("brand-name-header");
  const footerBrand = document.getElementById("brand-name-footer");
  if (headerBrand) headerBrand.textContent = state.data.business.name;
  if (footerBrand) footerBrand.textContent = state.data.business.name;
}

function renderAll() {
  i18n.applyStaticTranslations();
  renderBrand();
  populateBranches();
  renderCartItems();
}

async function boot() {
  await i18n.init();
  i18n.mountToggle(document.getElementById("lang-toggle"));
  i18n.applyStaticTranslations();

  document.getElementById("clear-cart-btn").addEventListener("click", () => {
    cart.clear();
    setFeedback("", "");
  });

  document.getElementById("checkout-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const message = buildOrderMessage();
    if (!message || !state.data) return;
    const waNumber = normalizeWaNumber(state.data.business.contact.whatsapp);
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  });

  document.getElementById("copy-summary-btn").addEventListener("click", async () => {
    const message = buildOrderMessage();
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setFeedback(i18n.t("cart.copied"), "success");
    } catch (_) {
      setFeedback(message, "success");
    }
  });

  i18n.onChange(() => renderAll());
  cart.subscribe(() => renderCartItems());

  try {
    state.data = await loadSiteData(BASE_PATH);
    renderAll();
  } catch (err) {
    console.error(err);
    renderCartItems();
  }
}

boot();
