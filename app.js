const resources = window.SEL_RESOURCES || [];
const state = {
  query: "", type: "", stage: "", dimension: "", evidence: "", sort: "featured",
  collection: new Set(JSON.parse(localStorage.getItem("sel-collection") || "[]"))
};

const $ = (selector) => document.querySelector(selector);
const unique = (key) => [...new Set(resources.flatMap(item => Array.isArray(item[key]) ? item[key] : [item[key]]))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

function fillSelect(selector, values) {
  const select = $(selector);
  values.forEach(value => select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`));
}

function matches(item) {
  const haystack = [item.title, item.summary, item.type, ...item.stages, ...item.dimensions, ...item.tags].join(" ").toLowerCase();
  return (!state.query || haystack.includes(state.query.toLowerCase()))
    && (!state.type || item.type === state.type)
    && (!state.stage || item.stages.includes(state.stage))
    && (!state.dimension || item.dimensions.includes(state.dimension))
    && (!state.evidence || item.evidence === state.evidence);
}

function filteredResources() {
  const result = resources.filter(matches);
  if (state.sort === "newest") return result.sort((a, b) => b.date.localeCompare(a.date));
  if (state.sort === "title") return result.sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
  return result.sort((a, b) => b.featured - a.featured || b.date.localeCompare(a.date));
}

function cardTemplate(item) {
  const saved = state.collection.has(item.id);
  return `<article class="resource-card">
    <div class="card-top">
      <span class="type-badge">${escapeHtml(item.type)}</span>
      <button class="save-button ${saved ? "saved" : ""}" type="button" data-save="${item.id}" aria-label="${saved ? "從資料夾移除" : "加入資料夾"}" title="${saved ? "已收藏" : "收藏"}">${saved ? "♥" : "♡"}</button>
    </div>
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.summary)}</p>
    <div class="tag-list">${item.tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="card-meta"><span>${escapeHtml(item.id)}</span><span>${escapeHtml(item.evidence)}</span></div>
    <button class="card-open" type="button" data-open="${item.id}">查看資料詳情</button>
  </article>`;
}

function render() {
  const items = filteredResources();
  $("#resourceGrid").innerHTML = items.map(cardTemplate).join("");
  $("#resultCount").textContent = items.length;
  $("#emptyState").hidden = items.length > 0;
  $("#collectionCount").textContent = state.collection.size;
}

function openResource(id) {
  const item = resources.find(resource => resource.id === id);
  if (!item) return;
  $("#dialogContent").innerHTML = `<div class="dialog-heading">
      <p class="eyebrow">${escapeHtml(item.type)} · ${escapeHtml(item.id)}</p>
      <h2 id="dialogTitle">${escapeHtml(item.title)}</h2>
    </div>
    <p class="dialog-summary">${escapeHtml(item.summary)}</p>
    <div class="detail-grid">
      <div><small>適用階段</small><strong>${escapeHtml(item.stages.join("、"))}</strong></div>
      <div><small>SEL 能力</small><strong>${escapeHtml(item.dimensions.join("、"))}</strong></div>
      <div><small>證據／審查</small><strong>${escapeHtml(item.evidence)}</strong></div>
      <div><small>權利狀態</small><strong>${escapeHtml(item.rights)}</strong></div>
    </div>
    <div class="tag-list">${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="source-box"><strong>來源與版本說明</strong><br>${escapeHtml(item.source)}<br><small>最後更新：${escapeHtml(item.date)}</small></div>`;
  $("#resourceDialog").showModal();
}

function toggleSave(id) {
  state.collection.has(id) ? state.collection.delete(id) : state.collection.add(id);
  localStorage.setItem("sel-collection", JSON.stringify([...state.collection]));
  render();
}

function openCollection() {
  const items = resources.filter(item => state.collection.has(item.id));
  $("#collectionList").innerHTML = items.length
    ? items.map(item => `<div class="collection-item"><span class="type-badge">${escapeHtml(item.type)}</span><strong>${escapeHtml(item.title)}</strong><button type="button" data-remove="${item.id}">移除</button></div>`).join("")
    : `<div class="collection-empty"><strong>資料夾目前是空的</strong><p>在資源卡片點選愛心，即可建立研究或教學選集。</p></div>`;
  $("#collectionDialog").showModal();
}

function download(filename, data, type = "application/json") {
  const blob = new Blob([data], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const rows = filteredResources();
  const headers = ["id", "type", "title", "stages", "dimensions", "evidence", "date", "rights"];
  const quote = value => `"${String(value).replaceAll('"', '""')}"`;
  const csv = "\ufeff" + [headers.join(","), ...rows.map(item => headers.map(key => quote(Array.isArray(item[key]) ? item[key].join(";") : item[key])).join(","))].join("\n");
  download("sel-resources.csv", csv, "text/csv");
}

function applyQuery(query) {
  state.query = query.trim();
  $("#catalogSearch").value = state.query;
  render();
  $("#catalog").scrollIntoView({ behavior: "smooth" });
}

fillSelect("#typeFilter", unique("type"));
fillSelect("#stageFilter", unique("stages"));
fillSelect("#dimensionFilter", unique("dimensions"));
fillSelect("#evidenceFilter", unique("evidence"));
$("#resourceMetric").textContent = resources.length;
$("#dimensionMetric").textContent = unique("dimensions").length;

$("#catalogSearch").addEventListener("input", event => { state.query = event.target.value; render(); });
[["#typeFilter", "type"], ["#stageFilter", "stage"], ["#dimensionFilter", "dimension"], ["#evidenceFilter", "evidence"], ["#sortSelect", "sort"]]
  .forEach(([selector, key]) => $(selector).addEventListener("change", event => { state[key] = event.target.value; render(); }));
$("#heroSearch").addEventListener("submit", event => { event.preventDefault(); applyQuery($("#heroSearchInput").value); });
document.querySelectorAll("[data-query]").forEach(button => button.addEventListener("click", () => applyQuery(button.dataset.query)));
document.querySelectorAll("[data-role-query]").forEach(button => button.addEventListener("click", () => applyQuery(button.dataset.roleQuery)));
$("#resourceGrid").addEventListener("click", event => {
  const save = event.target.closest("[data-save]");
  const open = event.target.closest("[data-open]");
  if (save) toggleSave(save.dataset.save);
  if (open) openResource(open.dataset.open);
});
$("#resetFilters").addEventListener("click", () => {
  Object.assign(state, { query: "", type: "", stage: "", dimension: "", evidence: "", sort: "featured" });
  ["#catalogSearch", "#typeFilter", "#stageFilter", "#dimensionFilter", "#evidenceFilter", "#sortSelect"].forEach(selector => $(selector).value = "");
  $("#sortSelect").value = "featured"; render();
});
$("#exportButton").addEventListener("click", exportCsv);
$("#collectionButton").addEventListener("click", openCollection);
$("#collectionList").addEventListener("click", event => { if (event.target.dataset.remove) { toggleSave(event.target.dataset.remove); openCollection(); } });
$("#collectionExport").addEventListener("click", () => download("sel-collection.json", JSON.stringify(resources.filter(item => state.collection.has(item.id)), null, 2)));
$("#collectionClear").addEventListener("click", () => { state.collection.clear(); localStorage.removeItem("sel-collection"); $("#collectionDialog").close(); render(); });
$("#dialogClose").addEventListener("click", () => $("#resourceDialog").close());
$("#collectionClose").addEventListener("click", () => $("#collectionDialog").close());
["#resourceDialog", "#collectionDialog"].forEach(selector => $(selector).addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); }));

render();
