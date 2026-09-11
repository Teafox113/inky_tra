// 示範字串、條件選項、數字上限、退點與重新分配。
=== choose_name ===
在這一夜開始前，先決定別人如何稱呼你。
目前名字：{hero_name}。
+ [使用目前的名字：{hero_name}]
    -> choose_background
+ [改名為林晚]
    ~ hero_name = "林晚"
    -> choose_background
+ [改名為林澄]
    ~ hero_name = "林澄"
    -> choose_background

=== choose_background ===
{hero_name}，你為什麼守著渡鴉舊書店？
+ [書店繼承人：我想解開父親的警告]
    ~ background = "書店繼承人"
    ~ knows_warning = true
    -> allocate_attributes
+ [港口跑腿人：我熟悉鐘塔旁的暗門]
    ~ background = "港口跑腿人"
    ~ inventory += copper_key
    -> allocate_attributes
+ [議會見習生：沈月曾經教我辨認潮汐記錄]
    ~ background = "議會見習生"
    ~ trust = 1
    -> allocate_attributes

=== allocate_attributes ===
屬性分配：尚有 {attribute_points} 點。
體魄 {vigor}／洞察 {insight}／共感 {empathy}。每項最低 1、最高 4。
體魄用於機關，共感用於交涉，洞察用於調查與儀式。
+ {attribute_points > 0 and vigor < 4} [體魄 +1]
    ~ vigor += 1
    ~ attribute_points -= 1
    -> allocate_attributes
+ {attribute_points > 0 and insight < 4} [洞察 +1]
    ~ insight += 1
    ~ attribute_points -= 1
    -> allocate_attributes
+ {attribute_points > 0 and empathy < 4} [共感 +1]
    ~ empathy += 1
    ~ attribute_points -= 1
    -> allocate_attributes
+ {vigor > 1} [退回 1 點體魄]
    ~ vigor -= 1
    ~ attribute_points += 1
    -> allocate_attributes
+ {insight > 1} [退回 1 點洞察]
    ~ insight -= 1
    ~ attribute_points += 1
    -> allocate_attributes
+ {empathy > 1} [退回 1 點共感]
    ~ empathy -= 1
    ~ attribute_points += 1
    -> allocate_attributes
+ [重設全部屬性]
    ~ vigor = 1
    ~ insight = 1
    ~ empathy = 1
    ~ attribute_points = 5
    -> allocate_attributes
+ {attribute_points == 0} [屬性分配完成，選擇技能] -> allocate_skills

=== allocate_skills ===
技能分配：尚有 {skill_points} 點。
觀察 {observation}／儀式 {ritual}／交涉 {persuasion}。每項最低 0、最高 3。
調查分數＝洞察＋觀察；儀式分數＝洞察＋儀式；交涉分數＝共感＋交涉。
+ {skill_points > 0 and observation < 3} [觀察 +1]
    ~ observation += 1
    ~ skill_points -= 1
    -> allocate_skills
+ {skill_points > 0 and ritual < 3} [儀式 +1]
    ~ ritual += 1
    ~ skill_points -= 1
    -> allocate_skills
+ {skill_points > 0 and persuasion < 3} [交涉 +1]
    ~ persuasion += 1
    ~ skill_points -= 1
    -> allocate_skills
+ {observation > 0} [退回 1 點觀察]
    ~ observation -= 1
    ~ skill_points += 1
    -> allocate_skills
+ {ritual > 0} [退回 1 點儀式]
    ~ ritual -= 1
    ~ skill_points += 1
    -> allocate_skills
+ {persuasion > 0} [退回 1 點交涉]
    ~ persuasion -= 1
    ~ skill_points += 1
    -> allocate_skills
+ [重設全部技能]
    ~ observation = 0
    ~ ritual = 0
    ~ persuasion = 0
    ~ skill_points = 4
    -> allocate_skills
+ {skill_points == 0} [檢查角色設定] -> character_confirmation

=== character_confirmation ===
-> character_sheet ->
+ [確認，讓第十三聲鐘響起]
    ~ original_name = hero_name
    -> rainy_guest
+ [返回調整屬性] -> allocate_attributes
+ [返回調整技能] -> allocate_skills
