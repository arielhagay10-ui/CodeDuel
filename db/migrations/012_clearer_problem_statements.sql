-- Presentation-only clarification of the original exercises. No tests, solutions,
-- difficulty levels, or player records change. Safe to apply repeatedly.
BEGIN;
WITH descriptions(slug, statement) AS (VALUES
('digit-sum', $text$## Your task
Add up the individual digits of `number`.

## Input and return value
- `number` is a non-negative integer.
- Return an integer: the sum of its decimal digits.

## Example explained
For 123, the digits are 1, 2, and 3. Their sum is 6. For 0, return 0.$text$),
('unique-sorted', $text$## Your task
Remove repeated values from a list, then put the remaining values in order from smallest to largest.

## Input and return value
- `values` is a list of integers.
- Return a list containing each distinct integer once, in ascending order.
- An empty input list produces an empty list.

## Example explained
In [3, 1, 3, 2], the value 3 appears twice. Keep it once and return [1, 2, 3].$text$),
('word-count', $text$## Your task
Count the words in `text`. Words are groups of characters separated by whitespace (spaces, tabs, or newlines).

## Input and return value
- `text` is a string.
- Return the number of words as an integer.
- Repeated whitespace does not create extra words. Empty or whitespace-only text has 0 words.

## Example explained
"hello world" contains two words, so return 2.$text$),
('toggle-case', $text$## Your task
Change every uppercase letter to lowercase and every lowercase letter to uppercase.

## Input and return value
- `text` is a string.
- Return the changed string. Keep digits, spaces, and punctuation unchanged.

## Example explained
"AbC" becomes "aBc". The string "123" stays "123".$text$),
('running-total', $text$## Your task
Build a list of running totals. Each position should contain the sum of all input values up to and including that position.

## Input and return value
- `values` is a list of numbers.
- Return a list of the same length containing the cumulative sums.
- Return [] for an empty list.

## Example explained
For [2, 3, -1], the totals are 2, then 2 + 3 = 5, then 5 - 1 = 4. Return [2, 5, 4].$text$),
('clamp-value', $text$## Your task
Keep a number inside an allowed range, including both endpoints.

## Input and return value
- `value` is the number to adjust. `lower` and `upper` are the allowed bounds, with lower <= upper.
- If value is below lower, return lower.
- If value is above upper, return upper.
- Otherwise return value unchanged.

## Example explained
With bounds 0 and 5, a value of 7 is too high, so return 5. A value of -2 is too low, so return 0.$text$),
('pair-indices', $text$## Your task
Find two different positions whose values add up to `target`. Return their positions, not the values themselves. Positions start at 0.

## Input and return value
- `numbers` is a list of integers and `target` is an integer.
- Return [i, j], where i < j and numbers[i] + numbers[j] equals target.
- If more than one pair works, choose the smallest j; for that j, choose the largest matching i.
- Return [] if there is no pair.

## Example explained
In [2, 7, 11, 15], the values at positions 0 and 1 add up to 9. Return [0, 1].$text$),
('balanced-brackets', $text$## Your task
Check whether every opening parenthesis has a closing parenthesis in the correct order.

## Input and return value
- `text` is a string. Only ( and ) matter; ignore other characters.
- Return True if all parentheses match; otherwise return False.
- A closing parenthesis cannot appear before its matching opening parenthesis. A string with no parentheses is balanced.

## Example explained
"(())" is balanced. "(()" is not: one opening parenthesis is left unmatched.$text$),
('rotate-right', $text$## Your task
Move the last item of a list to the front, repeating this for the requested number of steps.

## Input and return value
- `values` is a list and `steps` is a non-negative integer.
- Return the rotated list. Preserve the relative order of the items as they wrap around.
- Steps can exceed the list length. Return [] for an empty list.

## Example explained
Rotating [1, 2, 3, 4] right by 1 gives [4, 1, 2, 3]. Rotating a three-item list by 4 has the same effect as rotating it by 1.$text$),
('merge-ranges', $text$## Your task
Combine ranges that overlap or share an endpoint.

## Input and return value
- `ranges` is a list of [start, end] pairs, already sorted by start, with start <= end.
- Both endpoints belong to each range.
- Return the merged ranges in the same sorted order. Return [] for empty input.
- Ranges [1, 2] and [3, 4] remain separate: they do not share any point.

## Example explained
[1, 3] and [2, 5] overlap, forming [1, 5]. Thus [[1, 3], [2, 5], [8, 9]] becomes [[1, 5], [8, 9]].$text$),
('top-frequency', $text$## Your task
Find the value that appears most often. If several values appear equally often, choose the smallest one.

## Input and return value
- `values` is a non-empty list of integers.
- Return the winning value, not the number of times it appears.

## Example explained
In [2, 1, 2, 3, 3, 3], the value 3 appears three times, more than any other value. Return 3. In [4, 1, 4, 1], both values appear twice, so return 1.$text$),
('longest-run', $text$## Your task
Find the largest group of equal values sitting next to each other in the list.

## Input and return value
- `values` is a list of integers.
- Return the length of the longest consecutive group, not the value in that group.
- Separate groups of the same value do not combine. Return 0 for an empty list.

## Example explained
[1, 1, 2, 2, 2, 3] has groups of lengths 2, 3, and 1. The longest is 3.$text$),
('minimum-coins', $text$## Your task
Make exactly `amount` using as few coins as possible. You may reuse each available coin value any number of times.

## Input and return value
- `coins` is a list of positive integer coin values. `amount` is a non-negative integer.
- Return the smallest number of coins needed, not a list of coins.
- Return -1 if the amount cannot be made exactly. Amount 0 needs 0 coins.

## Example explained
For coins [1, 3, 4] and amount 6, two coins of value 3 make 6. Return 2. With only value 2, amount 3 is impossible, so return -1.$text$),
('grid-shortest-path', $text$## Your task
Find the fewest moves from the top-left cell to the bottom-right cell of a grid.

## Input and return value
- `grid` is a rectangular list of rows. A 0 is an open cell; a 1 is blocked.
- Each move goes one cell up, down, left, or right. No diagonal moves or crossing blocked cells.
- Return the number of moves in the shortest path, not the number of cells visited.
- Return -1 if no path exists, the grid is empty, or either endpoint is blocked.
- A single open cell needs 0 moves.

## Example explained
In [[0, 0], [1, 0]], move right and then down to reach the goal. Return 2.$text$)
)
UPDATE problems p SET statement_markdown = d.statement
FROM descriptions d WHERE p.slug = d.slug;
COMMIT;
