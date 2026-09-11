// 霧港十三夜：第十三聲 — Inky 繁中互動教學
// 依使用者指示，改編其 novel-studio 範例設定；新增敘事與 Ink 流程。
// 在左側編輯下行可自訂姓名；右側預覽不提供自由文字輸入框。
VAR hero_name = "林晝"
VAR original_name = ""
VAR background = "書店繼承人"
VAR vigor = 1
VAR insight = 1
VAR empathy = 1
VAR attribute_points = 5
VAR observation = 0
VAR ritual = 0
VAR persuasion = 0
VAR skill_points = 4
VAR trust = 0
VAR clues = 0
VAR pressure = 0
VAR knows_warning = false
VAR heard_echo = false
VAR found_record = false
VAR ending_id = ""
LIST inventory = blue_book, copper_key, tide_map

INCLUDE 角色建立.ink
INCLUDE 雨夜來客.ink
INCLUDE 鐘塔議會.ink
INCLUDE 系統工具.ink

-> welcome

=== welcome ===
霧港十三夜：第十三聲
一段可直接操作的 Ink 教學冒險，改編自 Novel Studio 的「霧港十三夜」設定。
你將決定自己的名字、分配屬性與技能，再走進渡鴉舊書店的雨夜。
這裡的選擇會被本次遊玩記住；重新開始會重設進度，關閉程式不會自動保存遊戲存檔。
+ [開始建立角色] -> choose_name
+ [先看操作說明]
    姓名可從選項選擇，或在左側修改 hero_name 的初始字串後重新開始。
    點數透過右側選項分配；條件不足的選項會隱藏。故事中的檢定採固定分數，不擲骰。
    左側的 INCLUDE 連接多個檔案。你可以用右側劇情一路遊玩，再回頭研究對應段落。
    ++ [我知道了，開始建立角色] -> choose_name
