# Inky Translation Fork — 繁體中文與 AI 翻譯擴充版

由 **FloofyFox** 維護的非官方 [Inky](https://github.com/inkle/inky) fork，提供繁體中文介面、Ink 文本翻譯與 AI 助理，適合互動小說作者與在地化工作者。

| 項目 | 資訊 |
|---|---|
| 版本 | **1.8.0-dev.3**（開發版，尚未正式發布） |
| 修改日期 | 2026-09-12 |
| 維護者 | [FloofyFox](https://github.com/Teafox113) |
| 倉庫 | https://github.com/Teafox113/inky_tra |
| 改編來源 | 既有 Inky 0.15.2 改編程式；原說明頁標示擴充版 v1.7 |
| 目標平台 | Windows x64；macOS／Linux 尚未驗證 |
| 預定發布檔名 | `Inky-Translation-Fork-v1.8.0-dev.3-windows-x64.zip` |

本專案並非 inkle 官方發布，也不代表 inkle 為新增功能背書。Inky 與 ink 原作者為 inkle Ltd.；保留原始 MIT 授權。

## 本版本功能

- 繁體中文／英文介面切換。
- 目前檔案、專案與選取文字翻譯，透過使用者設定的 API 執行。
- OpenRouter 模型清單與價格顯示、自訂 OpenAI 相容端點。
- 翻譯用量及費用估算、批次處理與部分錯誤重試。
- Ink 行類型解析、部分標籤保護、CSV 詞彙表。
- 搜尋取代及 AI 助理面板；助理可使用角色預設、附加文本、記憶與人格設定。
- 預設「霧港十三夜」教學：角色建立、點數分配、三層分支、物品與四種結局；另保留「雨天書店」及英文翻譯練習。

上述既有功能已匯入；完整互動驗證仍在進行，不能視為全部已通過發布驗收。

## 開啟 Windows 測試版

解壓 Inky-Translation-Fork-v1.8.0-dev.3-windows-x64.zip 後，雙擊 Inky-Translation-Fork.exe。首次啟動預設繁體中文並開啟「霧港十三夜」。舊版使用者升級後也展示一次；可從 **範例 → 開啟範例：霧港十三夜（角色與分支教學）** 重新開啟。ZIP 中也有可直接瀏覽的 **範例** 資料夾。

程式會在自己的使用者資料目錄建立範例副本，重開時保留你的編輯。若先前明確選擇英文，可在翻譯設定的介面語言切回繁中。

## 開發啟動

需要 Windows、Git 與 Node.js 22 以上。

```powershell
git clone https://github.com/Teafox113/inky_tra.git
cd inky_tra
npm --prefix app ci
npm start
```

本倉庫提供 1.8.0-dev.3 開發版原始碼。Windows 測試包可依下方建置命令自行產生；目前尚未建立可下載的 GitHub Release。

本機啟動使用本工作區 `.local/user-data/`，與舊 Inky 的設定分開。正式封裝使用獨立的 `Inky Translation Fork` 使用者資料目錄。開啟 `app/examples/霧港十三夜/主程式.ink` 可體驗完整教學，詳見 [範例說明](app/examples/霧港十三夜/README.md)。請複製整個範例資料夾，保留 INCLUDE 相對路徑。

翻譯練習請先將 `app/examples/translation-practice/` 複製到 `.local/`，設定自己的 API，開啟 `practice.ink` 並選用同資料夾的 `glossary.csv`。API 測試會依服務商規則產生費用。

## 驗證與建置

```powershell
npm test
npm run check:publish
npm run build:win
```

Windows 建置輸出至被 Git 忽略的 `dist/`，使用版本化目錄與 EXE metadata。建置不會建立 GitHub Release 或推送。第一次建置可能下載 Electron；正式發布前須完成 [繁中測試計畫](docs/繁中測試計畫.md)。

## 隱私與資料處理

- 一般編輯與 Ink 編譯在本機執行。
- 執行翻譯或 AI 對話時，所選文本、提示詞、詞彙表，以及附加的上下文可能送至設定的 API。助理的人格與記憶會加入對話提示。
- 模型清單／連線測試也可能連線至服務商。本程式不能控制第三方的保存政策或費用。
- 「記住 API Key」目前會將 Key 存在本機 JSON，**未加密**。本倉庫不包含任何 Key 或私人設定。
- 費用顯示是依回傳 token 與設定單價計算的估算值，應以供應商帳單為準。

## 已知限制

- Ink 翻譯解析器並非完整編譯器；選取文字翻譯會略過逐行 Ink 解析。翻譯後需編譯與人工確認。
- 助理目前直接附加文本；精確語法分離、可確認 diff 的自動修改流程尚未完成。
- 詞彙表後處理主要替換殘留英文，不保證修正所有中文譯名變體。
- 尚未完成整套 UI、API、IME 中文輸入與封裝互動測試；承接的 Electron 30 系列依賴仍待升級評估。
- 編輯器顯示中文不代表其他遊戲引擎也支援中文字型。
- 範例姓名採選項或編輯 VAR；預覽未實作自由文字輸入／數值表單。Ink 變數記住本次遊玩，保存 .ink 是保存原始碼，並非遊戲進度存檔。
- 不含第三方商業遊戲原文、譯文或素材。「霧港十三夜」依使用者指示改編其 Novel Studio 範例設定，新增 Ink 敘事與流程；另保留原創練習與上游 MIT 通用語法片段。

## 授權與維護

詳見 [LICENSE](LICENSE)、[第三方授權](THIRD_PARTY_LICENSES.md)、[修改紀錄](CHANGELOG.md) 與 [專案地圖](docs/PROJECT_MAP.md)。原始上游說明保留於 [UPSTREAM_README.md](docs/UPSTREAM_README.md)。
