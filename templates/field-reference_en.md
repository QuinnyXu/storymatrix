# StoryDB template · field reference (v1.0)

Standard story database template. The first column of each sheet is an ID; other sheets refer to it by ID (like a relational database). Sheets and columns are matched by name; you may add columns and reorder them. Columns whose header contains '(auto)' are formula helpers and are ignored by the dashboard.

Dates: Dates may be: 2031-07-11 · 2031-07 · 2031 · 2031 spring/summer/autumn/winter (春/夏/秋/冬) · 2031 春节 (looked up in the Festivals sheet) · 约 1850 (circa) · or an Excel date.

Status values: 定 = Decided · 暂 = Tentative · 议 = Proposed · 缺 = Missing · 推 = Inferred · 弃 = Dropped

## 设置 / Settings (optional)

Book-wide settings, one key/value per row. Blank means default.

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 项目 | Key | text | ✓ |  | 设置项 |
| 值 | Value | text |  |  |  |
| 说明 | Note | text |  |  | 备注 |

| Key | Default | Notes |
|---|---|---|
| 书名 (Title) |  | Dashboard title |
| 英文书名 (English title) |  | Used in the English UI |
| 主要人物 (Main characters) |  | Character IDs separated by commas; blank = use the Main column, else the top 8 by appearances |
| 显示起始 (Display from) |  | Default timeline start, e.g. 2030 |
| 显示结束 (Display to) |  | Default timeline end |
| 参照日期 (Reference date) |  | Ages in character profiles are computed at this date |
| 已定状态 (Decided status) | 定 | Rows with this status that still contain open markers are flagged |
| 作废状态 (Dropped status) | 弃 | Rows with this status are hidden (references still resolve) |
| 未定标记 (Open markers) | 【缺】、【议】、【暂】、待定 | Words that mark undecided text |
| 状态取值 (Status values) | 定、暂、议、缺、推、弃 | Allowed values of the Status column (coloured in this order) |

## 人物 / Characters (required)

One row per character. Never change or reuse an ID.

Also recognised as: 角色、People

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 人物ID | Character ID | id | ✓ |  | ID、CharacterID |
| 姓名 | Name | text | ✓ |  | 名称、人物 |
| 简称 | Short name | text |  | Label on charts; defaults to Name | 小名、昵称、Nickname |
| 英文名 | English name | text |  | Shown in the English UI |  |
| 定位 | Role | text |  | Protagonist, mentor, antagonist… | 角色定位 |
| 主要人物 | Main | bool |  | Yes = shown by default on the timeline and map · 是 / 否 | 主角、重要 |
| 分组 | Group | text |  | Colours the relationship map: family, faction, school… | 阵营、家族、所属机构、Faction |
| 性别 | Gender | text |  |  |  |
| 物种 | Species | text |  |  |  |
| 出生日期 | Birth date | date |  | Used for ages | 生日、出生 |
| 去世日期 | Death date | date |  |  | 死亡日期 |
| 身份 | Identity | text |  |  |  |
| 首次出场章 | First chapter | ref → 章节 |  |  |  |
| 简介 | Profile | text |  |  | 性格与设定、性格与习惯、人物简介 |
| 状态 | Status | status |  |  | 层标 |
| 备注 | Notes | text |  |  |  |

## 关系 / Relationships (optional)

One pair per row; drawn as the relationship map.

Also recognised as: 人物关系

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 关系ID | Relationship ID | id | ✓ |  | ID |
| 人物A_ID | Character A ID | ref → 人物 | ✓ |  | 人物AID、人物A ID |
| 人物A（自动） | Character A (auto) | formula (auto) |  |  |  |
| 人物B_ID | Character B ID | ref → 人物 | ✓ |  | 人物BID、人物B ID |
| 人物B（自动） | Character B (auto) | formula (auto) |  |  |  |
| 关系类型 | Type | text | ✓ | Parent, lover, mentor, rival; changes as rivals→lovers | 关系 |
| 方向 | Direction | enum |  | A→B = one-way (crush, follower) · 双向 / A→B |  |
| 强度 | Strength | int |  | 1–3, line thickness · 1 / 2 / 3 | 重要度 |
| 开始日期 | Start date | date |  |  |  |
| 结束日期 | End date | date |  |  |  |
| 首次交集章 | First chapter | ref → 章节 |  |  | 章节ID |
| 状态 | Status | status |  |  | 层标 |
| 备注 | Notes | text |  |  |  |

## 地点 / Locations (optional)

One place per row. Parent ID builds a hierarchy (dorm ⊂ campus ⊂ city).

Also recognised as: 场所、Places

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 地点ID | Location ID | id | ✓ |  | ID |
| 名称 | Name | text | ✓ |  | 地点 |
| 类型 | Type | text |  | The timeline can colour by type |  |
| 上级地点ID | Parent ID | ref → 地点 |  |  |  |
| 上级地点（自动） | Parent (auto) | formula (auto) |  |  |  |
| 区域 | Region | text |  | Coarser group, e.g. inside / outside town | 分区 |
| 描述 | Description | text |  |  |  |
| 首次出现章 | First chapter | ref → 章节 |  |  |  |
| 状态 | Status | status |  |  | 层标 |
| 备注 | Notes | text |  |  |  |

## 事件 / Events (required)

One event per row (the timeline). Characters lists who is involved; use the Appearances sheet for what each one does and where.

Also recognised as: 时间线、Timeline

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 事件ID | Event ID | id | ✓ |  | ID |
| 日期 | Date | date |  | Blank = undated | 开始日期 |
| 精度 | Precision | enum |  | How exact the date is; inferred when blank · 日 / 月 / 季 / 年 / 约 |  |
| 结束日期 | End date | date |  | For events that last a while |  |
| 时间说明 | Time note | text |  | Free text, e.g. 'spring to autumn' | 时段 |
| 事件 | Event | text | ✓ |  | 标题、事件名称、Title |
| 涉及人物ID | Character IDs | refs → 人物 |  | Several separated by 、 or commas | 人物ID、出场人物ID |
| 地点ID | Location ID | refs → 地点 |  | Where it happens; first one is primary |  |
| 地点（自动） | Location (auto) | formula (auto) |  |  |  |
| 章节ID | Chapter ID | ref → 章节 |  |  | 章ID |
| 类别 | Category | text |  | Main, flashback, backstory, off-page… | 类型 |
| 状态 | Status | status |  |  | 层标 |
| 备注 | Notes | text |  |  | 备注 / 待定问题 |

## 出场 / Appearances (optional)

Event × character: what one character does in one event, and where. Fill Location ID only when it differs from the event's.

Also recognised as: 人物事件、参与

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 事件ID | Event ID | ref → 事件 | ✓ |  |  |
| 事件（自动） | Event (auto) | formula (auto) |  |  |  |
| 人物ID | Character ID | ref → 人物 | ✓ |  |  |
| 人物（自动） | Character (auto) | formula (auto) |  |  |  |
| 行动 | Action | text |  |  | 做什么、描述、内容 |
| 地点ID | Location ID | ref → 地点 |  | Blank = the event's location |  |
| 地点（自动） | Location (auto) | formula (auto) |  |  |  |
| 参与方式 | Part | enum |  | Mentioned = talked about, not present · 主导 / 参与 / 提及 | 角色 |
| 备注 | Notes | text |  |  |  |

## 行踪 / Whereabouts (optional)

Where someone is over a period (trip, study abroad). Drawn as a bar on the timeline.

Also recognised as: 行程、Stays

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 人物ID | Character ID | ref → 人物 | ✓ |  |  |
| 人物（自动） | Character (auto) | formula (auto) |  |  |  |
| 开始日期 | Start date | date | ✓ |  |  |
| 结束日期 | End date | date |  | Blank = same day |  |
| 地点ID | Location ID | ref → 地点 | ✓ |  |  |
| 地点（自动） | Location (auto) | formula (auto) |  |  |  |
| 状态 | Status | status |  |  | 层标 |
| 备注 | Notes | text |  |  |  |

## 章节 / Chapters (optional)

One chapter per row. Order sets the narrative order.

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 章ID | Chapter ID | id | ✓ |  | 章节ID、ID |
| 章序 | Order | number |  |  | 序号 |
| 标题 | Title | text |  |  | 章名 |
| 部 | Part | text |  |  | 卷 |
| 故事内时间 | Story time | text |  |  |  |
| 主视角 | POV | refs → 人物 |  | Character ID or name; several separated by / | 视角 |
| 梗概 | Summary | text |  |  | 一句话梗概 |
| 字数 | Words | number |  |  |  |
| 状态 | Status | text |  | Outline / draft / revising / final |  |
| 文件 | File | text |  |  |  |

## 场景 / Scenes (optional)

Scenes within chapters. Their cast also counts toward co-appearance links.

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 场景ID | Scene ID | id | ✓ |  | ID |
| 章ID | Chapter ID | ref → 章节 |  |  | 章节ID |
| 序 | Order | number |  |  |  |
| 地点ID | Location ID | ref → 地点 |  |  |  |
| 出场人物ID | Character IDs | refs → 人物 |  |  | 涉及人物ID |
| 事件ID | Event ID | ref → 事件 |  |  |  |
| 梗概 | Summary | text |  |  |  |
| 状态 | Status | text |  |  |  |

## 伏笔 / Foreshadowing (optional)

Where each setup is planted and paid off.

Also recognised as: 伏笔台账

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 伏笔ID | Setup ID | id | ✓ |  | ID |
| 内容 | Content | text | ✓ |  |  |
| 埋设章 | Planted in | ref → 章节 |  |  |  |
| 预定回收 | Planned payoff | text |  |  |  |
| 实际回收章 | Paid off in | ref → 章节 |  |  | 回收章 |
| 备注 | Notes | text |  |  |  |

## 知情台账 / Knowledge (optional)

Who learns what, when. One row per knower; the same secret keeps the same ID.

Also recognised as: 知情、秘密

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 秘密ID | Secret ID | id | ✓ |  | ID |
| 秘密 | Secret | text |  |  |  |
| 知情人ID | Knower ID | ref → 人物 | ✓ |  | 人物ID |
| 知情人（自动） | Knower (auto) | formula (auto) |  |  |  |
| 何时得知 | Learned on | date |  | Date or text; text is not checked |  |
| 如何得知 | How | text |  |  |  |
| 状态 | Status | status |  |  | 层标 |

## 节日 / Festivals (optional)

Lets dates be written as '2031 春节'. Each row: year, festival name, calendar date.

Also recognised as: 节日日期、历法

| Column | English | Type | Req. | Notes | Aliases |
|---|---|---|---|---|---|
| 年 | Year | int | ✓ |  | 公历年 |
| 名称 | Name | text | ✓ |  | 节日 |
| 日期 | Date | date | ✓ |  |  |
