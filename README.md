# StoryMatrix · 故事仪表盘

Turns a novel's story database (an Excel workbook in a standard template) into an interactive dashboard: a timeline of
each character's events and locations, character profiles, a relationship map, and automatic consistency checks.
Read-only: the tool never writes to the author's workbook. UI in 中文 / English.

把按标准模板填写的「故事数据库」Excel 变成交互式仪表盘：人物时间线（事件 + 地点）、人物档案、关系图、自动检查。只读，不会改你的工作簿。

## Start / 启动

Double-click **`start.bat`** (needs Python 3). It serves the `Creative Writing` folder on `127.0.0.1:8765` and opens the
dashboard. Pick a book from the list, click **打开文件… / Open file…**, or drag an `.xlsx` onto the window.
Keep editing in Excel; when you save, the dashboard re-reads the file within a few seconds.

双击 `start.bat`。在右上角选作品，或「打开文件…」，或把 .xlsx 拖进窗口。照常在 Excel 里改，保存后几秒内自动刷新。

## The template / 模板

| File | What |
|---|---|
| `templates/故事数据库模板.xlsx` | Blank template (Chinese headers). Copy it for a new book. 空白模板，新书复制一份开始填 |
| `templates/StoryDB_template_en.xlsx` | Same template with English headers |
| `templates/示例_星河旅店.xlsx` | A small filled-in example with a few deliberate conflicts 填好的示例（故意留了几处冲突） |
| `templates/字段说明.md` / `field-reference_en.md` | Every sheet and column, generated from the schema 每张表、每列的说明 |
| `templates/转换指南.md` | How to convert an existing workbook (ID-based or one-column-per-character) 现有工作簿怎么转换 |

Sheets: **人物** and **事件** are required; 出场, 行踪, 关系, 地点, 章节, 场景, 伏笔, 知情台账, 节日 and 设置 are optional.
Every sheet starts with an ID column, and other sheets refer to rows by ID (e.g. `涉及人物ID = C01、C02`). Columns are
matched by name or alias, so authors can reorder and add columns. In the template, headers have hover notes, ID
columns have dropdowns, and grey "(auto)" columns show the name for each ID.

`schema/storydb.schema.json` is the single source of truth: the template generator, the dashboard, the checks and the
field reference all read it. To add a column or an alias, edit the schema, then regenerate:

```
python tools/make_template.py --force                 # templates/故事数据库模板.xlsx
python tools/make_template.py --lang en --force       # templates/StoryDB_template_en.xlsx
python tools/make_template.py --data templates/示例_星河旅店.data.json --out templates/示例_星河旅店.xlsx --force
node tools/storydb.mjs fields > templates/字段说明.md
```

## Books / 作品列表

Copy `projects.example.json` to `projects.json` and list your books there (paths relative to this folder).
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
