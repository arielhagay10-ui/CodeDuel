/**
 * Problem content for the mock backend.
 *
 * Real statements, real starter code, and two public tests each, so the round
 * page is exercised against the same shapes Postgres will hand it later.
 */
import type { RoundProblem } from "@/types/api";

export const mockProblems: RoundProblem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "pair-indices",
    title: "Pair Indices",
    difficulty: "medium",
    format: "function",
    entrypoint: "pair_indices",
    statementMarkdown: `Given a list of integers and a target, return the indices of the two different values that add up to the target.

You may assume exactly one valid pair exists. Return the smaller index first.

## Examples

\`\`\`python
pair_indices([2, 7, 11, 15], 9)   # [0, 1]
pair_indices([3, 2, 4], 6)        # [1, 2]
\`\`\`

## Constraints

- 2 <= len(numbers) <= 100000
- -1000000000 <= numbers[i] <= 1000000000
- Aim for O(n) time. A nested loop will time out on the hidden tests.
`,
    starterCode: `def pair_indices(numbers, target):
    # Return the indices of two values whose sum is target.
    pass
`,
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    publicTests: [
      { ordinal: 1, inputData: '{"args": [[2, 7, 11, 15], 9], "kwargs": {}}', expectedOutput: "[0, 1]" },
      { ordinal: 2, inputData: '{"args": [[3, 2, 4], 6], "kwargs": {}}', expectedOutput: "[1, 2]" },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "balanced-brackets",
    title: "Balanced Brackets",
    difficulty: "medium",
    format: "function",
    entrypoint: "is_balanced",
    statementMarkdown: `A string of brackets is balanced when every opening bracket is closed by the matching kind, in the right order.

Return \`True\` when the string is balanced and \`False\` otherwise. The empty string is balanced.

## Examples

\`\`\`python
is_balanced("([]{})")   # True
is_balanced("([)]")     # False
\`\`\`

## Constraints

- The string contains only the characters \`()[]{}\`.
- 0 <= len(text) <= 200000
- One pass with a stack is enough.
`,
    starterCode: `def is_balanced(text):
    # Return True when every bracket is closed by its matching kind.
    pass
`,
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    publicTests: [
      { ordinal: 1, inputData: '{"args": ["([]{})"], "kwargs": {}}', expectedOutput: "true" },
      { ordinal: 2, inputData: '{"args": ["([)]"], "kwargs": {}}', expectedOutput: "false" },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "medium",
    format: "function",
    entrypoint: "merge_intervals",
    statementMarkdown: `Given a list of closed intervals, merge every pair that overlaps or touches, and return the merged list sorted by start.

Intervals that share only an endpoint still merge: \`[1, 3]\` and \`[3, 5]\` become \`[1, 5]\`.

## Examples

\`\`\`python
merge_intervals([[1, 3], [2, 6], [8, 10]])   # [[1, 6], [8, 10]]
merge_intervals([[1, 4], [4, 5]])            # [[1, 5]]
\`\`\`

## Constraints

- 1 <= len(intervals) <= 100000
- Each interval is \`[start, end]\` with start <= end.
- The input is not sorted.
`,
    starterCode: `def merge_intervals(intervals):
    # Return the intervals merged and sorted by start.
    pass
`,
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    publicTests: [
      { ordinal: 1, inputData: '{"args": [[[1, 3], [2, 6], [8, 10]]], "kwargs": {}}', expectedOutput: "[[1, 6], [8, 10]]" },
      { ordinal: 2, inputData: '{"args": [[[1, 4], [4, 5]]], "kwargs": {}}', expectedOutput: "[[1, 5]]" },
    ],
  },
];
