# DSA Prep Sheet

One sheet for OA preparation, hosted at **https://ayushr97j.github.io/PlayGround/**

| Section | Problems | Source |
|---|---|---|
| Striver A2Z | 495 (452 problems + 43 lessons) | [takeUforward A2Z sheet](https://takeuforward.org/prep-hub/strivers-a2z-dsa-sheet) |
| DSA Master Set | 414 | `DSA_Master_Problem_Set.xlsx` |
| Google Hard | 509 (your 312 from Sheet2 + 197 more) | Sheet2 of the `problem_tracker` Google Sheet, [visor-leetcode](https://hitarth-gg.github.io/visor-leetcode/company/245) data |
| Apple Hard | 52 | Sheet2 of the `problem_tracker` Google Sheet |
| Claude 109 | 59 targeted + 50 breadth | `OA_Practice_Tracker` (parts 1 and 2); statuses and notes from the sheet's *59 + 50 by Claude* tab |
| Company OA | 31 (C1 + C2) | `OA_Practice_Tracker` (11 Oct set) |
| CSES | 75 (Dynamic Programming 23, Graph Algorithms 36, Tree Algorithms 16) | [CSES Problem Set](https://cses.fi/problemset/) |

1,347 unique problems in total. A problem that appears in several sections has one status, one star and one set of notes, so solving it once marks it everywhere.

## Using it

- **Mark a problem**: click the circle to mark it solved (D). The arrow next to it picks the tag: **D** and **D/ND** = solved by yourself (two tags), **ND** = solved after seeing the solution. All three count as solved in every percentage; blank means not solved yet. Filters can show each tag on its own.
- **Notes**: click a problem row (or the note icon) to open its panel. Notes save as you type.
- **Revision**: star a problem to put it on the *Revise* list; press *Revised today* in its panel after you redo it.
- **Filters**: search (press `/`), status, difficulty, zerotrac rating range, topic tag, sort by rating, and *Random* for a random unsolved problem.
- **Ratings** are zerotrac contest ratings for LeetCode and problem ratings for Codeforces.

## Keeping your progress safe

Progress is saved in your browser automatically. Click the save status at the top right for the other options:

1. **Auto-save to a file** (Chrome / Edge): pick a file once and every change is written to it. Keep it in OneDrive or Google Drive, and on another computer choose *Open existing file*.
2. **Sync through GitHub**: paste a token with only the `gist` scope. Progress then lives in a private gist on your account and syncs on every change and each time you return to the tab. Use the same token on each computer.
3. **Backup file**: download a `.json` backup and load it anywhere (merge keeps the newest change for each problem).
4. **Export CSV** for Excel, with D / D/ND / ND codes in the same column order as Sheet2.

## Privacy: passphrase lock

The site opens on a lock screen. The problem lists and the progress imported from the workbooks are stored only in encrypted form in `data/vault.json` (AES-256-GCM, key derived from the passphrase with PBKDF2-SHA256, 600,000 iterations), and the browser decrypts them after you enter the passphrase. *Remember on this device* keeps a non-exportable key in the browser so you are not asked again; the lock button at the top right forgets it.

Progress you make on the site is never written to this repo: it stays in your browser, your progress file or your private gist.

To update the data, decrypt, edit, and lock again (Node 18+). `lock` asks for the current passphrase once and keeps it, so devices that remember it stay unlocked; add `--new-passphrase` to change it.

```bash
node tools/vault.mjs unlock data/vault.json ../private
node tools/vault.mjs lock ../private data/vault.json
```

Keep the decrypted folder outside the repo so it is never committed.

When a new import changes statuses (for example from the Google Sheet), each browser applies it on its next visit: problems you never touched on the site take the sheet's values; problems you edited on the site keep your edits unless the sheet changed that problem in the import, in which case the sheet's status wins and its note is added below yours.

## Files

- `index.html`, `assets/style.css`, `assets/app.js`: the site (plain HTML/CSS/JS, no build step).
- `data/vault.json`: the encrypted sheet: every section and problem (titles, links, difficulty, ratings, tags, patterns, hints) plus the statuses, REVISE flags and notes imported from the workbooks.
- `tools/vault.mjs`: locks and unlocks `data/vault.json`.
