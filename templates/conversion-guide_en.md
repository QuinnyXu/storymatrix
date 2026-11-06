# Conversion guide: turning an existing workbook into the StoryDB template

> For authors, or for a tool (such as Claude) doing the conversion for an author. Every field is defined in [`field-reference_en.md`](field-reference_en.md), which is generated from `schema/storydb.schema.json`, so the two always agree.
> The examples below come from the made-up example novel *Starlight Inn* ([`example_starlight-inn.xlsx`](example_starlight-inn.xlsx)).
> When converting, **save to a new file**. Never overwrite the original workbook.

## 1. How the template works (like a small relational database)

| Sheet | One row is | Refers by ID to |
|---|---|---|
| Characters * | one character | — |
| Events * | one event (a point or a stretch on the timeline) | Character IDs → Characters; Location ID → Locations; Chapter ID → Chapters |
| Appearances | "what one person does in one event, and where" | Event ID, Character ID, Location ID |
| Whereabouts | where someone is over a period of time | Character ID, Location ID |
| Relationships | the relationship between two characters | Character A ID, Character B ID |
| Locations | one place (optionally inside a parent place) | Parent ID → Locations |
| Chapters / Scenes / Foreshadowing / Knowledge / Festivals / Settings | see the field reference | |

There are only a few rules:

1. The first column of every sheet is the ID (C01, T01, L01, CH01…). Once an ID is given, never change or reuse it. To retire a row, set its Status to `Dropped`; don't delete it.
2. Sheets and columns are matched by name. Column order doesn't matter, and you can add your own columns (the dashboard shows them as they are). Aliases work too, e.g. "Timeline" = "Events", "People" = "Characters", "Places" = "Locations", "Stays" = "Whereabouts", "Nickname" = "Short name".
3. Several IDs in one cell are separated by commas: `C01, C02`.
4. Dates can be written `2031-07-11` / `2031-07` / `2031` / `spring 2031` / `late March 2031` / `2031 Spring Festival` (looked up in the Festivals sheet) / `about 1850` / `722 BC`, or as an Excel date. If you only know the year, write only the year; don't invent an exact day. Add a Precision column (`day` / `month` / `season` / `year` / `circa`) when you need one.
5. If all you want to record is who was there, filling in Events → Character IDs is enough. Use the Appearances sheet when you want to record what each person did and where each of them was.

Check the result afterwards: `node tools/storydb.mjs check new-file.xlsx`, or drag the file into the dashboard and open the Checks page.

## 2. Workbooks that already use IDs and references: usually ready as they are

If your workbook already has an ID column on each sheet, and other sheets refer to rows by ID (say, a "Timeline" sheet with "Character IDs: C01, C02"), the dashboard can usually read it directly through aliases. **No conversion needed**, and no renaming of columns. Start by dragging the file into the dashboard and looking at Overview → How the workbook was read:

- Something like "Found 'Timeline', 9 columns recognised": that sheet has been matched to the template's Events sheet.
- "Other columns: Catchphrase, Character arc…": columns the template doesn't have. They are shown as they are in character profiles, event details and relationship tooltips.
- "Missing": the template has this sheet and your workbook doesn't. Optional sheets can be left out.

Then look at the Checks page. The most common finding is a mistyped ID (for example, a Chapter ID written as "Bonus" when that chapter's ID in the Chapters sheet is `EX01`); fix it as suggested. `[TBD]` or `TBD` written in an ID cell counts as "not decided yet", not as an error.

If you want nicer charts, these are optional (each one only adds columns or sheets and leaves your existing content alone):

| You want | Do this |
|---|---|
| Relationship map coloured by faction | Add a Group column to Characters (e.g. The Lins, The Zhous, Harbour Office); a "Faction" column is recognised too |
| Choose the main characters | Add a Main column to Characters with `Yes` / `No`; without it, the 8 characters with the most appearances are picked |
| One-way relationships (a crush, someone applying pressure) | Add Direction (`both` / `A→B`) and Strength (1–3) to Relationships |
| See where each person is on the timeline | Add a Location ID to events, or add an Appearances sheet with each person's location and action |
| Show a long stay as a coloured bar | Add a Whereabouts sheet, e.g. C02, 2031-03-01, 2031-05-31, L05 (Zhou Yu goes back to the City) |

## 3. "One column per character" wide tables: these need converting

Many authors start with a wide timeline like this: one row per moment in time, one column per character, and each cell says what that character is doing.

| Year | Month | Day | Time of day | Location (Lin Wan) | Lin Wan | Zhou Yu | Granny | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 2030 | 9 | 1 | | Starlight Inn | Wiping tables when she sees a soaked figure in the doorway | Pushes the door open and asks if there are any rooms left | | Locked | |
| 2031 | Spring Festival | | | Starlight Inn | New Year's Eve dinner | Makes dumplings for the first time | [The City] in hospital | Locked | |
| | | | Year TBD | | | | | Pending | Something from Granny's youth |

Converting means splitting it into long tables:

**Characters** (from your existing character sheet, or from the wide table's headers)

| New column | Comes from |
|---|---|
| Character ID | new numbers C01, C02… (in the original order) |
| Name | full name |
| Short name | the short name used in the wide table's header; this is what the timeline and charts show |
| Birth date | birth year-month-day; if the month and day are uncertain, write only the year |
| Everything else | copy species, identity, profile and notes across as they are; you can add Main and Group |

**Locations**: collect every place name that appears in the location columns, remove duplicates, and give each one an L number. Set the Parent ID of a small place to the larger place it sits in (Starlight Inn → Starlight Bay). Region can hold a coarse grouping such as `inside town` / `outside town`. Split combined entries like "Seafront / Starlight Bay" into two places and pick whichever one the event actually happens in.

**Events**: each row of the wide table → one event. (If you have several timeline sheets, you can give them different prefixes, e.g. prequel B01…, main story T01….)

| New column | Comes from |
|---|---|
| Date | year + month + day. When the month is a festival name, write `2031 Spring Festival`; when both month and day are blank, write only the year |
| Time note | time of day |
| Event | a one-line title (the original usually has none, so summarise; if unsure, use the first half of the POV character's cell and set Status to `Proposed`) |
| Location ID | where the row takes place |
| Category | e.g. prequel / main |
| Status | the original Status. To keep your own words such as Locked / Maybe / Pending, set "Status values" in Settings to `Locked, Maybe, Pending`, "Decided status" to `Locked`, and "Open markers" to `Maybe, Pending` |
| Notes | notes |
| Other columns | columns specific to this book (say, the winner of some contest) are copied across as a column of the same name; the template allows extra columns |

**Appearances**: each non-empty character cell → one row (Event ID, Character ID, Action = the cell's text). If a cell starts with `[Place]` (like Granny's "[The City] in hospital" above), put that place in Location ID and remove it from the action. If a character isn't at the event's location and no place is given, leave Location ID blank.

**Festivals**: if the original has a festival-dates table (Year | Spring Festival | Lantern Festival | …), you can keep it as it is; the dashboard reads that wide layout as well.

**Not needed**: age lookup tables, and date or age columns computed by formulas (the dashboard works these out itself).

Note: rules that apply only to one particular book (e.g. "magic only works on full-moon nights", "envoys may visit the capital once a year") are not part of the general checks. The general checks cover appearing before birth, appearing after death, being in two places on the same day, contradicting the Whereabouts sheet, a setup paid off before it is planted, and so on. You can add a book-specific check as a function written the same way as those in `src/std/checks.js`.

## 4. Asking Claude to do the conversion

> Following `templates/conversion-guide_en.md` and `templates/field-reference_en.md`, convert `<original workbook>` into the StoryDB template and save it as `<new file>.xlsx`. Don't change the original. Start from a copy of `templates/StoryDB_template_en.xlsx` (keep its headers, dropdowns and formula columns). Wherever you had to write an event title yourself, set its Status to `Proposed` so I can confirm it. When you're done, run `node tools/storydb.mjs check <new file>` and show me the result.
