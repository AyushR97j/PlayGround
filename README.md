# DSA Prep Sheet

One sheet for OA preparation, hosted at **https://ayushr97j.github.io/PlayGround/**

| Section | Problems | Source |
|---|---|---|
| Striver A2Z | 495 (452 problems + 43 lessons) | [takeUforward A2Z sheet](https://takeuforward.org/prep-hub/strivers-a2z-dsa-sheet) |
| DSA Master Set | 414 | `DSA_Master_Problem_Set.xlsx` |
| Google Hard | 510 (your 312 from Sheet2 + 198 more) | Sheet2 of `problem_tracker.xlsx`, [visor-leetcode](https://hitarth-gg.github.io/visor-leetcode/company/245) data |
| Apple Hard | 52 | Sheet2 of `problem_tracker.xlsx` |
| Claude 109 | 59 targeted + 50 breadth | `OA_Practice_Tracker` (parts 1 and 2) |
| Company OA | 31 (C1 + C2) | `OA_Practice_Tracker` (11 Oct set) |

1,278 unique problems in total. A problem that appears in several sections has one status, one star and one set of notes, so solving it once marks it everywhere.

## Using it

- **Mark a problem**: click the circle to mark it solved (D). The arrow next to it sets *Solved with help* (D/ND) or *Attempted* (ND). Progress percentages count D and D/ND.
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

To change the passphrase or update the data, decrypt, edit, and lock again (Node 18+):

```bash
node tools/vault.mjs unlock data/vault.json ../private
node tools/vault.mjs lock ../private data/vault.json
```

Keep the decrypted folder outside the repo so it is never committed.

## Files

- `index.html`, `assets/style.css`, `assets/app.js`: the site (plain HTML/CSS/JS, no build step).
- `data/vault.json`: the encrypted sheet: every section and problem (titles, links, difficulty, ratings, tags, patterns, hints) plus the statuses, REVISE flags and notes imported from the workbooks.
- `tools/vault.mjs`: locks and unlocks `data/vault.json`.
