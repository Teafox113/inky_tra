# 工作區地圖

- app/：中文化 Inky 程式、Ink 編譯器、原創示範。
- app/version.json：版本、製作者、功能與資料處理的制式資訊。
- app/main-process/translationManager.js：翻譯核心。
- app/renderer/translationView.js：翻譯設定及使用說明。
- app/renderer/assistantView.js：AI 助理介面。
- app/examples/：原創測試劇本與依使用者指示改編其 Novel Studio 設定的教學版本。
- app/examples/霧港十三夜/：預設五檔互動教學與操作說明；開啟主程式.ink。
- tests/mist-harbor.test.js：角色分配、三層分支、條件與四結局的實際遊玩驗證。
- scripts/：開發啟動、發布範圍檢查、Windows 建置、授權整理。
- tests/：離線自動驗證。
- third_party/：原始授權與 npm 執行期依賴清單。
- docs/：操作驗證、上游說明及任務日誌。
- .local/：不提交的匯入 manifest、個人設定、測試輸出與建置暫存。
- dist/：不提交 Git 的版本化 Windows 發布檔。

origin 為 Teafox113/inky_tra；upstream 為 inkle/inky。本機開發分支 codex/zh-tw-workspace。原翻譯專案留在舊位置，不屬於本倉庫。

共用參考資料：`F:\APP開發\制式資訊\INKY`。版本與 README 更新後，執行該目錄的 `同步資料.ps1`；僅同步列明的版本與說明文件，不同步程式、遊戲或個人設定。

- app/main-process/glossary.js：CSV 解析、欄位驗證、候選詞審閱與去重模型。
- app/renderer/glossaryView.js：詞彙表管理、範圍確認、分批掃描與人工採用。
- tests/glossary.test.js：CSV 相容性、錯誤與模擬 AI 回應／費用驗證。
