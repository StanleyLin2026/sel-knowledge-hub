import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { browserLocalPersistence, getAuth, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup, signInWithRedirect, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCZnsJu3bC0slZ0_KLAeWx3j413dyHNU9U",
  authDomain: "seldatabase20260827.firebaseapp.com",
  projectId: "seldatabase20260827",
  storageBucket: "seldatabase20260827.firebasestorage.app",
  messagingSenderId: "360200964218",
  appId: "1:360200964218:web:bceb69698bb8de0a9353c3"
};
const BOOTSTRAP_ADMIN_EMAIL = "jerlih2@gmail.com";
const roleLabels = { admin: "管理者", editor: "編輯者", viewer: "檢視者" };
const statusLabels = { published: "已發布", review: "待審查", draft: "草稿" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

let resources = [];
let currentUser = null;
let currentProfile = null;
const state = { query: "", type: "", status: "" };
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const splitList = value => value.split(/[,，]/).map(item => item.trim()).filter(Boolean);
const canEdit = () => ["admin", "editor"].includes(currentProfile?.role);
const canPublish = () => currentProfile?.role === "admin";
const canManageUsers = () => currentProfile?.role === "admin";

function setAuthMessage(message, isError = false) {
  $("#authMessage").textContent = message;
  $("#authMessage").classList.toggle("is-error", isError);
}
function friendlyAuthError(error) {
  const messages = {
    "auth/popup-closed-by-user": "登入視窗已關閉，請再試一次。",
    "auth/cancelled-popup-request": "登入要求已取消，請再試一次。",
    "auth/unauthorized-domain": "此網站尚未加入 Firebase 授權網域。",
    "auth/operation-not-allowed": "Firebase 尚未啟用 Google 登入方式。"
  };
  return messages[error?.code] || "無法登入 Firebase，請稍後再試。";
}
async function beginGoogleSignIn() {
  const button = $("#googleSignInButton");
  button.disabled = true;
  setAuthMessage("正在開啟 Google 帳號登入…");
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (error.code === "auth/popup-blocked") return signInWithRedirect(auth, provider);
    setAuthMessage(friendlyAuthError(error), true);
    button.disabled = false;
  }
}
async function ensureUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  const baseProfile = {
    displayName: user.displayName || "Google 使用者",
    email: user.email || "",
    photoURL: user.photoURL || "",
    lastLoginAt: serverTimestamp()
  };
  if (!snapshot.exists()) {
    const role = user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL ? "admin" : "viewer";
    await setDoc(userRef, { ...baseProfile, role, active: true, createdAt: serverTimestamp() });
    return { ...baseProfile, role, active: true };
  }
  const profile = snapshot.data();
  if (profile.active === false) throw new Error("此帳號已停用，請聯絡管理者。 ");
  await updateDoc(userRef, baseProfile);
  return { ...profile, ...baseProfile };
}
function showSignedOut() {
  currentUser = null; currentProfile = null; resources = [];
  $("#adminShell").hidden = true;
  $("#authGate").hidden = false;
  $("#googleSignInButton").disabled = false;
  setAuthMessage("請使用 Google 帳號登入 Firebase。", false);
}
async function showAdmin(user, profile) {
  currentUser = user; currentProfile = profile;
  $("#authGate").hidden = true;
  $("#adminShell").hidden = false;
  $("#accountName").textContent = user.displayName || "Google 使用者";
  $("#accountEmail").textContent = user.email || "";
  $("#popoverEmail").textContent = user.email || "";
  $("#accountAvatar").src = user.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' rx='32' fill='%23dff1e8'/%3E%3Ctext x='32' y='41' text-anchor='middle' font-size='26' fill='%23176b55'%3EG%3C/text%3E%3C/svg%3E";
  $("#roleBadge").textContent = roleLabels[profile.role] || "檢視者";
  $("#popoverRole").textContent = `權限：${roleLabels[profile.role] || "檢視者"}`;
  $(".admin-only").hidden = !canManageUsers();
  $("#addResource").hidden = !canEdit();
  $("#permissionSummary").textContent = profile.role === "admin" ? "您可管理全部資源、發布內容、刪除資料及設定使用者角色。" : profile.role === "editor" ? "您可新增及編輯草稿／待審內容，發布與刪除須由管理者執行。" : "您目前擁有後台檢視權限，不能修改資料。";
  await loadResources();
}

function uniqueTypes() { return [...new Set(resources.map(item => item.type).filter(Boolean))].sort((a,b) => a.localeCompare(b,"zh-Hant")); }
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
  $("#resourceRows").innerHTML = items.map(item => {
    const editable = canEdit() && (canPublish() || item.status !== "published");
    return `<tr>
      <td class="resource-cell"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.id)}</small></td>
      <td><span class="type-chip">${escapeHtml(item.type)}</span></td>
      <td class="stage-cell">${escapeHtml((item.stages || []).join("、") || "—")}</td>
      <td><span class="status status-${escapeHtml(item.status)}">${statusLabels[item.status] || "草稿"}</span></td>
      <td>${escapeHtml(item.date || "—")}</td>
      <td><div class="row-actions"><button type="button" data-edit="${escapeHtml(item.id)}" ${editable ? "" : "disabled"}>編輯</button><button class="delete-action" type="button" data-delete="${escapeHtml(item.id)}" ${canPublish() ? "" : "disabled"}>刪除</button></div></td>
    </tr>`;
  }).join("");
}
async function loadResources() {
  $("#permissionSummary").insertAdjacentHTML("beforeend", ' <span class="save-state">正在載入資料…</span>');
  const snapshot = await getDocs(collection(db, "resources"));
  resources = snapshot.docs.map(item => ({ ...item.data(), id: item.data().id || item.id }));
  render();
  $(".save-state")?.remove();
}

function openEditor(item) {
  if (!canEdit() || (item?.status === "published" && !canPublish())) return;
  $("#resourceForm").reset(); $("#formError").textContent = "";
  $("#editorTitle").textContent = item ? "編輯資源" : "新增資源";
  $("#originalId").value = item?.id || "";
  $("#fieldId").value = item?.id || "";
  $("#fieldId").disabled = Boolean(item);
  $("#fieldType").value = item?.type || "";
  $("#fieldTitle").value = item?.title || "";
  $("#fieldSummary").value = item?.summary || "";
  $("#fieldStages").value = (item?.stages || []).join("、");
  $("#fieldDimensions").value = (item?.dimensions || []).join("、");
  $("#fieldEvidence").value = item?.evidence || "";
  $("#fieldDate").value = item?.date || new Date().toISOString().slice(0,10);
  $("#fieldTags").value = (item?.tags || []).join("、");
  $("#fieldStatus").value = item?.status || "draft";
  [...$("#fieldStatus").options].forEach(option => { option.disabled = option.value === "published" && !canPublish(); });
  $("#resourceEditor").showModal();
}
async function saveFromForm(event) {
  event.preventDefault();
  const originalId = $("#originalId").value;
  const id = $("#fieldId").value.trim().toUpperCase();
  const status = $("#fieldStatus").value;
  if (!canEdit()) return;
  if (!canPublish() && status === "published") { $("#formError").textContent = "只有管理者可以發布內容。"; return; }
  if (resources.some(item => item.id === id && item.id !== originalId)) { $("#formError").textContent = "此資源編號已存在，請使用其他編號。"; return; }
  const previous = resources.find(item => item.id === originalId) || {};
  const payload = {
    ...previous, id, type: $("#fieldType").value, title: $("#fieldTitle").value.trim(), summary: $("#fieldSummary").value.trim(),
    stages: splitList($("#fieldStages").value), dimensions: splitList($("#fieldDimensions").value), evidence: $("#fieldEvidence").value.trim() || "尚未審查",
    date: $("#fieldDate").value, tags: splitList($("#fieldTags").value), status,
    source: previous.source || "由 SEL Firebase 管理後台建立。", rights: previous.rights || "待確認", featured: previous.featured || 1,
    updatedAt: serverTimestamp(), updatedBy: currentUser.uid
  };
  if (!originalId) { payload.createdAt = serverTimestamp(); payload.createdBy = currentUser.uid; }
  const saveButton = $("#saveResource"); saveButton.disabled = true; saveButton.textContent = "儲存中…";
  try {
    await setDoc(doc(db, "resources", id), payload);
    await loadResources(); $("#resourceEditor").close();
  } catch (error) { $("#formError").textContent = error.code === "permission-denied" ? "您的角色沒有執行此操作的權限。" : "儲存失敗，請稍後再試。"; }
  finally { saveButton.disabled = false; saveButton.textContent = "儲存到 Firebase"; }
}
async function deleteResource(id) {
  if (!canPublish()) return;
  const item = resources.find(resource => resource.id === id);
  if (!item || !window.confirm(`確定要從 Firestore 刪除「${item.title}」嗎？此操作無法復原。`)) return;
  await deleteDoc(doc(db, "resources", id));
  await loadResources();
}
function exportJson() {
  const clean = resources.map(({ createdAt, updatedAt, ...item }) => item);
  const blob = new Blob([JSON.stringify(clean,null,2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `sel-firestore-export-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
}

async function loadUsers() {
  if (!canManageUsers()) return;
  const snapshot = await getDocs(collection(db, "users"));
  const users = snapshot.docs.map(item => ({ uid: item.id, ...item.data() })).sort((a,b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || "","zh-Hant"));
  $("#userCount").textContent = users.length;
  $("#userRows").innerHTML = users.map(user => {
    const date = user.lastLoginAt?.toDate ? user.lastLoginAt.toDate().toLocaleDateString("zh-TW") : "—";
    const protectedAccount = user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL || user.uid === currentUser.uid;
    return `<tr><td><div class="user-cell"><img src="${escapeHtml(user.photoURL || "")}" alt=""><span><strong>${escapeHtml(user.displayName || "未設定名稱")}</strong><small>${user.active === false ? "已停用" : "使用中"}</small></span></div></td><td>${escapeHtml(user.email || "—")}</td><td><select class="role-select" data-user-role="${escapeHtml(user.uid)}" ${protectedAccount ? "disabled" : ""}><option value="admin" ${user.role === "admin" ? "selected" : ""}>管理者</option><option value="editor" ${user.role === "editor" ? "selected" : ""}>編輯者</option><option value="viewer" ${user.role === "viewer" ? "selected" : ""}>檢視者</option></select></td><td>${date}</td></tr>`;
  }).join("");
}
async function changeUserRole(uid, role, select) {
  if (!canManageUsers() || !["admin","editor","viewer"].includes(role)) return;
  select.disabled = true;
  try { await updateDoc(doc(db, "users", uid), { role, roleUpdatedAt: serverTimestamp(), roleUpdatedBy: currentUser.uid }); }
  catch { window.alert("角色更新失敗，請重新載入後再試。"); }
  finally { select.disabled = false; }
}
function switchView(view, button) {
  document.querySelectorAll("[data-view]").forEach(item => item.classList.remove("is-active")); button.classList.add("is-active");
  const userView = view === "users";
  $("#userWorkspace").hidden = !userView; $("#resourceWorkspace").hidden = userView; $("#statsGrid").hidden = userView; $("#dataNotice").hidden = userView;
  $("#exportData").hidden = userView; $("#addResource").hidden = userView || !canEdit();
  $("#viewTitle").textContent = userView ? "使用者權限" : ({ dashboard:"資料總覽", resources:"資源管理", review:"審查佇列", taxonomy:"分類與標籤" }[view] || "資料總覽");
  if (userView) { loadUsers(); return; }
  state.status = view === "review" ? "review" : ""; $("#adminStatus").value = state.status; render();
}

$("#googleSignInButton").addEventListener("click", beginGoogleSignIn);
$("#adminSearch").addEventListener("input", event => { state.query = event.target.value; render(); });
$("#adminType").addEventListener("change", event => { state.type = event.target.value; render(); });
$("#adminStatus").addEventListener("change", event => { state.status = event.target.value; render(); });
$("#addResource").addEventListener("click", () => openEditor());
$("#resourceForm").addEventListener("submit", saveFromForm);
$("#resourceRows").addEventListener("click", event => { const edit = event.target.closest("[data-edit]"); const remove = event.target.closest("[data-delete]"); if (edit && !edit.disabled) openEditor(resources.find(item => item.id === edit.dataset.edit)); if (remove && !remove.disabled) deleteResource(remove.dataset.delete); });
$("#userRows").addEventListener("change", event => { if (event.target.matches("[data-user-role]")) changeUserRole(event.target.dataset.userRole, event.target.value, event.target); });
$("#exportData").addEventListener("click", exportJson);
$("#reloadData").addEventListener("click", loadResources);
$("#accountButton").addEventListener("click", () => { const popover = $("#accountPopover"); popover.hidden = !popover.hidden; $("#accountButton").setAttribute("aria-expanded", String(!popover.hidden)); });
$("#signOutButton").addEventListener("click", () => signOut(auth));
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view, button)));

await setPersistence(auth, browserLocalPersistence);
await getRedirectResult(auth).catch(error => setAuthMessage(friendlyAuthError(error), true));
onAuthStateChanged(auth, async user => {
  if (!user) { showSignedOut(); return; }
  setAuthMessage("正在載入您的角色與資料權限…");
  try { const profile = await ensureUserProfile(user); await showAdmin(user, profile); }
  catch (error) { await signOut(auth); setAuthMessage(error.message || "無法取得使用者權限。", true); }
});
