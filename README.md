# Study Plan

A static web app for planning children's study sessions and example papers up
to a deadline. There is no server: the site runs entirely in the browser,
keeps its data in a Google Sheets spreadsheet in your own Google account, and
mirrors the plan to a Google Calendar per child.

- **Plan** — drag unplanned sessions and papers onto a month calendar, mark
  days as unavailable, or let _Auto-schedule_ spread everything out before
  the final date.
- **Items** — a filterable table of every session and paper, with quick
  entry of a whole book's contents ("Add several").
- **Settings** — children, their final date, daily limit and unavailable
  days, plus the Google connection.

The landing page also has a demo with sample data that never touches Google.

## Rules

Rule breaks are shown as warnings (red outline and a _Problems_ list); they
never stop you from making a change. Auto-schedule never creates one.

- Everything should be dated on or before the child's **final date**.
- Nothing should be planned on an **unavailable day** (a recurring weekday or
  a specific date).
- No more than the child's **max items per day**.
- An **example paper** must come after every study session of the same
  subject.

## Google setup

Each person uses their own Google OAuth client ID, pasted into the landing
page and stored only in that browser. It is not a secret. The same steps are
shown in the app.

1. In the [Google Cloud console](https://console.cloud.google.com/), create a
   project.
2. Under _APIs & Services → Library_, enable the **Google Sheets API**,
   **Google Drive API** and **Google Calendar API**.
3. Under _Google Auth Platform_ (the OAuth consent screen), choose
   **External**, fill in the app name and your email, and add your own Google
   account under _Audience → Test users_. Leave the app in "Testing".
4. Under _Clients_, create an OAuth client of type **Web application** and
   add the site's origin under _Authorised JavaScript origins_ (for example
   `https://study-plan.viboko.dev`, plus `http://localhost:5173` for local
   development).
5. Paste the client ID into the site and choose _Connect to Google_.

The first time, Google warns that the app isn't verified; choose _Continue_.
The site asks for two narrow permissions:

- `drive.file` — only files the app itself creates (one spreadsheet named
  "Study Plan").
- `calendar.app.created` — only calendars the app itself creates (one per
  child, named "Study Plan – _name_").

A static site cannot keep a long-lived Google session, so about once an hour
the header shows _Reconnect to Google_. Changes made in the meantime are
queued and saved once you reconnect.

## The spreadsheet

The spreadsheet is the source of truth and can be edited by hand; the app
reloads it when the tab regains focus or on _Refresh_.

`Children` sheet, one row per child:

| Name  | FinalDate  | MaxPerDay | UnavailableWeekdays | UnavailableDates                   | CalendarId         |
| ----- | ---------- | --------- | ------------------- | ---------------------------------- | ------------------ |
| Alice | 2027-09-12 | 1         | Tue, Sat            | 2026-12-24..2026-12-31; 2027-02-15 | _(set by the app)_ |

One sheet per child, named after the child, one row per session or paper:

| ID       | Type    | Book                   | Subject | Category | Title           | Minutes | Date       | Completed | CalendarEventId    |
| -------- | ------- | ---------------------- | ------- | -------- | --------------- | ------- | ---------- | --------- | ------------------ |
| k3x9a2bq | Session | Bond 11+ English 10-11 | English | Grammar  | Parts of Speech |         | 2026-10-14 | FALSE     | _(set by the app)_ |
| p81mzz0c | Paper   | Bond 11+ Maths Papers  | Maths   |          | Paper 1         | 50      |            | FALSE     |                    |

- `Type` is `Session` or `Paper`. `Date` is blank until the item is planned.
- Rows typed in by hand can leave `ID` blank; the app fills it in.
- To add a child by hand, add a row to `Children`; the app creates their
  sheet. Sheets not listed in `Children` are ignored.
- After editing dates by hand, use _Settings → Resync calendar_ to bring the
  calendars back in line.

## Development

Requires Node 24 and [just](https://github.com/casey/just).

```bash
just install   # npm ci
just dev       # dev server
just test      # unit tests
just lint      # eslint, prettier, markdownlint, stylelint, html-validate
just ci        # everything CI runs
```

The code is split into pure planning logic (`src/domain`), storage
(`src/storage`, with a Google Sheets store and an in-memory demo store behind
one interface), thin Google REST wrappers (`src/google`) and the React UI
(`src/views`, `src/components`). Tests run the Sheets store against an
in-memory fake of the Google APIs (`tests/fakeGoogle.ts`).

Pushes to `main` that pass CI are deployed to GitHub Pages by
`.github/workflows/deploy.yml` (Pages source must be set to "GitHub Actions").
