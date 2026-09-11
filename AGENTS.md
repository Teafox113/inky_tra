# Inky 繁體中文版開發規範

- 使用繁體中文；每次對話重新查看工作區及 `docs/任務日誌.md`。
- 本倉庫只維護 Inky 編輯器。禁止匯入商業遊戲的原文、譯文、素材、編譯故事 JSON、封存檔或注入工具。
- 測試使用本專案原創 `app/examples/` 劇本。保留上游 MIT 語法工具片段及授權；新增 `.ink` 須明確記錄來源並更新 `scripts/ink-allowlist.json`。
- 舊翻譯專案僅供讀取參考，禁止覆蓋它。私人設定、備份及測試輸出放在被忽略的 `.local/`，不得提交 API Key、memory.md、soul.md。
- 作者 FloofyFox，GitHub https://github.com/Teafox113/inky_tra；標明非官方 fork，保留 inkle 與第三方權利。
- 制式資訊來源 `F:\APP開發\制式資訊`。發布前讀取其 README.md、creator.json、standard-info.json。使用者已於 2026-09-12 確認為共用頭像著作權持有人；同一素材可用於其程式，不重複詢問。程式目前仍使用文字／emoji。
- 版本以 `app/version.json` 為準；同步 app/package.json、README、CHANGELOG、程式內 About、封裝 metadata 與檔名。版本／README／Change Log 更新後，執行 `F:\APP開發\制式資訊\INKY\同步資料.ps1`，同步共用參考文件。
- 修改前保留 Git 差異或 `.local/` 備份；完成後更新任務日誌、檔案地圖與驗證結果。
- 驗證命令：`npm test`、`npm run check:publish`。發布前還需完成 `docs/繁中測試計畫.md` 的互動測試。
- 建置只使用 `npm run build:win`；發布、push 與 Release 依使用者當次授權執行。不得把「準備發布」當成已授權立即推送。
