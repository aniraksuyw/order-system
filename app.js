const state = {
  shopName: "",
  mealTime: "",
  deadline: "",
  note: "",
  menuItems: [],
  orders: [],
};

const storageKey = "groupOrderState-menu-v2";

const sampleMenu = `魚排飯	75
油甘魚飯	110
肉魚飯	105
雞腿飯	105
炸雞腿飯	100
糖醋雞丁飯	95
鯖仔魚飯	95
排骨飯	95
滷肉飯	95
焢肉飯	95
大腸飯	95
合菜飯	95
瓜仔肉飯	90
白切肉飯	90
薑絲肉飯	90
士林香腸飯	85
鯖魚排飯	85
雞肝飯	85
豬肝飯	75`;

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const els = {
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  shopName: document.querySelector("#shopName"),
  mealTime: document.querySelector("#mealTime"),
  deadline: document.querySelector("#deadline"),
  hostNote: document.querySelector("#hostNote"),
  menuFile: document.querySelector("#menuFile"),
  uploadStatus: document.querySelector("#uploadStatus"),
  uploadStatusTitle: document.querySelector("#uploadStatusTitle"),
  uploadStatusText: document.querySelector("#uploadStatusText"),
  menuPreview: document.querySelector("#menuPreview"),
  menuContentTitle: document.querySelector("#menuContentTitle"),
  menuText: document.querySelector("#menuText"),
  parseMenuBtn: document.querySelector("#parseMenuBtn"),
  recognizeMenuBtn: document.querySelector("#recognizeMenuBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  loadSampleBtn: document.querySelector("#loadSampleBtn"),
  menuItemsBody: document.querySelector("#menuItemsBody"),
  itemCount: document.querySelector("#itemCount"),
  newItemName: document.querySelector("#newItemName"),
  newItemCategory: document.querySelector("#newItemCategory"),
  newItemPrice: document.querySelector("#newItemPrice"),
  addItemBtn: document.querySelector("#addItemBtn"),
  publishBtn: document.querySelector("#publishBtn"),
  shareBox: document.querySelector("#shareBox"),
  shareLink: document.querySelector("#shareLink"),
  copyShareBtn: document.querySelector("#copyShareBtn"),
  orderDeadline: document.querySelector("#orderDeadline"),
  orderShopName: document.querySelector("#orderShopName"),
  orderNote: document.querySelector("#orderNote"),
  orderForm: document.querySelector("#orderForm"),
  customerName: document.querySelector("#customerName"),
  customerNote: document.querySelector("#customerNote"),
  orderItems: document.querySelector("#orderItems"),
  orderList: document.querySelector("#orderList"),
  totalAmount: document.querySelector("#totalAmount"),
  vendorText: document.querySelector("#vendorText"),
  copyVendorBtn: document.querySelector("#copyVendorBtn"),
  toast: document.querySelector("#toast"),
};

let uploadedImageFile = null;
let menuTextSource = "manual";

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return;

  try {
    Object.assign(state, JSON.parse(saved));
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function currency(value) {
  return `$${Number(value || 0).toLocaleString("zh-TW")}`;
}

function formatDateTime(value, options = { dateStyle: "short", timeStyle: "short" }) {
  return value ? new Date(value).toLocaleString("zh-TW", options) : "";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function setUploadStatus(title, text, visible = true) {
  els.uploadStatus.classList.toggle("hidden", !visible);
  els.uploadStatusTitle.textContent = title;
  els.uploadStatusText.textContent = text;
}

function showTextMenu() {
  els.menuContentTitle.textContent = "菜單文字";
  els.menuText.classList.remove("hidden");
}

function clearMenuPreview() {
  els.menuPreview.removeAttribute("src");
  els.menuPreview.classList.add("hidden");
}

function showImageMenu() {
  els.menuContentTitle.textContent = "菜單文字";
  els.menuText.classList.remove("hidden");
  els.menuPreview.classList.remove("hidden");
}

function switchView(viewId) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewId));
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
}

function guessCategory(name) {
  if (/茶|咖啡|奶|可樂|汁|飲/.test(name)) return "飲料";
  if (/便當|飯|麵|鍋|粥|排|雞|豬|牛|魚/.test(name)) return "主餐";
  if (/加|蛋|起司|珍珠/.test(name)) return "加購";
  return "其他";
}

function normalizeMenuText(text) {
  return text
    .replace(/[｜|]/g, " ")
    .replace(/[　]/g, " ")
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function textQualityScore(text) {
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  const mojibakeCount = (text.match(/[�ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜ]/g) || []).length;
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const numberCount = (text.match(/\d/g) || []).length;
  return cjkCount * 2 + numberCount - replacementCount * 20 - mojibakeCount * 4;
}

async function readMenuTextFile(file) {
  const buffer = await file.arrayBuffer();
  const encodings = ["utf-8", "big5", "windows-950"];
  const decoded = encodings.map((encoding) => {
    try {
      return {
        encoding,
        text: new TextDecoder(encoding, { fatal: false }).decode(buffer),
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  decoded.sort((a, b) => textQualityScore(b.text) - textQualityScore(a.text));
  return decoded[0]?.text || "";
}

function shouldSkipMenuLine(line) {
  return (
    !line ||
    /(電話|地址|營業|時間|外送|訂購|訂餐|店址|instagram|line|tel|phone|qr|menu)/i.test(line) ||
    /\d{6,}/.test(line)
  );
}

function cleanItemName(name) {
  return name
    .replace(/會員價格|一般價格|non-member|member|\bNT\$?|[$＄]|元\/份|元\/杯|元/gi, "")
    .replace(/["“”'`]/g, "")
    .replace(/[.、:：-]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyMenuItemName(name) {
  const trimmed = cleanItemName(name);
  const cjkCount = (trimmed.match(/[\u3400-\u9fff]/g) || []).length;
  const latinCount = (trimmed.match(/[A-Za-z]/g) || []).length;
  const numberCount = (trimmed.match(/\d/g) || []).length;
  const symbolCount = (trimmed.match(/[^\u3400-\u9fffA-Za-z0-9\s]/g) || []).length;

  if (trimmed.length < 2 || trimmed.length > 16) return false;
  if (cjkCount < 2) return false;
  if (latinCount > 2) return false;
  if (numberCount > 1) return false;
  if (symbolCount > 1) return false;
  if (/(其他|圖|此|還|關上|EE|wt|RO|ene)/i.test(trimmed)) return false;

  return true;
}

function isLikelyMenuItem(item) {
  return item.price >= 10 && item.price <= 999 && isLikelyMenuItemName(item.name);
}

function parseSingleLineItem(line) {
  const normalized = line.replace(/[,$，]/g, " ").replace(/[：:]/g, " ").replace(/\s+/g, " ");
  const match =
    normalized.match(/^(.+?)\s*(?:NT\$?|[$＄])?\s*(\d{1,5})\s*(?:元)?(?:\/[份杯])?$/i) ||
    normalized.match(/^(.+?)(\d{2,5})(?:元)?(?:\/[份杯])?$/i);
  if (!match) return null;

  const name = cleanItemName(match[1]);
  const price = Number(match[2]);
  if (!name || price <= 0 || !isLikelyMenuItemName(name)) return null;
  return { name, price };
}

function createMenuItem(name, price, category) {
  return {
    id: createId(),
    name,
    category: category || guessCategory(name),
    price,
  };
}

function splitBoardTokens(line) {
  return line
    .replace(/[|｜,，、:：]/g, " ")
    .split(/\s+/)
    .map((token) => cleanItemName(token))
    .filter((token) => /[\u3400-\u9fffA-Za-z]/.test(token) && !/^(飯|元|份|杯)+$/.test(token));
}

function isPriceOnlyLine(line) {
  const withoutPrices = line.replace(/\d{2,4}/g, "").replace(/\s+/g, "");
  return (line.match(/\d{2,4}/g) || []).length >= 3 && withoutPrices.length <= 2;
}

function parseBoardMenuText(text) {
  const lines = normalizeMenuText(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const items = [];

  lines.forEach((line, index) => {
    if (!isPriceOnlyLine(line)) return;

    const prices = (line.match(/\d{2,4}/g) || []).map(Number);
    const previousRows = lines
      .slice(Math.max(0, index - 5), index)
      .filter((row) => !shouldSkipMenuLine(row) && !isPriceOnlyLine(row))
      .map((row) => row.replace(/\d{2,4}/g, " ").trim())
      .map((row) => row.split(/\s+/).map((token) => cleanItemName(token)).filter(Boolean));

    const sameWidthRows = previousRows.filter((row) => row.length === prices.length);
    if (sameWidthRows.length >= 2) {
      prices.forEach((price, priceIndex) => {
        const name = cleanItemName(sameWidthRows.map((row) => row[priceIndex]).join(""));
        if (name) items.push(createMenuItem(name, price, guessCategory(name)));
      });
      return;
    }

    const nameTokens = splitBoardTokens(previousRows.flat().join(" "));
    if (nameTokens.length === prices.length) {
      prices.forEach((price, priceIndex) => {
        items.push(createMenuItem(nameTokens[priceIndex], price, guessCategory(nameTokens[priceIndex])));
      });
    }
  });

  return items;
}

function mergeMenuItems(items) {
  const seen = new Set();
  return items.filter(isLikelyMenuItem).filter((item) => {
    const key = `${item.category}|${item.name}|${item.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseMenuText(text) {
  const items = parseBoardMenuText(text);
  let pendingName = "";
  let currentSection = "";

  normalizeMenuText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (/單點|single/i.test(line)) {
        currentSection = "單點";
        return;
      }
      if (/飲品|飲料|drinks?/i.test(line)) {
        currentSection = "飲料";
        return;
      }
      if (shouldSkipMenuLine(line)) return;
      if (isPriceOnlyLine(line)) return;

      const generalMatch = line.match(/一般價格|non-member/i);
      const memberMatch = line.match(/會員價格|(^|\s)member(\s|$)/i);
      const priceMatch = line.match(/(\d{1,5})/);

      if (generalMatch) {
        pendingName = "";
        return;
      }

      if (memberMatch && pendingName && priceMatch) {
        items.push(createMenuItem(pendingName, Number(priceMatch[1]), currentSection || "主餐"));
        return;
      }

      const singleLineItem = parseSingleLineItem(line);
      if (singleLineItem) {
        items.push(createMenuItem(singleLineItem.name, singleLineItem.price, currentSection || guessCategory(singleLineItem.name)));
        pendingName = "";
        return;
      }

      if (!/\d/.test(line) && line.length <= 14 && !/[，。！？,.!?]/.test(line)) {
        pendingName = cleanItemName(line);
      }
    });

  return mergeMenuItems(items);
}

function applyParsedItems(items, sourceLabel) {
  if (!items.length) {
    setUploadStatus("沒有找到可用品項", "辨識結果看起來不像正常菜單。請修正文字框，或換更清楚的圖片後再試。");
    showToast("沒有找到品項與金額");
    return false;
  }

  if (items.length < 2 && sourceLabel !== "手動文字") {
    setUploadStatus("解析結果不足", "只找到很少品項，可能是 OCR 辨識不清楚。請先檢查文字框。");
    showToast("解析結果不足");
    return false;
  }

  state.menuItems = items;
  state.shopName = els.shopName.value.trim();
  state.mealTime = els.mealTime.value;
  state.deadline = els.deadline.value;
  state.note = els.hostNote.value.trim();
  saveState();
  renderAll();
  setUploadStatus("已產生點餐選項", `${sourceLabel}：解析出 ${items.length} 個品項，可在右側確認。`);
  showToast(`已產生 ${items.length} 個品項`);
  return true;
}

function showMenuImage(file) {
  uploadedImageFile = file;
  const imageUrl = URL.createObjectURL(file);
  els.menuPreview.src = imageUrl;
  showImageMenu();
  els.menuPreview.onload = () => URL.revokeObjectURL(imageUrl);
  els.recognizeMenuBtn.disabled = false;
  setUploadStatus("菜單圖片已上傳", "圖片已顯示在下方。請把轉好的菜單文字直接貼到文字框。");
  showToast("菜單圖片已顯示");
}

function isTextProbablyUseful(text) {
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const numberCount = (text.match(/\d/g) || []).length;
  return cjkCount >= 3 && numberCount >= 1;
}

async function recognizeUploadedMenu() {
  if (!uploadedImageFile) {
    showToast("請先上傳菜單圖片");
    return;
  }

  if (!window.Tesseract) {
    setUploadStatus("辨識套件尚未載入", "請確認網路可連線，或先手動貼上菜單文字。");
    showToast("辨識套件尚未載入");
    return;
  }

  els.recognizeMenuBtn.disabled = true;
  setUploadStatus("正在辨識菜單", "第一次辨識會比較久，請稍等。");

  try {
    const result = await window.Tesseract.recognize(uploadedImageFile, "chi_tra+eng", {
      logger: (message) => {
        if (message.status === "recognizing text") {
          setUploadStatus("正在辨識菜單", `辨識進度 ${Math.round(message.progress * 100)}%`);
        }
      },
    });
    const text = normalizeMenuText(result.data.text);
    els.menuText.value = text;
    menuTextSource = "ocr";
    showTextMenu();

    if (isTextProbablyUseful(text)) {
      setUploadStatus("辨識完成", "文字已放到菜單文字框。也可以直接貼上你另外轉好的文字覆蓋它。");
      showToast("菜單辨識完成");
    } else {
      setUploadStatus("辨識結果不清楚", "已放入文字框，但內容可能不完整。請檢查或手動修正後再解析。");
      showToast("辨識結果不清楚");
    }
  } catch {
    setUploadStatus("辨識失敗", "請換較清楚的圖片，或手動貼上菜單文字。");
    showToast("菜單辨識失敗");
  } finally {
    els.recognizeMenuBtn.disabled = false;
  }
}

function renderHostForm() {
  els.shopName.value = state.shopName;
  els.mealTime.value = state.mealTime || "";
  els.deadline.value = state.deadline;
  els.hostNote.value = state.note;
}

function renderMenuItems() {
  if (els.itemCount) {
    els.itemCount.textContent = `${state.menuItems.length} 項`;
  }
  if (!els.menuItemsBody) return;
  els.menuItemsBody.innerHTML = "";

  if (state.menuItems.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4">貼上菜單後按「解析菜單」，或手動新增品項。</td>`;
    els.menuItemsBody.append(row);
    return;
  }

  state.menuItems.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input value="${escapeHtml(item.name)}" data-field="name" data-id="${item.id}" /></td>
      <td><input value="${escapeHtml(item.category)}" data-field="category" data-id="${item.id}" /></td>
      <td><input type="number" min="0" value="${item.price}" data-field="price" data-id="${item.id}" /></td>
      <td><button class="row-remove" type="button" data-remove="${item.id}" aria-label="刪除品項">×</button></td>
    `;
    els.menuItemsBody.append(row);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function renderOrderView() {
  els.orderShopName.textContent = state.shopName || "尚未建立團購單";
  const orderDetails = [
    state.mealTime ? `訂餐：${formatDateTime(state.mealTime)}` : "",
    state.deadline ? `截止：${formatDateTime(state.deadline)}` : "",
    state.note,
  ].filter(Boolean);
  els.orderNote.textContent = orderDetails.length ? orderDetails.join("｜") : "主揪建立後，這裡會出現菜單與點餐欄位。";
  els.orderDeadline.textContent = state.mealTime
    ? `訂餐 ${formatDateTime(state.mealTime)}`
    : state.deadline
      ? `截止 ${formatDateTime(state.deadline)}`
      : "尚未建立";
  els.orderItems.innerHTML = "";

  if (state.menuItems.length === 0) {
    els.orderItems.innerHTML = `<p class="order-list empty">目前沒有可點的品項。</p>`;
    return;
  }

  state.menuItems.forEach((item) => {
    const card = document.createElement("label");
    card.className = "order-item";
    card.innerHTML = `
      <span>
        <span class="item-name">${escapeHtml(item.name)}</span>
        <span class="item-meta">${escapeHtml(item.category)} · ${currency(item.price)}</span>
      </span>
      <input type="number" min="0" value="0" data-order-item="${item.id}" aria-label="${escapeHtml(item.name)}數量" />
    `;
    els.orderItems.append(card);
  });
}

function calculateOrderTotal(order) {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function buildVendorText() {
  if (!state.orders.length) return "目前還沒有人點餐。";

  const totals = new Map();
  state.orders.forEach((order) => {
    order.items.forEach((item) => {
      const current = totals.get(item.name) || { quantity: 0, price: item.price };
      current.quantity += item.quantity;
      totals.set(item.name, current);
    });
  });

  const lines = [
    `${state.shopName || "團購訂單"}`,
    state.mealTime ? `訂餐時間：${formatDateTime(state.mealTime, { dateStyle: "medium", timeStyle: "short" })}` : "",
    state.deadline ? `截止時間：${formatDateTime(state.deadline, { dateStyle: "medium", timeStyle: "short" })}` : "",
    "",
    "品項統計",
    ...Array.from(totals.entries()).map(([name, item]) => `${name} x ${item.quantity}`),
    "",
    "個人明細",
    ...state.orders.map((order) => {
      const itemText = order.items.map((item) => `${item.name} x ${item.quantity}`).join("、");
      const note = order.note ? `｜${order.note}` : "";
      return `${order.name}：${itemText}，${currency(calculateOrderTotal(order))}${note}`;
    }),
    "",
    `總金額：${currency(state.orders.reduce((sum, order) => sum + calculateOrderTotal(order), 0))}`,
  ];

  return lines.filter((line, index) => line !== "" || lines[index - 1] !== "").join("\n");
}

function renderSummary() {
  const total = state.orders.reduce((sum, order) => sum + calculateOrderTotal(order), 0);
  els.totalAmount.textContent = currency(total);
  els.orderList.className = state.orders.length ? "order-list" : "order-list empty";
  els.orderList.innerHTML = "";

  if (!state.orders.length) {
    els.orderList.textContent = "目前還沒有人點餐。";
  } else {
    state.orders.forEach((order) => {
      const block = document.createElement("article");
      block.className = "person-order";
      block.innerHTML = `
        <header>
          <span>${escapeHtml(order.name)}</span>
          <span>${currency(calculateOrderTotal(order))}</span>
        </header>
        <ul>
          ${order.items.map((item) => `<li>${escapeHtml(item.name)} x ${item.quantity}</li>`).join("")}
          ${order.note ? `<li>備註：${escapeHtml(order.note)}</li>` : ""}
        </ul>
      `;
      els.orderList.append(block);
    });
  }

  els.vendorText.value = buildVendorText();
}

function renderAll() {
  renderHostForm();
  renderMenuItems();
  renderOrderView();
  renderSummary();
}

function loadDefaultMenuIfNeeded() {
  if (state.menuItems.length) return;

  state.shopName = state.shopName || "便當菜單";
  state.menuItems = parseMenuText(sampleMenu);
  els.menuText.value = sampleMenu;
  saveState();
}

function publishOrder() {
  state.shopName = els.shopName.value.trim() || "未命名店家";
  state.mealTime = els.mealTime.value;
  state.deadline = els.deadline.value;
  state.note = els.hostNote.value.trim();
  saveState();
  renderAll();

  const url = new URL(window.location.href);
  url.hash = "order";
  els.shareLink.textContent = url.toString();
  els.shareBox.classList.remove("hidden");
  switchView("orderView");
  showToast("團購單已建立");
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast("瀏覽器未允許複製，請手動選取文字");
  }
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

els.loadSampleBtn.addEventListener("click", () => {
  els.shopName.value = "便當菜單";
  els.mealTime.value = "";
  els.deadline.value = "";
  els.hostNote.value = "請填寫取餐與付款方式";
  els.menuText.value = sampleMenu;
  menuTextSource = "sample";
  state.shopName = els.shopName.value;
  state.mealTime = "";
  state.deadline = "";
  state.note = els.hostNote.value;
  state.menuItems = parseMenuText(sampleMenu);
  saveState();
  renderAll();
  showTextMenu();
  showToast("菜單選項已載入");
});

els.menuFile.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  setUploadStatus("讀取菜單", `正在處理 ${file.name}`);

  if (file.type.startsWith("text/") || /\.(txt|csv|md|json)$/i.test(file.name)) {
    uploadedImageFile = null;
    els.recognizeMenuBtn.disabled = true;
    const text = normalizeMenuText(await readMenuTextFile(file));
    els.menuText.value = text;
    menuTextSource = "file";
    showTextMenu();
    setUploadStatus("文字菜單已匯入", "內容已放到下方文字框，可檢查後按「解析菜單」。");
    showToast("文字菜單已匯入");
    return;
  }

  if (file.type.startsWith("image/")) {
    showMenuImage(file);
    return;
  }

  setUploadStatus("檔案格式不支援", "目前請上傳圖片、TXT、CSV、MD 或 JSON 菜單。");
});

els.parseMenuBtn.addEventListener("click", () => {
  const items = parseMenuText(els.menuText.value);
  const sourceLabel = menuTextSource === "ocr" ? "圖片辨識文字" : "手動文字";
  applyParsedItems(items, sourceLabel);
});

els.recognizeMenuBtn.addEventListener("click", recognizeUploadedMenu);

if (els.menuItemsBody) {
  els.menuItemsBody.addEventListener("input", (event) => {
    const { id, field } = event.target.dataset;
    if (!id || !field) return;
    const item = state.menuItems.find((entry) => entry.id === id);
    if (!item) return;
    item[field] = field === "price" ? Number(event.target.value) : event.target.value;
    saveState();
    renderOrderView();
    renderSummary();
  });

  els.menuItemsBody.addEventListener("click", (event) => {
    const id = event.target.dataset.remove;
    if (!id) return;
    state.menuItems = state.menuItems.filter((item) => item.id !== id);
    saveState();
    renderAll();
  });
}

if (els.addItemBtn) {
  els.addItemBtn.addEventListener("click", () => {
    const name = els.newItemName.value.trim();
    if (!name) {
      showToast("請輸入品項名稱");
      return;
    }

    state.menuItems.push({
      id: createId(),
      name,
      category: els.newItemCategory.value.trim() || guessCategory(name),
      price: Number(els.newItemPrice.value || 0),
    });
    els.newItemName.value = "";
    els.newItemCategory.value = "";
    els.newItemPrice.value = "";
    saveState();
    renderAll();
  });
}

els.publishBtn.addEventListener("click", publishOrder);

els.resetBtn.addEventListener("click", () => {
  Object.assign(state, { shopName: "", mealTime: "", deadline: "", note: "", menuItems: [], orders: [] });
  uploadedImageFile = null;
  menuTextSource = "manual";
  els.recognizeMenuBtn.disabled = true;
  els.menuText.value = "";
  clearMenuPreview();
  showTextMenu();
  els.shareBox.classList.add("hidden");
  localStorage.removeItem(storageKey);
  renderAll();
  showToast("已清空");
});

els.copyShareBtn.addEventListener("click", () => copyText(els.shareLink.textContent, "連結已複製"));

els.orderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const selected = Array.from(document.querySelectorAll("[data-order-item]"))
    .map((input) => {
      const quantity = Number(input.value);
      const item = state.menuItems.find((entry) => entry.id === input.dataset.orderItem);
      return item && quantity > 0 ? { ...item, quantity } : null;
    })
    .filter(Boolean);

  if (!state.menuItems.length) {
    showToast("主揪尚未建立菜單");
    return;
  }

  if (!selected.length) {
    showToast("請至少選一個品項");
    return;
  }

  state.orders.push({
    id: createId(),
    name: els.customerName.value.trim(),
    note: els.customerNote.value.trim(),
    items: selected,
    createdAt: new Date().toISOString(),
  });

  els.orderForm.reset();
  document.querySelectorAll("[data-order-item]").forEach((input) => {
    input.value = 0;
  });
  saveState();
  renderSummary();
  switchView("summaryView");
  showToast("點餐已送出");
});

els.copyVendorBtn.addEventListener("click", () => copyText(els.vendorText.value, "店家訂單已複製"));

loadState();
loadDefaultMenuIfNeeded();
renderAll();

if (window.location.hash === "#order") {
  switchView("orderView");
}
