function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePriceIdr(token) {
  const cleaned = String(token).trim().toUpperCase().replace(/[.,]/g, "");
  const kMatch = cleaned.match(/(\d+)\s*K/);
  if (kMatch) return parseInt(kMatch[1], 10) * 1000;
  const numMatch = cleaned.match(/(\d+)/);
  return numMatch ? parseInt(numMatch[1], 10) : 0;
}

export function parseBusinessText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\u200B/g, "").trim())
    .filter(Boolean);

  const business = {
    name: lines[0] ? lines[0].split(/\s*[–—-]\s*/)[0].trim() : "",
    title: lines[0] || "",
    profile_history: "",
    packages: [],
    sauces_note: "",
    sauces: [],
    dining_experience: [],
    branches: [],
    contact: {},
    additional_notes: [],
    summary: "",
  };

  let section = "";
  let currentPackage = null;
  let currentBranch = null;

  for (const line of lines.slice(1)) {
    if (line.startsWith("Profil Singkat")) {
      section = "profile";
      continue;
    }
    if (line.startsWith("Varian & Harga Menu")) {
      section = "packages";
      currentPackage = null;
      continue;
    }
    if (line.startsWith("Varian Saus")) {
      section = "sauces";
      business.sauces_note = line.replace(/:$/, "");
      continue;
    }
    if (line.startsWith("Pengalaman Makan")) {
      section = "experience";
      continue;
    }
    if (line.startsWith("Daftar Cabang Resmi")) {
      section = "branches";
      currentBranch = null;
      continue;
    }
    if (line.startsWith("Kontak & Media Sosial")) {
      section = "contact";
      continue;
    }
    if (line.startsWith("Catatan Tambahan")) {
      section = "notes";
      continue;
    }
    if (line === "Rangkuman") {
      section = "summary";
      continue;
    }

    if (section === "profile") {
      business.profile_history = business.profile_history
        ? `${business.profile_history} ${line}`
        : line;
    } else if (section === "packages") {
      if (!line.startsWith("-")) {
        currentPackage = {
          slug: slugify(line),
          name: line,
          starting_price_note: "",
          features: [],
        };
        business.packages.push(currentPackage);
      } else if (currentPackage) {
        const item = line.replace(/^-+\s*/, "").trim();
        if (item.toLowerCase().startsWith("harga:")) {
          currentPackage.starting_price_note = item.slice(item.indexOf(":") + 1).trim();
        } else {
          currentPackage.features.push(item);
        }
      }
    } else if (section === "sauces") {
      if (line.startsWith("-")) {
        business.sauces.push(line.replace(/^-+\s*/, "").trim());
      }
    } else if (section === "experience") {
      if (line.startsWith("-")) {
        business.dining_experience.push(line.replace(/^-+\s*/, "").trim());
      }
    } else if (section === "branches") {
      const match = line.match(/^(\d+)\.\s*(.+)$/);
      if (match) {
        const fullName = match[2].trim();
        const parts = fullName.split(/\s*[–—-]\s*/);
        currentBranch = {
          branch_number: parseInt(match[1], 10),
          name: fullName,
          area: parts[1] ? parts[1].trim() : fullName,
          address: "",
        };
        business.branches.push(currentBranch);
      } else if (line.startsWith("-") && currentBranch) {
        currentBranch.address = line.replace(/^-+\s*/, "").trim();
      }
    } else if (section === "contact") {
      if (line.startsWith("-") && line.includes(":")) {
        const raw = line.replace(/^-+\s*/, "");
        const idx = raw.indexOf(":");
        const key = raw.slice(0, idx).trim().toLowerCase();
        const val = raw.slice(idx + 1).trim();
        if (key.includes("whatsapp")) business.contact.whatsapp = val;
        else if (key.includes("email")) business.contact.email = val;
        else if (key.includes("instagram")) business.contact.instagram = val;
        else if (key.includes("tiktok")) business.contact.tiktok = val;
        else if (key.includes("link")) business.contact.linktree = val;
      }
    } else if (section === "notes") {
      if (line.startsWith("-")) {
        business.additional_notes.push(line.replace(/^-+\s*/, "").trim());
      }
    } else if (section === "summary") {
      business.summary = business.summary ? `${business.summary} ${line}` : line;
    }
  }

  return business;
}

export function parseMenuText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\u200B/g, "").trim())
    .filter(Boolean);

  const categories = [];
  let currentCat = null;
  let pendingGroup = null;

  for (const line of lines) {
    if (line.toLowerCase() === "menu :") continue;

    const isHeading =
      !line.includes("—") &&
      !line.startsWith("-") &&
      !line.startsWith("Upgrade ke Paket") &&
      !line.startsWith("Sudah termasuk") &&
      /^[A-Z0-9\s\-]+(\([^)]+\))?$/.test(line);

    if (isHeading) {
      let name = line;
      let badge = "";
      const badgeMatch = line.match(/\(([^)]+)\)\s*$/);
      if (badgeMatch) {
        badge = badgeMatch[1].trim();
        name = line.slice(0, badgeMatch.index).trim();
      }
      currentCat = {
        slug: slugify(name),
        name,
        badge,
        description: "",
        upgrade: null,
        items: [],
      };
      categories.push(currentCat);
      pendingGroup = null;
      continue;
    }

    if (!currentCat) continue;

    if (line.startsWith("Upgrade ke Paket")) {
      const upMatch = line.match(/\(\+(\d+K)\)/i);
      currentCat.upgrade = {
        price_idr: upMatch ? parsePriceIdr(upMatch[1]) : 0,
        description: line,
      };
      continue;
    }

    if (line.startsWith("Sudah termasuk")) {
      currentCat.description = line;
      continue;
    }

    if (line.startsWith("-") && pendingGroup) {
      const subMatch = line.match(/^-\s*(.+?)\s*\((\d+)\)\s*$/);
      if (subMatch) {
        const subName = subMatch[1].trim();
        const code = subMatch[2].trim();
        currentCat.items.push({
          slug: slugify(subName),
          name: subName,
          flavor_note: "",
          availability_note: "",
          group_label: pendingGroup.label,
          variants: [
            {
              menu_code: code,
              variant_name: "Regular",
              price_idr: pendingGroup.price_idr,
              is_available: true,
              image: { menu_code: code, url: `material/${code}.webp` },
            },
          ],
        });
      }
      continue;
    }

    if (line.includes("—")) {
      const [left, right] = line.split("—").map((part) => part.trim());
      pendingGroup = null;

      let itemName = left;
      let flavorNote = "";
      const flavorMatch = left.match(/\(([^)]+)\)\s*$/);
      if (flavorMatch) {
        flavorNote = flavorMatch[1].trim();
        itemName = left.slice(0, flavorMatch.index).trim();
      }

      if (!/\(\d+\)/.test(right)) {
        pendingGroup = {
          label: itemName,
          price_idr: parsePriceIdr(right),
        };
        continue;
      }

      let availabilityNote = "";
      const variants = [];
      for (const segment of right.split("|").map((s) => s.trim())) {
        const codeMatch = segment.match(/\((\d+)\)\s*$/);
        if (!codeMatch) continue;
        const code = codeMatch[1].trim();
        let beforeCode = segment.slice(0, codeMatch.index).trim();

        const noteMatch = beforeCode.match(/\(([^)]+)\)/);
        if (noteMatch) {
          availabilityNote = noteMatch[1].trim();
          beforeCode = (
            beforeCode.slice(0, noteMatch.index) +
            beforeCode.slice(noteMatch.index + noteMatch[0].length)
          ).trim();
        }

        const priceMatch = beforeCode.match(/(\d+\s*K)/i);
        const priceIdr = priceMatch ? parsePriceIdr(priceMatch[1]) : 0;
        const variantName =
          priceMatch && beforeCode.slice(0, priceMatch.index).trim()
            ? beforeCode.slice(0, priceMatch.index).trim()
            : "Regular";

        variants.push({
          menu_code: code,
          variant_name: variantName,
          price_idr: priceIdr,
          is_available: true,
          image: { menu_code: code, url: `material/${code}.webp` },
        });
      }

      currentCat.items.push({
        slug: slugify(itemName),
        name: itemName,
        flavor_note: flavorNote,
        availability_note: availabilityNote,
        group_label: "",
        variants,
      });
    }
  }

  return categories;
}
