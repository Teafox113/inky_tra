# 第三方授權與來源

本專案保留原作者權利。FloofyFox 負責繁中改編與擴充，並非 Inky 原作者。

教學故事「霧港十三夜：第十三聲」依使用者 2026-09-12 指示改編其 Novel Studio 範例設定，新增 Ink 敘事及互動流程；來源為 https://github.com/Teafox113/novel-studio/blob/main/src/data/sampleProject.ts。本資料夾教學版本隨此專案提供，不代表原 Novel Studio 倉庫或其他作品變更授權。詳見 app/examples/霧港十三夜/README.md。

| 元件 | 版本／来源 | 用途 | 授權與 Copyright |
|---|---|---|---|
| Inky | 匯入 package 0.15.2；上游 https://github.com/inkle/inky | 編輯器基礎 | MIT；Copyright (c) 2016 inkle Ltd.，見 LICENSE |
| ink / inklecate | 1.2.0；https://github.com/inkle/ink | Ink 編譯器與通用語法片段 | MIT；inkle Ltd.，見 third_party/ink-LICENSE.txt |
| Electron | 實際安裝版本見 app/package-lock.json；https://github.com/electron/electron | 桌面執行環境 | MIT；Electron contributors / GitHub Inc.；封裝附 LICENSE |
| Chromium 及相依項 | 隨 Electron 版本；https://www.chromium.org | 視窗及網頁執行環境 | 多種授權；封裝附 LICENSES.chromium.html |
| Ace | 內嵌 1.2.6；https://github.com/ajaxorg/ace | 編輯器 | BSD-3-Clause；Ajax.org B.V.；保留 ace.js 檔首聲明 |
| jQuery | 2.2.3；https://github.com/jquery/jquery | 介面 DOM 操作 | MIT；jQuery Foundation and other contributors；見 third_party/jquery-LICENSE.txt |
| Photon | 0.1.1；https://github.com/connors/photon | 介面樣式與字型 | MIT；Copyright 2015 Connor Sears；見 third_party/photon-LICENSE.txt |
| npm 執行期依賴 | third_party/npm-inventory.json | 檔案監控、Ink 預覽及工具 | 逐項版本與授權檔位於 third_party/npm/ |

維護範圍：Inky 的翻譯、助理、介面與包裝；未主動修改上述第三方函式庫。上游文件與歷史保留，完整故事範例從目前發布樹移除。

執行 node scripts/dependency-notices.js 可由已安裝的實際執行期依賴重建版本清單並保存授權。Windows 建置亦執行此步驟。devDependencies 用於開發建置，不隨 prune 後程式散布；如另行散布開發依賴仍需保留其授權。

製作者頭像：使用者已於 2026-09-12 確認本人（FloofyFox）為著作權持有人，可用於其開發程式。本版目前仍使用文字／emoji，尚未匯入或封裝圖片。

授權來源補充：randombytes 2.0.3 的 npm 包未帶 LICENSE，已另存上游 browserify/randombytes 的 MIT 文字；來源 https://github.com/browserify/randombytes/blob/master/LICENSE。Photon/Fontello 與 IcoMoon 圖示字型的細項來源仍待正式發布前核對，以上清單不是完整法律審核結論。
