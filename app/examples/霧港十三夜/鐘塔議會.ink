// 示範檢定失敗仍能前進、多入口匯流、資源代價與四種結局。
=== canal ===
清晨四點，你來到舊鐘塔前。記錄官沈月正站在封鎖線外。
{background == "議會見習生":
    「{hero_name}，你終於來了。」她認得你，語氣裡多了一點放心。
- else:
    你報上名字。沈月看見你手中的藍皮書，才放下攔路的手。
}
+ [向沈月坦白書店發生的一切]
    ~ trust += 1
    她把你說的每一件事記進小冊，連來客沒有影子這件事也沒有漏掉。
    -> tower_gate
+ [先請她證明自己的身分]
    {score(empathy, persuasion) >= 5:
        ~ trust += 1
        ~ clues += 1
        她出示一份被塗去日期的會議記錄。你注意到簽名裡有父親的筆跡。
    - else:
        ~ pressure += 1
        「沒關係，你可以慢慢決定要不要相信我。」她退後半步，仍然讓出入口。
    }
    -> tower_gate

=== tower_gate ===
鐘塔的門被鎖住，門邊的排水口傳來潮水聲。
+ {inventory ? copper_key} [用銅鑰匙打開側門]
    鑰匙轉動，你避開了正門的生鏽鐵鏈。
    -> beneath_tower
+ {inventory ? tide_map} [依照潮汐地圖走地下通道]
    ~ heard_echo = true
    地圖帶你穿過水道。牆後傳來一個聲音，正念著你的名字。
    -> beneath_tower
+ [嘗試抬起正門鐵閂，體魄 {vigor}／需要 3]
    {vigor >= 3:
        沈月替你穩住門板，你把鐵閂抬離卡槽。
    - else:
        ~ pressure += 1
        鐵閂紋絲不動。沈月取出備用鑰匙，你們多花了一些時間才走進去。
    }
    -> beneath_tower
+ [請沈月帶路]
    ~ pressure += 1
    你們繞到管理員入口。等她找到鑰匙時，海水已漫過第一級石階。
    -> beneath_tower

=== beneath_tower ===
石階往下延伸，深得不像鐘塔的一部分。牆上的水痕卻一級一級向上移動。
-> chamber

=== chamber ===
沉潮廳中央擺著五張空椅，每張椅子前都有一個寫到一半的名字。
藍皮書自行翻開。你終於明白，議會每年抹去一夜，是為了讓城市忘記曾經答應海的事。
{found_record:
    你帶來的記錄能證明，契約從來不是所有人共同作出的決定。
}
{heard_echo:
    你能分辨書頁中的聲音；那是被刪去的人，不是海潮。
}
沈月問：「{hero_name}，你要替霧港留下什麼？」
+ {heard_echo and trust >= 2 and score(insight, ritual) >= 5 and pressure <= 2} [和沈月一起改寫契約，讓失去的一夜回來]
    -> ending_restore
+ {clues >= 2 and score(insight, observation) >= 5} [公開議會記錄，讓居民自行決定]
    -> ending_record
+ [用自己的名字換霧港平安度過黎明]
    -> ending_name
+ [先帶著書撤離，保留下一次選擇的機會]
    -> ending_wait
+ [查看條件與角色狀態]
    -> character_sheet ->
    改寫契約需要：聽見回聲、信任至少 2、儀式分數至少 5、鐘聲壓力不超過 2。
    公開記錄需要：至少 2 條線索、調查分數至少 5。
    其他兩條路線永遠可選；失敗不會讓示範卡死。
    -> chamber

=== ending_restore ===
~ ending_id = "restore"
你讀出被抹去的名字，沈月逐字記錄。藍皮書第一次在雨裡濕了。
天亮時，霧港的人們想起那一夜，也想起曾失去的人。你沒有替他們選擇遺忘。
結局一：第十三夜歸來。
-> ending_summary

=== ending_record ===
~ ending_id = "record"
你沒有替議會簽字，而是帶著記錄走上鐘塔。沈月把每一頁抄成居民能閱讀的文字。
鐘聲仍然響起，但這一次，霧港知道自己正在付出什麼，也終於能說不。
結局二：留下證詞的人。
-> ending_summary

=== ending_name ===
~ ending_id = "name"
~ hero_name = "無名旅人"
你把名字交給潮水。鐘聲停了，門外的街道重新亮起。
沈月的筆停在半空。她記得有人救了這座城，卻再也寫不出那人的姓名。
你知道自己曾叫做{original_name}，但如今每個人只能稱你為{hero_name}。
結局三：被海帶走的名字。
-> ending_summary

=== ending_wait ===
~ ending_id = "wait"
你合起藍皮書，和沈月退回街上。鐘塔還沒有給出答案，你也沒有假裝一切已經結束。
渡鴉舊書店的燈再次亮起。這一夜留下的線索，會成為你下一次回來的起點。
結局四：留給明天的問題。
-> ending_summary

=== ending_summary ===
-> character_sheet ->
本次示範完成。結局代碼：{ending_id}。
故事中的名字、點數、物品、信任與線索都由 Ink 變數保存。這段記憶只屬於本次遊玩，不等於磁碟存檔。
若想換一種角色重新體驗，請使用 Inky 的重新開始按鈕；若要保存遊戲進度，需由宿主程式另外實作。
-> END
