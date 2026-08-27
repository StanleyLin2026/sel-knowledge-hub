const STORAGE_KEY = "sel-admin-local-resources-v1";
const GOOGLE_CLIENT_ID = "360200964218-g3in318dni50ttuio1qt5vdtqpnr0c4m.apps.googleusercontent.com";
const AUTH_SESSION_KEY = "sel-admin-google-profile-v1";
const clone = value => JSON.parse(JSON.stringify(value));
const initialResources = (window.SEL_RESOURCES || []).map((item, index) => ({ ...item, status: index % 7 === 0 ? "review" : "published" }));
let resources = loadResources();
const state = { query: "", type: "", status: "" };
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const splitList = value => value.split(/[,，]/).map(item => item.trim()).filter(Boolean);
const statusLabels = { published: "已發布", review: "待審查", draft: "草稿" };

function decodeGoogleCredential(credential) {
  let payload = credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  payload += "=".repeat((4 - payload.length % 4) % 4);
  const decoded = decodeURIComponent(atob(payload).split("").map(char => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
  return JSON.parse(decoded);
}
function showAdmin(profile) {
  $("#authGate").hidden = true;
  $("#adminShell").hidden = false;
  $("#accountName").textContent = profile.name || "Google 使用者";
  $("#accountEmail").textContent = profile.email || "";
  $("#popoverEmail").textContent = profile.email || "";
  $("#accountAvatar").src = profile.picture || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' rx='32' fill='%23dff1e8'/%3E%3Ctext x='32' y='41' text-anchor='middle' font-size='26' fill='%23176b55'%3EG%3C/text%3E%3C/svg%3E";
  render();
}
function handleGoogleCredential(response) {
  try {
    const profile = decodeGoogleCredential(response.credential);
    if (!profile.email || profile.email_verified === false) throw new Error("Google 帳號的電子郵件尚未驗證。");
    const sessionProfile = { name: profile.name, email: profile.email, picture: profile.picture, exp: profile.exp };
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionProfile));
    showAdmin(sessionProfile);
  } catch (error) {
    $("#authMessage").textContent = error.message || "登入失敗，請稍後再試。";
    $("#authMessage").classList.add("is-error");
  }
}
function initializeGoogleSignIn() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY) || "null"); } catch { sessionStorage.removeItem(AUTH_SESSION_KEY); }
  if (saved?.email && (!saved.exp || saved.exp * 1000 > Date.now())) { showAdmin(saved); return; }
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  if (!window.google?.accounts?.id) {
    $("#authMessage").textContent = "Google 登入服務載入失敗，請重新整理頁面。";
    $("#authMessage").classList.add("is-error");
    return;
  }
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential, auto_select: false });
  google.accounts.id.renderButton($("#googleSignInButton"), { theme: "outline", size: "large", shape: "rectangular", text: "signin_with", locale: "zh_TW", width: 340 });
  $("#authMessage").textContent = "登入後，本頁只保存必要的帳號顯示資訊於目前瀏覽器工作階段。";
}

function loadResources() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || clone(initialResources); }
  catch { return clone(initialResources); }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(resources)); }
function uniqueTypes() { return [...new Set(resources.map(item => item.type))].sort((a,b) => a.localeCompare(b,"zh-Hant")); }
function filteredResources() {
  const q = state.query.toLowerCase();
  return resources.filter(item => {
    const haystack = [item.id,item.title,item.summary,...(item.tags || [])].join(" ").toLowerCase();
    return (!q || haystack.includes(q)) && (!state.type || item.type === state.type) && (!state.status || item.status === state.status);
  }).sort((a,b) => (b.date || "").localeCompare(a.date || ""));
}

function populateTypes() {
  const current = $("#adminType").value;
  $("#adminType").innerHTML = '<option value="">全部類型</option>' + uniqueTypes().map(type => `<option>${escapeHtml(type)}</option>`).join("");
  $("#adminType").value = current;
}
function updateStats() {
  $("#totalStat").textContent = resources.length;
  $("#reviewStat").textContent = resources.filter(item => item.status === "review").length;
  $("#publishedStat").textContent = resources.filter(item => item.status === "published").length;
  $("#typeStat").textContent = uniqueTypes().length;
}
function render() {
  populateTypes(); updateStats();
  const items = filteredResources();
  $("#resultCount").textContent = items.length;
  $("#adminEmpty").hidden = items.length > 0;
  $("#resourceRows").innerHTML = items.map(item => `<tr>
    <td class="resource-cell"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.id)}</small></td>
    <td><span class="type-chip">${escapeHtml(item.type)}</span></td>
    <td class="stage-cell">${escapeHtml((item.stages || []).join("、") || "—")}</td>
    <td><span class="status status-${escapeHtml(item.status)}">${statusLabels[item.status] || "草稿"}</span></td>
    <td>${escapeHtml(item.date || "—")}</td>
    <td><div class="row-actions"><button type="button" data-edit="${escapeHtml(item.id)}" aria-label="編輯 ${escapeHtml(item.title)}">編輯</button><button class="delete-action" type="button" data-delete="${escapeHtml(item.id)}" aria-label="刪除 ${escapeHtml(item.title)}">刪除</button></div></td>
  </tr>`).join("");
}

function openEditor(item) {
  $("#resourceForm").reset(); $("#formError").textContent = "";
  $("#editorTitle").textContent = item ? "編輯資源" : "新增資源";
  $("#originalId").value = item?.id || "";
  $("#fieldId").value = item?.id || "";
  $("#fieldType").value = item?.type || "";
  $("#fieldTitle").value = item?.title || "";
  $("#fieldSummary").value = item?.summary || "";
  $("#fieldStages").value = (item?.stages || []).join("、");
  $("#fieldDimensions").value = (item?.dimensions || []).join("、");
  $("#fieldEvidence").value = item?.evidence || "";
  $("#fieldDate").value = item?.date || new Date().toISOString().slice(0,10);
  $("#fieldTags").value = (item?.tags || []).join("、");
  $("#fieldStatus").value = item?.status || "draft";
  $("#resourceEditor").showModal();
}
function saveFromForm(event) {
  event.preventDefault();
  const originalId = $("#originalId").value;
  const id = $("#fieldId").value.trim().toUpperCase();
  if (resources.some(item => item.id === id && item.id !== originalId)) { $("#formError").textContent = "此資源編號已存在，請使用其他編號。"; return; }
  const previous = resources.find(item => item.id === originalId) || {};
  const next = { ...previous, id, type: $("#fieldType").value, title: $("#fieldTitle").value.trim(), summary: $("#fieldSummary").value.trim(), stages: splitList($("#fieldStages").value), dimensions: splitList($("#fieldDimensions").value), evidence: $("#fieldEvidence").value.trim() || "尚未審查", date: $("#fieldDate").value, tags: splitList($("#fieldTags").value), status: $("#fieldStatus").value, source: previous.source || "由本機視覺化後台建立，尚未同步正式資料庫。", rights: previous.rights || "待確認", featured: previous.featured || 1 };
  resources = originalId ? resources.map(item => item.id === originalId ? next : item) : [next, ...resources];
  persist(); render(); $("#resourceEditor").close();
}
function deleteResource(id) {
  const item = resources.find(resource => resource.id === id);
  if (!item || !window.confirm(`確定要從本機展示資料刪除「${item.title}」嗎？`)) return;
  resources = resources.filter(resource => resource.id !== id); persist(); render();
}
function exportJson() {
  const blob = new Blob([JSON.stringify(resources,null,2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `sel-admin-export-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
}

$("#adminSearch").addEventListener("input", event => { state.query = event.target.value; render(); });
$("#adminType").addEventListener("change", event => { state.type = event.target.value; render(); });
$("#adminStatus").addEventListener("change", event => { state.status = event.target.value; render(); });
$("#addResource").addEventListener("click", () => openEditor());
$("#resourceForm").addEventListener("submit", saveFromForm);
$("#resourceRows").addEventListener("click", event => { const edit = event.target.closest("[data-edit]"); const remove = event.target.closest("[data-delete]"); if (edit) openEditor(resources.find(item => item.id === edit.dataset.edit)); if (remove) deleteResource(remove.dataset.delete); });
$("#exportData").addEventListener("click", exportJson);
$("#resetDemo").addEventListener("click", () => { if (window.confirm("確定要清除本機編輯並還原示範資料嗎？")) { resources = clone(initialResources); localStorage.removeItem(STORAGE_KEY); render(); } });
$("#accountButton").addEventListener("click", () => { const popover = $("#accountPopover"); popover.hidden = !popover.hidden; $("#accountButton").setAttribute("aria-expanded", String(!popover.hidden)); });
$("#signOutButton").addEventListener("click", () => { sessionStorage.removeItem(AUTH_SESSION_KEY); window.google?.accounts?.id?.disableAutoSelect(); location.reload(); });
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => { document.querySelectorAll("[data-view]").forEach(item => item.classList.remove("is-active")); button.classList.add("is-active"); const labels = { dashboard:"資料總覽", resources:"資源管理", review:"審查佇列", taxonomy:"分類與標籤" }; $("#viewTitle").textContent = labels[button.dataset.view]; if (button.dataset.view === "review") { state.status = "review"; $("#adminStatus").value = "review"; } else { state.status = ""; $("#adminStatus").value = ""; } render(); $(".workspace-card").scrollIntoView({behavior:"smooth"}); }));

window.addEventListener("load", initializeGoogleSignIn);
