const firebaseConfig = {
  apiKey: "AIzaSyCZnsJu3bC0slZ0_KLAeWx3j413dyHNU9U",
  authDomain: "seldatabase20260827.firebaseapp.com",
  projectId: "seldatabase20260827",
  storageBucket: "seldatabase20260827.firebasestorage.app",
  messagingSenderId: "360200964218",
  appId: "1:360200964218:web:bceb69698bb8de0a9353c3"
};

const statusElement = document.querySelector("#dataSourceStatus");

function decodeValue(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

async function loadPublishedResources() {
  const endpoint = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents:runQuery?key=${firebaseConfig.apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "resources" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "status" },
            op: "EQUAL",
            value: { stringValue: "published" }
          }
        }
      }
    })
  });
  if (!response.ok) throw new Error(`Firestore request failed: ${response.status}`);
  const rows = await response.json();
  return rows.filter(row => row.document).map(row => decodeFields(row.document.fields || {}));
}

try {
  const cloudResources = await loadPublishedResources();
  if (!cloudResources.length) throw new Error("Firestore returned no published resources");
  window.SEL_RESOURCES = cloudResources;
  window.SEL_DATA_SOURCE = "firestore";
  statusElement.textContent = `已連線 Firestore · ${cloudResources.length} 筆公開資源`;
  statusElement.classList.add("is-online");
} catch (error) {
  window.SEL_DATA_SOURCE = "fallback";
  statusElement.textContent = `目前使用內建備援資料 · ${window.SEL_RESOURCES?.length || 0} 筆資源`;
  statusElement.classList.add("is-fallback");
  console.warn("SEL Firestore unavailable; using bundled resources.", error);
}

await import("./app.js");
