# Quiz generation prompt

Paste this into an AI assistant, fill in `[TOPIC]` and `[SECONDS]`, and save the output as a `.json` file. Upload it on the `/host` page.

```
Create a trivia quiz as a single JSON object with no commentary and no code fences.

Topic: [TOPIC]
Time limit: [SECONDS] seconds

Format:
{
  "schemaVersion": 1,
  "title": string,
  "description": one sentence telling players what to name,
  "timeLimitSeconds": number,
  "answerLabel": short column header for the answers,
  "hintLabel": optional column header for hints,
  "answers": [
    { "display": string, "aliases": [string], "hint": optional string }
  ]
}

Rules:
- The list must be complete and factually correct for the topic as of today. If the topic has no definitive list, choose a clear cutoff and say so in the description.
- "display" is the canonical name. It is automatically accepted, so do not repeat it in "aliases".
- "aliases" holds every other reasonable thing a person might type: common abbreviations, former names, alternate spellings, and last name only for people when it is unambiguous.
- Matching ignores case, accents, punctuation, and a leading "the", so do not add aliases that differ only in those ways.
- No alias may be valid for two different answers.
- Either give every answer a "hint" or give none of them one. Hints must not contain the answer.
- Keep the answer count between 10 and 200.
```
