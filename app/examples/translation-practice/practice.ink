// Original example for this project, 2026 FloofyFox, MIT License.
VAR cups = 0
-> bookshop

=== bookshop ===
Rain taps against the window of Maple Bookshop.
Mira asks, "Would you like some tea?"
+ [Accept the tea]
    ~ cups = cups + 1
    This is your cup number {cups}.
    -> goodbye
+ [Browse the shelves]
    You find a notebook with a blue cover.
    -> goodbye

=== goodbye ===
Mira waves as you leave Maple Bookshop.
-> END
