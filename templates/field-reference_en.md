# StoryDB template · field reference (v1.0)

Standard story database template. The first column of each sheet is an ID; other sheets refer to it by ID (like a relational database). Sheets and columns are matched by name; you may add columns and reorder them. Columns whose header contains '(auto)' are formula helpers and are ignored by the dashboard.

Dates: Dates may be: 2031-07-11 · 11 March 2031 / March 11, 2031 · March 2031 · early / mid / late March 2031 · 2031 · spring 2031 (summer, autumn, fall, winter) · Christmas 2031 (any name listed in the Festivals sheet) · about 1850 / c. 1850 · 722 BC · or an Excel date.

Status values: Decided, Tentative, Proposed, Missing, Inferred, Dropped. Coded columns (Status, Precision, Part, Direction) also accept the codes used in the Chinese template.

Sheet and column names from the Chinese template are read the same way, so a workbook may mix both.

## Settings (optional)

Book-wide settings, one key/value per row. Blank means default.

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Key | text | ✓ |  |  |
| Value | text |  |  |  |
| Note | text |  |  |  |

| Key | Default | Notes |
|---|---|---|
| Title |  | Dashboard title |
| English title |  | Used in the English UI |
| Main characters |  | Character IDs separated by commas; blank = use the Main column, else the top 8 by appearances |
| Display from |  | Default timeline start, e.g. 2030 |
| Display to |  | Default timeline end |
| Reference date |  | Ages in character profiles are computed at this date |
| Decided status | Decided | Rows with this status that still contain open markers are flagged |
| Dropped status | Dropped | Rows with this status are hidden (references still resolve) |
| Open markers | [TBD], [?], TBD | Words that mark undecided text; in an ID cell, anything in […] means not decided yet |
| Status values | Decided, Tentative, Proposed, Missing, Inferred, Dropped | Allowed values of the Status column (coloured in this order) |

## Characters (required)

One row per character. Never change or reuse an ID.

Also recognised as: People

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Character ID | id | ✓ |  | ID, CharacterID |
| Name | text | ✓ |  |  |
| Short name | text |  | Label on charts; defaults to Name | Nickname |
| English name | text |  | Shown in the English UI |  |
| Role | text |  | Protagonist, mentor, antagonist… |  |
| Main | bool |  | Yes = shown by default on the timeline and map · Yes / No |  |
| Group | text |  | Colours the relationship map: family, faction, school… | Faction |
| Gender | text |  |  |  |
| Species | text |  |  |  |
| Birth date | date |  | Used for ages |  |
| Death date | date |  |  |  |
| Identity | text |  |  |  |
| First chapter | ref → Chapters |  |  |  |
| Profile | text |  |  |  |
| Status | status |  | Decided / Tentative / Proposed / Missing / Inferred / Dropped |  |
| Notes | text |  |  |  |

## Relationships (optional)

One pair per row; drawn as the relationship map.

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Relationship ID | id | ✓ |  | ID |
| Character A ID | ref → Characters | ✓ |  |  |
| Character A (auto) | formula (auto) |  |  |  |
| Character B ID | ref → Characters | ✓ |  |  |
| Character B (auto) | formula (auto) |  |  |  |
| Type | text | ✓ | Parent, lover, mentor, rival; changes as rivals→lovers |  |
| Direction | enum |  | both (default) or A→B = one-way (crush, follower) · both / A→B |  |
| Strength | int |  | 1–3, line thickness · 1 / 2 / 3 |  |
| Start date | date |  |  |  |
| End date | date |  |  |  |
| First chapter | ref → Chapters |  |  |  |
| Status | status |  | Decided / Tentative / Proposed / Missing / Inferred / Dropped |  |
| Notes | text |  |  |  |

## Locations (optional)

One place per row. Parent ID builds a hierarchy (dorm ⊂ campus ⊂ city).

Also recognised as: Places

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Location ID | id | ✓ |  | ID |
| Name | text | ✓ |  |  |
| Type | text |  | The timeline can colour by type |  |
| Parent ID | ref → Locations |  |  |  |
| Parent (auto) | formula (auto) |  |  |  |
| Region | text |  | Coarser group, e.g. inside / outside town |  |
| Description | text |  |  |  |
| First chapter | ref → Chapters |  |  |  |
| Status | status |  | Decided / Tentative / Proposed / Missing / Inferred / Dropped |  |
| Notes | text |  |  |  |

## Events (required)

One event per row (the timeline). Characters lists who is involved; use the Appearances sheet for what each one does and where.

Also recognised as: Timeline

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Event ID | id | ✓ |  | ID |
| Date | date |  | Blank = undated |  |
| Precision | enum |  | day / month / season / year / circa; inferred from how the date is written when blank |  |
| End date | date |  | For events that last a while |  |
| Time note | text |  | Free text, e.g. 'spring to autumn' |  |
| Event | text | ✓ |  | Title |
| Character IDs | refs → Characters |  | Several separated by commas: C01, C02 |  |
| Location ID | refs → Locations |  | Where it happens; first one is primary |  |
| Location (auto) | formula (auto) |  |  |  |
| Chapter ID | ref → Chapters |  |  |  |
| Category | text |  | Main, flashback, backstory, off-page… |  |
| Status | status |  | Decided / Tentative / Proposed / Missing / Inferred / Dropped |  |
| Notes | text |  |  |  |

## Appearances (optional)

Event × character: what one character does in one event, and where. Fill Location ID only when it differs from the event's.

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Event ID | ref → Events | ✓ |  |  |
| Event (auto) | formula (auto) |  |  |  |
| Character ID | ref → Characters | ✓ |  |  |
| Character (auto) | formula (auto) |  |  |  |
| Action | text |  |  |  |
| Location ID | ref → Locations |  | Blank = the event's location |  |
| Location (auto) | formula (auto) |  |  |  |
| Part | enum |  | lead / present / mentioned; mentioned = talked about, not present |  |
| Notes | text |  |  |  |

## Whereabouts (optional)

Where someone is over a period (trip, study abroad). Drawn as a bar on the timeline.

Also recognised as: Stays

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Character ID | ref → Characters | ✓ |  |  |
| Character (auto) | formula (auto) |  |  |  |
| Start date | date | ✓ |  |  |
| End date | date |  | Blank = same day |  |
| Location ID | ref → Locations | ✓ |  |  |
| Location (auto) | formula (auto) |  |  |  |
| Status | status |  | Decided / Tentative / Proposed / Missing / Inferred / Dropped |  |
| Notes | text |  |  |  |

## Chapters (optional)

One chapter per row. Order sets the narrative order.

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Chapter ID | id | ✓ |  | ID |
| Order | number |  |  |  |
| Title | text |  |  |  |
| Part | text |  |  |  |
| Story time | text |  |  |  |
| POV | refs → Characters |  | Character ID or name; several separated by / |  |
| Summary | text |  |  |  |
| Words | number |  |  |  |
| Status | text |  | Outline / draft / revising / final |  |
| File | text |  |  |  |

## Scenes (optional)

Scenes within chapters. Their cast also counts toward co-appearance links.

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Scene ID | id | ✓ |  | ID |
| Chapter ID | ref → Chapters |  |  |  |
| Order | number |  |  |  |
| Location ID | ref → Locations |  |  |  |
| Character IDs | refs → Characters |  |  |  |
| Event ID | ref → Events |  |  |  |
| Summary | text |  |  |  |
| Status | text |  |  |  |

## Foreshadowing (optional)

Where each setup is planted and paid off.

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Setup ID | id | ✓ |  | ID |
| Content | text | ✓ |  |  |
| Planted in | ref → Chapters |  |  |  |
| Planned payoff | text |  |  |  |
| Paid off in | ref → Chapters |  |  |  |
| Notes | text |  |  |  |

## Knowledge (optional)

Who learns what, when. One row per knower; the same secret keeps the same ID.

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Secret ID | id | ✓ |  | ID |
| Secret | text |  |  |  |
| Knower ID | ref → Characters | ✓ |  |  |
| Knower (auto) | formula (auto) |  |  |  |
| Learned on | date |  | Date or text; text is not checked |  |
| How | text |  |  |  |
| Status | status |  | Decided / Tentative / Proposed / Missing / Inferred / Dropped |  |

## Festivals (optional)

Lets dates be written as 'Christmas 2031' or '2031 Spring Festival'. Each row: year, festival name, calendar date.

| Column | Type | Req. | Notes | Also accepted |
|---|---|---|---|---|
| Year | int | ✓ |  |  |
| Name | text | ✓ |  |  |
| Date | date | ✓ |  |  |
