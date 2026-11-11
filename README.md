# POKER STATS LAB v0.2

Black and gold, iPhone-friendly offline PWA for tournament results. No dependencies, no analytics, no credentials or personal records in the repository.

## Use

Open GitHub Pages and optionally add to the iPhone Home Screen. Records stay in that browser/device's localStorage. Export JSON regularly: browser data removal or OS eviction can remove local records. Safari and installed PWA may use separate storage.

Input date, venue, field size, finish and tournament. Exact duplicate records are rejected. Edit retains IDs; deletion asks for confirmation. Lifetime/monthly statistics use arithmetic mean finish and top-three finish rate (finish ≤3, regardless of field size).

## Restore / sheet migration

Data management accepts schemaVersion 1 JSON with records. Import previews counts and merges without replacing records. Stable IDs make imports idempotent; a conflicting reused ID is rejected. Same date/venue/event/field/finish is treated as duplicate. Different events on one day should have distinct tournament names.

Each record: `{ "id":"stable-id", "date":"2026-11-07", "venue":"Venue", "event":"Tournament", "players":7, "rank":2 }`. Month-only `YYYY-MM` dates are supported for legacy records; no day is invented. Editing a month-only record without choosing a date retains its precision. JSON export preserves IDs and date precision.

The user's 18-game migration backup is delivered privately, never committed here.

## Hosting

GitHub Pages: main branch, root directory. All asset paths are relative. Service worker is scoped to this application and only clears its own caches. Network-first assets fall back to cached copies offline.

## Validation

Syntax checks and core boundary tests: 18-game totals, monthly filtering, idempotence, duplicate fingerprint, conflicting ID, impossible date and invalid finish.

## Google Sheets backup (v0.2)

Use the existing ポーカー成績管理 spreadsheet. From that spreadsheet open
Extensions → Apps Script, copy in Code.gs and enable the advanced Google Sheets
service. Run `configurePokerStats` once as the spreadsheet owner and authorize it.
In project settings, find the `POKER_STATS_TOKEN` script property. Deploy a web app
executed as the owner. For embedded access from GitHub Pages, select access
“Anyone” if permitted by the account. The application requires the private
connection key before it reads or writes data. Keep the spreadsheet sharing
private and keep the connection key out of GitHub and shared links.

In データ管理 → 接続設定, enter the deployment's /exec URL and connection key.
Saving a result or pressing Googleスプレッドシートに書き込む compares all local
records to the existing 成績一覧 tab. New results are appended. Record IDs are
saved as notes on new sequence cells, so the existing A:G layout stays intact.
Older rows are matched by date precision, venue, tournament, field and finish.
Existing rows, including their formulas, stay intact. A failed connection
can be retried by saving another result or using the manual button.
