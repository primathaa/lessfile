import { parseBusinessText, parseMenuText } from "./parser.js";

export async function loadSiteData(basePath = "./") {
  try {
    const apiRes = await fetch(`${basePath}api/site-data`, {
      headers: { Accept: "application/json" },
    });
    const contentType = apiRes.headers.get("content-type") || "";
    if (apiRes.ok && contentType.includes("application/json")) {
      const payload = await apiRes.json();
      return { ...payload, mode: "api" };
    }
  } catch (_) {
    // Fall through to static file loading (GitHub Pages mode).
  }

  const [bizRes, menuRes] = await Promise.all([
    fetch(`${basePath}data/Chicken%20LessFille%20Solo.txt`),
    fetch(`${basePath}data/lessfilemenu.txt`),
  ]);

  if (!bizRes.ok || !menuRes.ok) {
    throw new Error("Unable to load business or menu source files.");
  }

  const [bizText, menuText] = await Promise.all([bizRes.text(), menuRes.text()]);
  const business = parseBusinessText(bizText);
  const menu = parseMenuText(menuText);

  return {
    source: "static-files",
    mode: "static",
    business,
    branches: business.branches,
    menu,
  };
}

export function bindMenuImage(imgEl, menuCode, basePath = "./", mode = "static") {
  const code = String(menuCode || "").trim();
  const candidates =
    mode === "api"
      ? [`${basePath}material/${code}`, `${basePath}material/${code}.webp`, `${basePath}material/0${code}.webp`]
      : [`${basePath}material/${code}.webp`, `${basePath}material/0${code}.webp`, `${basePath}material/${code}.png`, `${basePath}material/${code}.jpg`];

  let idx = 0;
  imgEl.onerror = () => {
    idx += 1;
    if (idx < candidates.length) {
      imgEl.src = candidates[idx];
    } else {
      imgEl.onerror = null;
      imgEl.classList.add("is-missing");
    }
  };
  imgEl.src = candidates[0];
}
