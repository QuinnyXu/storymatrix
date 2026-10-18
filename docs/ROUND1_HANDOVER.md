# StoryMatrix · Round 1 handover

> Read this first when picking the project up again, whether you are the owner, a contributor or an AI coding agent.
> Round 1 ended on 2026-10-17. Each later round should add its own `docs/ROUNDn_HANDOVER.md` and leave this one as history.

## 1. What StoryMatrix is

A free, open-source tool for novelists, licensed GPL-3.0-or-later (changes that are shared must stay open). The author keeps the story's facts (characters, events, places,
relationships, chapters, setups, secrets) in an Excel workbook that follows a standard template. StoryMatrix reads it,
read-only, and shows:

- each character's timeline: what they do, where, at what age;
- a relationship map;
- automatic continuity checks: on stage after death, in two places on one day, payoff before setup, broken IDs…

**Why Excel:** authors already use it, the data stays theirs, there is nothing to install or log into, and both
humans and AI assistants can read and edit it. The dashboard never writes to the workbook.

## 2. State at the end of round 1

**Done and verified**

| Area | What exists | Where |
|---|---|---|
| Template | 12 sheets (人物 and 事件 required); every sheet has an ID column and other sheets refer to rows by ID; zh/en headers plus aliases | `schema/storydb.schema.json` |
| Template files | Blank zh and en workbooks with header notes, ID dropdowns and lookup formulas; a made-up example 《星河旅店》 with deliberate conflicts | `templates/`, built by `tools/make_template.py` |
| Docs for authors | Field reference (generated from the schema) and a conversion guide for existing workbooks | `templates/字段说明.md`, `field-reference_en.md`, `转换指南.md` |
| Loader | Matches sheets/columns by name or alias; reads loose dates (`2031 春`, `2031 春节`, `约 1850`, `前722`, Excel serials); resolves IDs; keeps unknown columns as "extra" | `src/std/load.js`, `src/std/dates.js` |
| Checks | Loader issues plus C01–C09 (see README) | `src/std/checks.js` |
| Dashboard | Overview, character timeline, narrative order × story time, profiles, relationship map, checks; zh/en; light/dark; phone width; drag-and-drop; auto-reload on save | `index.html`, `src/std/app.js`, `src/std/views/*` |
| Outputs | Check report (.md), character chronicles (.md), normalized data (.json), PNG charts; the same from the CLI | `src/std/export.js`, `tools/storydb.mjs` |
| Tests | 41 tests: date grammar, column matching, every check, exports, the generated example | `test/storydb.test.mjs` (`npm test`) |

Real use in round 1: two of the owner's private novels loaded through it. One was already ID-based and loaded through
aliases with no changes. The other was converted from a one-column-per-character timeline by following the conversion
guide. Their data is not in this repository and must never be (see §7).

**Known gaps and debt**

- **Data entry is manual.** This is the biggest barrier to adoption (§5, direction A).
- Checks are generic. Book-specific rules (for example "magic only works at full moon") need code in `checks.js`;
  there is no rule language yet.
- The relationship map has no history: a relationship is one row, and a change like "rivals → lovers" is only text in
  关系类型. The optional 开始日期/结束日期 plus the "as of" slider are a first step.
- 知情台账 (who knows what, when) is shown, but not yet checked against actions ("acts on a secret before learning it").
- 场景 is only used for co-appearance links.
- Large books are untested beyond about 50 events and 20 characters. The timeline may need clustering or virtualization
  past a few thousand marks.
- No UI tests. Browser behaviour was checked by hand with headless Chrome (see §4).
- Fixed palette: only 7 colours, then "Other"; a shape per colour is the second cue.
- Windows-first start script (`start.bat`). On macOS/Linux run `python3 serve.py`.

## 3. How it fits together

```
schema/storydb.schema.json         the single source of truth: sheets, columns, aliases, types, references, descriptions
        │
        ├─ tools/make_template.py  → templates/*.xlsx (styles, notes, dropdowns, formula columns)
        ├─ tools/storydb.mjs fields → templates/字段说明.md, field-reference_en.md
        └─ src/std/load.js         workbook → model { characters, events, apps, stays, … , byId, issues }
                 │
                 ├─ src/std/checks.js   model → findings { sev, code, sheet, row, chars, eventId, msg{zh,en} }
                 ├─ src/std/export.js   model + findings → Markdown / JSON
                 └─ src/std/views/*     model → ECharts options and HTML panels; app.js wires the UI
```

Key ideas in the model:
- **Appearance (`db.apps`)** = character × event. It comes from 出场 rows, plus bare rows from 事件.涉及人物ID. Each
  has a resolved location (`locId`) with its source: own (出场.地点ID) > event (事件.地点ID) > stay (a 行踪 row covering the date).
- **Date precision** widens a date into a span (`spanOf`), so checks don't fire on "2031 春" vs a birthday in April.
- **Status**: rows with the 作废 status (default 弃) are hidden, but references to them still resolve.
- **Main characters**: 设置.主要人物 > the 人物.主要人物 column > the top 8 by activity.

### Commands

```
start.bat  (or: python serve.py)          dashboard at 127.0.0.1:8765, or the next free port
npm test                                  41 tests
node tools/storydb.mjs check <xlsx|id>    findings; exit code 1 on errors
node tools/storydb.mjs report <xlsx|id>   writes out/<name>/ (git-ignored)
npm run templates                         rebuild the three template workbooks (needs: pip install openpyxl)
node tools/storydb.mjs fields > templates/字段说明.md   (and --lang en > templates/field-reference_en.md)
```

### Recipes

- **New column or alias:** edit the schema → `npm run templates` → regenerate the field docs → use the field in a view if needed.
  Unknown columns already show up as "extra" without any code.
- **New check:** add a function `(db) => findings[]` in `checks.js`, add it to `CHECKS`, give it the next code (C10…),
  add a test with a tiny in-memory workbook (see the `book()` helper in the test), and list it in the README.
- **New view:** add a module in `src/std/views/`, a tab in `index.html`, a render branch in `app.js`, and strings in `i18n.js`.
- **Colours:** categorical slots come from CSS tokens `--s1…--s8` (light and dark) in `std.css`. Colour follows the
  entity, ordered by frequency across the whole book, so filtering never repaints. Don't cycle hues past 7.

### Conventions

- Read-only towards author files, always. Reports go to `out/`, never into a book folder.
- Every UI string is in `i18n.js`, in zh and en. Every finding message is in zh and en.
- Match by header name, never by column position.
- No build step and no npm dependencies. Vendored libraries are in `vendor/`. Keep it double-click simple for authors.

### Browser checks without a UI test suite

Deep links help: `index.html?project=example&tab=timeline&event=T07&lang=en`, `?char=C02`, `?workbook=<path>`.
Round 1 used headless Chrome screenshots and the DevTools protocol to check layout at 390px. Note that headless Chrome
will not go narrower than about 500px without device emulation.

## 4. Round 2 candidates (small, high value)

1. **Example gallery:** two or three more made-up examples (historical with BC dates, fantasy with festivals, a large
   ensemble cast) to stress-test and to show what the tool can do.
2. **Knowledge check (C10):** a character's 出场.行动 or an event references a secret (by 秘密ID tag) before their
   知情台账 date.
3. **Relationship history:** let several rows of the same pair carry dates and draw them as phases; the "as of" slider
   then tells the story of a relationship.
4. **Search and filter by text** across events and actions.
5. **Print / PDF of a character chronicle** for editors.
6. **macOS/Linux start script** (`start.command` / `start.sh`).
7. **Lightweight UI smoke test** (headless Chrome over the DevTools protocol, no dependencies) run by `npm test`.

## 5. Longer-term directions

Kept from the round-1 product discussion. The project is open source with no commercial plan; these are directions
for impact, ordered by expected value.

**A. Extract instead of fill in (the big one).**
Authors won't maintain a database by hand. Add an extraction step: chapters (.docx/.md/.txt) → an LLM proposes rows
in this same schema, every proposed row marked 状态=议 with a pointer back to the chapter → the author accepts or edits
in Excel → the dashboard and checks work as today. The schema is already designed to be AI-readable and AI-writable.
Keep the extraction optional and bring-your-own-API-key, so the core stays free and local.

**B. Per-chapter continuity checks for serialized fiction.**
For web-novel (网文) authors who publish daily and keep hundreds of characters: before posting a chapter, extract it,
then run the checks against everything earlier. This is the most frequent, most visible pain this tool can address.

**C. AI co-writing context layer.**
Serve the story database to writing assistants: an MCP server or a plain JSON/Markdown export that an assistant reads
before drafting ("who knows what by chapter 12, where is everyone on 2031-04-10"). Assistants make fewer continuity
mistakes when they get structured context instead of a long story bible.

**D. Teams.**
Editors, adaptation teams (novel → drama or game) and game narrative teams. They need a shared, checkable character
bible. This means multi-user editing, which conflicts with "Excel stays the source of truth"; handle it with care
(for example, export/import, or a hosted option that remains optional).

**E. Rule language for book-specific constraints.**
A small declarative rule format in the 设置 sheet or a rules sheet, so authors can write rules like "species X
hibernates 11-15 to 03-15" or "nobody leaves location L before date D" without code. Round 0 had such rules hard-coded
for one book. That experience showed they matter a lot to authors with invented worlds.

**Ecosystem ideas:** import from Plottr / Campfire / Aeon Timeline exports; an Obsidian or VS Code view; a hosted
read-only demo on GitHub Pages using the example workbook.

## 6. Open questions for the owner

- Is the template schema "1.0 stable"? Renaming columns later breaks authors' workbooks. Prefer adding aliases over renaming.
- Should the English template be fully English, including enum values (状态 定/暂… and 参与方式 主导/参与/提及 are Chinese
  in both templates today)?
- For direction A, which LLM provider(s), and should extraction run locally (CLI) or in the browser?
- Name: StoryMatrix (current) or something like Storyloom.

## 7. Privacy rule (important)

The repository is public. Never commit a real manuscript, workbook, generated report or book list.
- `projects.json` (the author's book list) and `out/` (generated reports) are git-ignored. `projects.example.json` is the public template.
- Examples, tests and docs must use made-up stories only (like 星河旅店).
- Before pushing, scan for real character names, places and dates. Also check inside `.xlsx` files: they are zip files,
  so unzip and grep the XML.
- History was rewritten once in round 1 to remove early references. If it ever happens again, rewrite before others
  clone; GitHub may cache old commits for a while.
