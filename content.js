(
  function () {
  const host = location.hostname;
  const KEY = `cm:${host}`;

  //LUT => Look up table
  let mappings = [];
  let rgbLut = new Map(); // "rgb(r, g, b)" -> "#aabbcc"

  const COLOR_PROPS = [
    "color",
    "backgroundColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "outlineColor"
  ];

  function normHex(hex) {
    if (!hex) return null;
    let h = hex.trim().toLowerCase();
    if (h.startsWith("0x")) h = "#" + h.slice(2);
    if (!h.startsWith("#")) h = "#" + h;
    if (/^#[0-9a-f]{3}$/.test(h)) {
      h = "#" + [...h.slice(1)].map(ch => ch + ch).join("");
    }
    if (!/^#[0-9a-f]{6}$/.test(h)) return null;
    return h;
  }
  function hexToRgbString(hex) {
    const h = normHex(hex);
    if (!h) return null;
    const r = parseInt(h.slice(1,3),16);
    const g = parseInt(h.slice(3,5),16);
    const b = parseInt(h.slice(5,7),16);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function rebuildRgbLut() {
    rgbLut.clear();
    mappings.forEach(({from, to}) => {
      const rgb = hexToRgbString(from);
      if (rgb) rgbLut.set(rgb, to);
    });
  }


  function applyToElement(el) {

    const cs = getComputedStyle(el);
    let changed = false;

    for (const p of COLOR_PROPS) {
      const val = cs[p];
      if (!val || val === "transparent") continue;
      const to = rgbLut.get(val);
      if (to) {
        // inline override
        const styleProp = p.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
        el.style.setProperty(styleProp, to, "important");
        changed = true;
      }
    }

    return changed;
  }

  function walkAndApply(root) {
    if (!root) root = document;
    if (root instanceof Element) applyToElement(root);
    const it = (root instanceof Element || root instanceof Document) ? root.querySelectorAll("*") : [];
    for (const el of it) applyToElement(el);
  }

  async function loadMappingsAndApply() {
    const data = await chrome.storage.local.get([KEY]);
    mappings = Array.isArray(data[KEY]) ? data[KEY] : [];
    rebuildRgbLut();
    walkAndApply(document);
  }
  loadMappingsAndApply();

  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "childList") {
        m.addedNodes.forEach(n => {
          if (n.nodeType === 1) walkAndApply(n);
        });
      } else if (m.type === "attributes") {
        if (m.attributeName === "class" || m.attributeName === "style") {
          applyToElement(m.target);
        }
      }
    }
  });
  
  obs.observe(document.documentElement, {
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style"]
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY]) {
      mappings = Array.isArray(changes[KEY].newValue) ? changes[KEY].newValue : [];
      rebuildRgbLut();
      walkAndApply(document);
    }
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "cm:reload") {
      loadMappingsAndApply();
    }
  });
})();
