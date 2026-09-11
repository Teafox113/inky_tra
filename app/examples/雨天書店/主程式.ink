// 本專案原創操作示範，2026 FloofyFox，MIT License。
VAR cups = 0
-> bookstore

=== bookstore ===
窗外下著小雨，你走進街角的書店。
店員說：「歡迎！想先看看書，還是喝杯熱茶？」
+ [看看書架] -> shelf
+ [喝杯熱茶]
    ~ cups = cups + 1
    茶香慢慢散開。這是你的第 {cups} 杯茶。
    -> bookstore
+ [離開書店] -> farewell

=== shelf ===
你找到一本空白筆記本，封面寫著「今天的新故事」。
{cups > 0:
    喝過熱茶後，你想到一個溫暖的開場。
- else:
    你決定先記下雨聲。
}
+ [回到櫃檯] -> bookstore

=== farewell ===
你推開門，雨已經停了。
-> END
