// function 回傳計算結果；tunnel 可共用狀態畫面並回到呼叫處。
=== function score(attribute, training) ===
~ return attribute + training

=== character_sheet ===
【角色狀態】{hero_name}／{background}
體魄 {vigor}／洞察 {insight}／共感 {empathy}；未用屬性點 {attribute_points}。
觀察 {observation}／儀式 {ritual}／交涉 {persuasion}；未用技能點 {skill_points}。
調查 {score(insight, observation)}／儀式 {score(insight, ritual)}／交涉 {score(empathy, persuasion)}。
線索 {clues}／信任 {trust}／鐘聲壓力 {pressure}。
{inventory ? blue_book:物品：藍皮書。}
{inventory ? copper_key:物品：銅鑰匙。}
{inventory ? tide_map:物品：潮汐地圖。}
{LIST_COUNT(inventory) == 0:目前沒有攜帶物品。}
{knows_warning:記憶：父親的警告。}
{heard_echo:記憶：書頁中的回聲。}
{found_record:記憶：議會留下的記錄。}
->->
