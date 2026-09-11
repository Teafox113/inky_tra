// 示範多層 * 選項、一次性調查、條件分支、LIST 與因果記憶。
=== rainy_guest ===
霧港入夜後，渡鴉舊書店只剩你和一盞桌燈。
遠處鐘塔已報過午夜，雨聲裡卻又多出一次鐘鳴。
玻璃映著你的臉，也映著停在門外的人；唯獨那人的腳下，沒有影子。
他懷中抱著一本藍皮書。雨水從袖口往下流，書脊卻乾得像剛離開書架。
{knows_warning:
    父親曾說，第十三聲出現時，別急著替來客開門。你一直以為那只是哄小孩的故事。
- else:
    你第一次發現，書店門楣上刻著一道被人劃去的鐘形記號。
}
門把轉動，燈芯無聲地暗了下去。
-> bookshop_hub

=== bookshop_hub ===
{bookshop_hub > 1:
    你仍記得剛才的調查。來客站在櫃檯前，等待你決定下一步。
}
目前線索 {clues}／信任 {trust}／鐘聲壓力 {pressure}。
* [和來客交談]
    他自稱替潮汐議會送信，卻不肯說自己的名字。
    ** [追問藍皮書的來歷]
        「這本書記的不是故事，是大家同意忘記的事。」
        *** [答應保護書，也替他留一盞燈]
            ~ trust += 2
            ~ inventory += blue_book
            他終於把書交給你，並留下記錄官沈月的名字。
            -> bookshop_hub
        *** [堅持先核對議會印記]
            {score(empathy, persuasion) >= 4:
                ~ trust += 1
                ~ clues += 1
                ~ found_record = true
                你的語氣讓他放下戒心。他指出書角那枚逆向的潮汐印章。
            - else:
                ~ pressure += 1
                來客把手縮回袖裡。「你還沒有學會，什麼問題必須等天亮。」
            }
            ~ inventory += blue_book
            他留下書，請你親自去問沈月。
            -> bookshop_hub
    ** [問他為什麼沒有影子]
        「我曾用自己的名字，換一個人平安回家。」
        ~ heard_echo = true
        ~ clues += 1
        ~ inventory += blue_book
        他說，若想知道代價，就帶著書去舊鐘塔。
        -> bookshop_hub
* [調查父親留下的書桌]
    桌面有一封未寄出的信，以及裝滿舊票根的抽屜。
    ** [檢查信紙上的凹痕]
        {score(insight, observation) >= 4:
            ~ knows_warning = true
            ~ clues += 1
            ~ found_record = true
            你讀出父親壓在下一張紙上的字：別讓鐘塔替所有人決定遺忘。
        - else:
            ~ pressure += 1
            你只能辨認出「黎明」兩字。窗外又傳來一次低沉的鐘鳴。
        }
        -> bookshop_hub
    ** [翻找抽屜裡的物品]
        *** [收起銅鑰匙]
            ~ inventory += copper_key
            鑰匙末端刻著和鐘塔相同的圖案。
            -> bookshop_hub
        *** [收起潮汐地圖]
            ~ inventory += tide_map
            ~ clues += 1
            地圖上標出一條只在退潮時露出的地下通道。
            -> bookshop_hub
* {inventory ? blue_book} [嘗試閱讀藍皮書]
    {score(insight, ritual) >= 5:
        ~ heard_echo = true
        ~ clues += 1
        書頁低鳴。你聽見一群人正在同一天反覆說再見，卻誰也不記得對方。
    - else:
        ~ pressure += 1
        紙頁合了起來。你還讀不懂它，但至少知道這本書會對儀式產生反應。
    }
    -> bookshop_hub
+ [查看角色、物品與目前記憶]
    -> character_sheet ->
    -> bookshop_hub
+ {inventory ? blue_book} [帶著藍皮書前往鐘塔] -> canal
