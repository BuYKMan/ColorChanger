
function keyFor(hostname) {
    return `cm:${hostname}`;
  }

  function normHex(hex) {
    if (!hex) return null;
    let h = hex.trim().toLowerCase();
    if (h.startsWith("0x")) h = "#" + h.slice(2);
    if (!h.startsWith("#")) h = "#" + h;
    if (/^#[0-9a-f]{3}$/.test(h)) {
      // #abc -> #aabbcc
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
  
  // ====== UI kurulum ======
  const rowsEl = document.getElementById("rows");
  const addBtn = document.getElementById("add");
  const removeBtn = document.getElementById("remove");
  const saveBtn = document.getElementById("save");
  
  const MAX_ROWS = 10;
  
  let currentHost = null;
  
  init();
  
  async function init() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    try {
      currentHost = new URL(tab.url).hostname;
    } catch {
      currentHost = null;
    }
    await loadRows();
    wireButtons();
  }
  
  function makeRow(fromVal = "", toVal = "") {
    const row = document.createElement("div");
    row.className = "cm-row";
  
    // --- Kaynak (from) ---
    const fromSw = document.createElement("div");
    fromSw.className = "cm-swatch";
    fromSw.title = "Kaynak rengi seç (EyeDropper)";
    fromSw.dataset.role = "from";
    fromSw.style.background = normHex(fromVal) || "#ffffff";
  
    const fromInput = document.createElement("input");
    fromInput.className = "cm-color";
    fromInput.placeholder = "#0f0f0f";
    fromInput.value = fromVal;
  
    // EyeDropper yalnızca kaynak için
    fromSw.addEventListener("click", async () => {
      if (!window.EyeDropper) {
        alert("EyeDropper bu tarayıcıda desteklenmiyor.");
        return;
      }
      try {
        const ed = new EyeDropper();
        const { sRGBHex } = await ed.open();
        const clean = normHex(sRGBHex);
        if (!clean) return;
        fromInput.value = clean;
        fromSw.style.background = clean;
      } catch (_) {/* iptal */}
    });
  
    const toSw = document.createElement("div");
    toSw.className = "cm-swatch";
    toSw.title = "Hedef rengi seç (swatch'a tıkla: renk paleti açılır)";
    toSw.dataset.role = "to";
    toSw.style.background = normHex(toVal) || "#ffffff";
  
    // Manuel HEX girişi devam ediyor
    const toInput = document.createElement("input");
    toInput.className = "cm-color";
    toInput.placeholder = "#bbbbbb";
    toInput.value = toVal;
  
    // Gizli color input (yalnızca palet için)
    const toColorPicker = document.createElement("input");
    toColorPicker.type = "color";
    toColorPicker.style.position = "absolute";
    toColorPicker.style.opacity = "0";
    toColorPicker.style.pointerEvents = "none";
    // İlk değer (geçerli değilse beyaz yap)
    toColorPicker.value = normHex(toVal) || "#ffffff";
  
    // Swatch'a tıklayınca paleti aç
    toSw.addEventListener("click", () => {
      // buton görünmez olduğu için programatik tıklıyoruz
      toColorPicker.click();
    });
  
    // Paletten seçim yapıldığında: metin kutusu + swatch senkron
    toColorPicker.addEventListener("input", () => {
      const hex = normHex(toColorPicker.value) || "#ffffff";
      toInput.value = hex;
      toSw.style.background = hex;
    });
  
    // Manuel metin girişinde: swatch + palet senkron
    fromInput.addEventListener("input", () => {
      const h = normHex(fromInput.value) || "#ffffff";
      fromSw.style.background = h;
    });
    toInput.addEventListener("input", () => {
      const h = normHex(toInput.value) || "#ffffff";
      toSw.style.background = h;
      if (/^#[0-9a-f]{6}$/i.test(h)) {
        toColorPicker.value = h;
      }
    });
  
    row.appendChild(fromSw);
    row.appendChild(fromInput);
    row.appendChild(toSw);
    row.appendChild(toInput);
    row.appendChild(toColorPicker); 
  
    return row;
  }
  
  async function loadRows() {
    rowsEl.innerHTML = "";
    if (!currentHost) {
      rowsEl.textContent = "Bu sekmede domain tespit edilemedi.";
      return;
    }
    const key = keyFor(currentHost);
    const data = await chrome.storage.local.get([key]);
    const pairs = Array.isArray(data[key]) ? data[key] : [];
    if (pairs.length === 0) {
      rowsEl.appendChild(makeRow());
    } else {
      pairs.slice(0, MAX_ROWS).forEach(p => rowsEl.appendChild(makeRow(p.from, p.to)));
    }
  }
  
  function wireButtons() {
    addBtn.addEventListener("click", () => {
      if (rowsEl.children.length >= MAX_ROWS) return;
      rowsEl.appendChild(makeRow());
    });
    removeBtn.addEventListener("click", () => {
      if (rowsEl.children.length > 0) {
        rowsEl.lastElementChild.remove();
      }
    });
    saveBtn.addEventListener("click", saveMappings);
  }
  
  async function saveMappings() {
    if (!currentHost) return;
    const key = keyFor(currentHost);
    const pairs = [];
    for (const row of rowsEl.children) {
      const [fromSw, fromInput, toSw, toInput] = row.children;
      const from = normHex(fromInput.value);
      const to   = normHex(toInput.value);
      if (from && to && from !== to) {
        pairs.push({ from, to });
      }
    }
    // en fazla 10
    const trimmed = pairs.slice(0, MAX_ROWS);
    await chrome.storage.local.set({ [key]: trimmed });
  
    // Aktif taba haber ver (hemen uygulasın)
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "cm:reload" });
    }
  }
  