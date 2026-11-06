# StoryMatrix · 故事仪表盘

Turns a novel's story database (an Excel workbook in a standard template) into an interactive dashboard: a timeline of
each character's events and locations, character profiles, a relationship map, and automatic consistency checks.
Read-only: the tool never writes to the author's workbook. UI in 中文 / English.

把按标准模板填写的「故事数据库」Excel 变成交互式仪表盘：人物时间线（事件 + 地点）、人物档案、关系图、自动检查。只读，不会改你的工作簿。

## Quick start for writers (English)

Everything runs on your own computer. Nothing is uploaded, and the tool never changes your workbook.

1. **Get it.** On GitHub, click **Code → Download ZIP** and unzip it anywhere (or `git clone` it).
2. **Install Python 3** if you don't have it: [python.org/downloads](https://www.python.org/downloads/). On Windows,
   tick "Add Python to PATH" in the installer.
3. **Start it.** Windows: double-click **`start.bat`**. Mac: double-click **`start.command`** (the first time, right-click
   it and choose **Open**; if macOS still refuses, open Terminal in the folder and run `python3 serve.py`).
   A browser tab opens at `http://127.0.0.1:8765/…`. Keep the small black window open while you use the dashboard.
4. **Look at the example.** Pick **Example: Starlight Inn**. It is a tiny made-up story with a few deliberate
   mistakes, so the **Checks** tab has something to show.
5. **Start your own book.** Copy `templates/StoryDB_template_en.xlsx`, rename it, and fill in **Characters** and
   **Events** (the other sheets are optional). Hover a column header in Excel to see how to fill it.
   Then click **Open file…** or drag the workbook onto the dashboard. In Chrome or Edge, the dashboard re-reads the
   file a few seconds after you save it in Excel. In Safari or Firefox, click **Reload**, or list the book in
   `projects.json` (see "Books" below).

Handy to know:
- Status words: **Decided, Tentative, Proposed, Missing, Inferred, Dropped**. Never delete a row; set it to Dropped.
- Not sure yet? Write **[TBD]** in the text, or even in an ID cell. It is treated as "to be decided", not as an error.
- Dates can be loose: `2031-07-11`, `11 March 2031`, `late March 2031`, `spring 2031`, `about 1850`, `1850s`, `722 BC`.
- Several IDs in one cell: `C01, C02`. In Appearances, Part = **lead / present / mentioned** (mentioned = talked
  about but not there, so a dead character can be mentioned without an error).
- Docs: [field reference](templates/field-reference_en.md) (every sheet and column) and
  [conversion guide](templates/conversion-guide_en.md) (if you already keep your story in a spreadsheet).
- The UI follows your browser's language; the **中文 / EN** button switches it.

## Start / 启动

Double-click **`start.bat`** (Windows) or **`start.command`** (Mac/Linux); needs Python 3. It serves the folder that
contains this dashboard folder on `127.0.0.1:8765` (or the next free port) and opens the dashboard. Pick a book from
the list, click **打开文件… / Open file…**, or drag an `.xlsx` onto the window. Keep editing in Excel; when you save,
the dashboard re-reads the file within a few seconds.

双击 `start.bat`（Mac 用 `start.command`）。在右上角选作品，或「打开文件…」，或把 .xlsx 拖进窗口。照常在 Excel 里改，保存后几秒内自动刷新。

## The template / 模板

| File | What |
|---|---|
| `templates/故事数据库模板.xlsx` | Blank template (Chinese headers). Copy it for a new book. 空白模板，新书复制一份开始填 |
| `templates/StoryDB_template_en.xlsx` | Same template with English headers |
| `templates/example_starlight-inn.xlsx` | A small filled-in example in English, with a few deliberate conflicts |
| `templates/示例_星河旅店.xlsx` | The same example in Chinese 填好的示例（故意留了几处冲突） |
| `templates/field-reference_en.md` / `字段说明.md` | Every sheet and column, generated from the schema 每张表、每列的说明 |
| `templates/conversion-guide_en.md` / `转换指南.md` | How to convert an existing workbook (ID-based or one-column-per-character) 现有工作簿怎么转换 |

Sheets: **人物** and **事件** are required; 出场, 行踪, 关系, 地点, 章节, 场景, 伏笔, 知情台账, 节日 and 设置 are optional.
Every sheet starts with an ID column, and other sheets refer to rows by ID (e.g. `涉及人物ID = C01、C02`). Columns are
matched by name or alias, so authors can reorder and add columns. In the template, headers have hover notes, ID
columns have dropdowns, and grey "(auto)" columns show the name for each ID.

Coded values (status, date precision, participation, direction, yes/no) are stored as the codes in
`schema.conventions.vocab` (定, 日, 提及…), and the English words listed there (Decided, day, mentioned…) are accepted
too, in any case. The English template's dropdowns use the English words. Both templates read the same way, and a
workbook may mix Chinese and English headers and values. 状态等取值中英文都认。

`schema/storydb.schema.json` is the single source of truth: the template generator, the dashboard, the checks and the
field reference all read it. To add a column or an alias, edit the schema, then regenerate:

```
python tools/make_template.py --force                 # templates/故事数据库模板.xlsx
python tools/make_template.py --lang en --force       # templates/StoryDB_template_en.xlsx
python tools/make_template.py --data templates/示例_星河旅店.data.json --out templates/示例_星河旅店.xlsx --force
python tools/make_template.py --lang en --data templates/example_starlight-inn.data.json --out templates/example_starlight-inn.xlsx --force
npm run fields                                        # templates/字段说明.md and field-reference_en.md
```

(`npm run templates` runs all four template builds; it needs `pip install openpyxl`.)

## Books / 作品列表

Copy `projects.example.json` to `projects.json` and list your books there (paths relative to this folder). The local
server only serves the folder that contains the dashboard folder, so keep your books next to it, for example
`Writing/storymatrix/` and `Writing/my-novel/book.xlsx` with the path `../my-novel/book.xlsx`. Use **Open file…** for
a workbook anywhere else.
`projects.json` is git-ignored, so your book list stays private. Optional `settings` override the workbook's 设置
sheet. An entry with `link` opens another page instead of a workbook. Without a `projects.json`, the picker shows the
example.

## Views / 视图

- **概览 Overview**: counts, story span, decided %, undated events, open setups, and *how the workbook was read*
  (which sheets and columns were recognised, which extra columns were kept).
- **人物时间线 Timeline**: one lane per character; each mark is an event they are in, coloured by location, location
  type, region, event category or status (with a matching shape). Hollow = only mentioned; bars = 行踪 stays; red/yellow
  ring = a check finding. Click a mark to see everyone in that event, with their action, location and age.
  Below it: **叙事顺序 × 故事时间** (chapter order against story date; spread-out rows mean flashbacks).
- **人物档案 Characters**: profile, chronicle (date · age · location · event · action · chapter), relationships,
  secrets known, findings.
- **关系图 Relationships**: force-directed map; node size = number of appearances, colour = 分组; arrows for one-way
  relationships, dashed for undecided ones; optional co-appearance links; an "as of" slider when relationships have dates.
- **检查 Checks**: findings grouped by severity; click one to jump to it.

Export menu: check report (.md), character chronicles (.md), normalized data (.json), timeline / relationship map (.png).

## Checks / 检查

Loader: missing sheet/column, duplicate ID, broken reference (with a "did you mean" hint), unreadable date, empty
required cell. `【缺】` or `待定` in an ID cell counts as "not decided yet", not as a broken reference.

| Code | Check | Severity |
|---|---|---|
| C01 | On stage before birth / after death (respecting date precision; 提及 is fine); learns a secret before birth | error |
| C02 | Same character in two places on the same day (nested places such as dorm ⊂ campus are fine) | warning |
| C03 | Appearance contradicts a 行踪 stay; overlapping stays at different places | warning |
| C04 | End date before start date | error |
| C05 | Row marked decided (定) still contains open markers (【缺】【议】待定…) | info |
| C06 | Foreshadowing paid off in an earlier chapter than it is planted | error |
| C07 | Relationship with oneself, or the same pair and type twice | warning |
| C08 | A main character (chosen by the author) has no events | info |
| C09 | Events with neither a date nor a time note | info |

Each check is one small function in `src/std/checks.js`. Add a function and list it in `CHECKS`.

## Command line (for Claude or scripts) / 命令行

```
node tools/storydb.mjs check  example                  # a project id or a path to any .xlsx; exit code 1 on errors
node tools/storydb.mjs report example [--lang en] [--out DIR]
```

`report` writes 检查报告.md, 人物年表.md and 故事数据.json to `out/<book>/` here, never into the book's folder.

## Layout

- `schema/storydb.schema.json` template definition · `src/std/load.js` workbook → model · `src/std/dates.js` date grammar
- `src/std/checks.js` checks · `src/std/export.js` reports · `src/std/views/*` charts and panels · `src/std/app.js` wiring
- `tools/make_template.py` builds templates · `tools/storydb.mjs` CLI · `test/storydb.test.mjs` tests (`npm test`)
- `vendor/` SheetJS and ECharts (offline copies)

## Contributing and roadmap / 参与与路线图

StoryMatrix is free and open source under the [GNU GPL v3](LICENSE) (or any later version): you may use, change and share it, and if you share a changed version you must share its source under the same license. Third-party notes are in [NOTICE](NOTICE). Start with
[docs/ROUND1_HANDOVER.md](docs/ROUND1_HANDOVER.md): the current state, how the code fits together, recipes for adding
columns, checks and views, the next candidates, and longer-term directions. Please use made-up stories only in
examples, tests and issues - never real manuscripts.
