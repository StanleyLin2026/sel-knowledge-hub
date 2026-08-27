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

同步工具會將 `data/resources.js` 轉換為具有 YAML properties、雙向連結與來源標記的 Markdown 卡片。再次同步時，`## 個人筆記` 以下的內容會保留。

```bash
python3 tools/sync_to_obsidian.py \
  --vault "/path/to/your/vault" \
  --folder "SEL-Database"
```

網站首次點選「在 Obsidian 中開啟」時，會詢問 vault 名稱與資源卡相對資料夾；這兩項設定僅保存在使用者瀏覽器的 `localStorage`，不會寫入 GitHub 或傳送至網站。

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

本版為無建置程序的靜態網站，以 HTML、CSS 與原生 JavaScript 開發，資料位於 `data/resources.js`。後續可遷移至 PostgreSQL、全文搜尋服務與內容管理後臺。

## 授權

程式碼採 MIT License。示範內容與未來收錄資料的授權狀態應逐筆標示，並以原始來源規範為準。
