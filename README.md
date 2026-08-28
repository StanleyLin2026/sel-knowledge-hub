# SEL 知識樞紐

社會情緒學習（Social and Emotional Learning, SEL）整合資料庫的靜態 MVP，示範如何以共同指標連結課程綱要、教案、評量工具、學術研究與各國公開資料。

## 使用者與情境

- 學者與研究人員：檢索研究證據、比較工具、匯出資料。
- 教師與課程設計者：依學段、能力與領域尋找教案及評量策略。
- 學生：使用年齡適切的活動與形成性回饋資源。
- 教師工作坊：組合增能教材、歷程評估與成果資料。

## MVP 功能

- 六類 SEL 資源的跨類型搜尋與條件篩選。
- 依教育階段、SEL 能力及證據狀態瀏覽。
- 資源詳情與來源／權利狀態提示。
- 本機收藏資料夾（使用瀏覽器 localStorage）。
- 目前搜尋結果 CSV 匯出與收藏 JSON 匯出。
- 每筆資源可透過 Obsidian URI 開啟 vault 中的對應卡片。
- 響應式、鍵盤可操作的繁體中文介面。

## 串接 Obsidian

同步工具可直接讀取 Firestore 中已發布的資料，轉換為具有 YAML properties、雙向連結與來源標記的 Markdown 卡片。再次同步時，`## 個人筆記` 以下的內容會保留。

```bash
python3 tools/sync_to_obsidian.py \
  --vault "/path/to/your/vault" \
  --folder "SEL-Database" \
  --firestore
```

網站可透過頁首「Obsidian」按鈕設定 vault 名稱與資源卡相對資料夾；這兩項設定僅保存在使用者瀏覽器的 `localStorage`，不會寫入 GitHub 或傳送至網站。資源詳情中的「在 Obsidian 中開啟」會使用官方 Obsidian URI 定位相應卡片。

## Firebase 後台

- 專案：`seldatabase20260827`
- 資料庫：Cloud Firestore Standard，`asia-east1 (Taiwan)`
- 集合：`resources`（公開資源）與 `metadata`（目錄資訊）
- 權限：訪客只能讀取 `status == "published"` 的資源；瀏覽器端禁止寫入
- 前端：優先查詢 Firestore，連線失敗時自動改用 `data/resources.js`
- 視覺化後台：`admin.html` 直接連接 Firebase Authentication 與 Cloud Firestore，可新增、編輯、審查、發布、刪除及匯出 JSON
- 後台登入：使用 Firebase Authentication 的 Google 登入；第一位管理者為 `jerlih2@gmail.com`
- 角色權限：管理者可完整管理資源與使用者角色；編輯者可處理草稿／待審內容；檢視者只能閱讀
- 使用者資料：首次登入後在 Firestore `users/{uid}` 建立角色資料，所有授權由 Firestore Security Rules 強制執行

在已登入專案的 Google Cloud Shell 中，可執行：

```bash
firebase deploy --only firestore:rules --project seldatabase20260827
node tools/seed-firestore.mjs
```

管理者可在 Firebase Console 編輯內容；要重新同步示範資料時，再執行 seed 指令。請勿把服務帳戶金鑰加入儲存庫。

## 本機預覽

```bash
python3 -m http.server 8000
```

然後開啟 `http://localhost:8000`。

## 資料說明

目前資料均為架構與介面示範，並非正式發布的課程標準、量表或研究摘要。正式資料應完成：

1. 原始來源及最新版本查核。
2. SEL 架構與我國課綱映射的專家審查。
3. 評量工具信效度、適用族群及授權確認。
4. 學術文獻 DOI、APA 7 書目與開放取用狀態查核。
5. 版本管理、更新頻率及停用規則。

## 技術架構

本版為無建置程序的靜態網站，以 HTML、CSS、原生 JavaScript 與 Firebase Web SDK 開發；Cloud Firestore 為前台及後台資料來源，`data/resources.js` 為前台離線備援。後台以 Firebase Authentication 確認 Google 帳號身分，並由 Firestore Security Rules 執行角色式授權。

## 授權

程式碼採 MIT License。示範內容與未來收錄資料的授權狀態應逐筆標示，並以原始來源規範為準。
