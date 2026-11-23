# Crick English

Crick English is the Department of English cricket tournament site. The first version connects the public site and committee portal to the existing PocketBase instance.

## Run on this PC

In PowerShell, open this folder and run:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. The public site and committee portal read the same hosted PocketBase records.

Open http://127.0.0.1:5173/admin to add or edit teams, players and fixtures. The initial tournament committee login is in the ignored local admin credentials file (`.local-admin.txt`). Use the tournament committee account there. Set or rotate committee passwords in PocketBase under `ce_staff`.

Assign each player to a team in the player form. Add two teams before creating a match. New matches start as scheduled, and appear publicly after checking **Show on the public website**. Manage history in the PocketBase dashboard. History entries can be kept private until ready. The season’s fixture times are entered and displayed in Dhaka time.

## Score a match

In **Committee portal → Matches**, open **Score**, select the playing side from each squad, and pick the opening batters and bowler. The scorer takes regular runs directly and opens a short form for extras and wickets. Each saved entry updates the visitor scorecard. Select a new bowler at each over, then start the chase and finalize the result.

Use **Undo last entry** for wickets or corrections that change the sequence. **Edit** opens a correction form beneath that delivery in the log. Below the log, **End innings early** closes the innings at its current score. **Run adjustment / penalty** adds or deducts runs from the current batting side without changing deliveries or player figures. If the change would affect later strike or over count, undo back to that delivery. **Reopen for correction** takes a finalized result out of the standings until it is finalized again. A Summary-only scorecard can still be viewed.

This version assumes six legal balls per over, equal playing sides, a one-run wide and no-ball penalty, and a single innings per team. Bowler caps, free hits, special tie-breaks and other competition rules can be added once the playing conditions are set.

## Database

The default PocketBase URL is `https://pbdb2.duckdns.org`. Override it by copying `.env.example` to `.env.local` and changing `VITE_POCKETBASE_URL`. Only the public URL is part of the website configuration. The schema reference is in `backend/collections.json`, and the collections are prefixed `ce_`. Season 9 is active on the existing instance. If the schema is ever imported into another instance, leave **Delete missing collections** unchecked.

The public site reads published fixtures and history. Season standings use one league table and use the current provisional scoring rule (win 2, tie or no result 1, loss 0). Each scoring save writes the ball log and derived scorecard, player figures, and status in one match record. Player profiles and tournament rankings count only finalized published matches. Summary-only results can still use `ce_player_match_stats`. The browser calls the same pure scoring code for every entry. `backend/match-scoring-schema.json` records the additive changes already applied to PocketBase. The browser scorer needs a connection. The [Android scorer](android-scorer/README.md) stores deliveries offline and syncs to the same match records.

## Season history

Edit `ce_season_history` in PocketBase. `champion_captain` and `runner_up_captain` show the captain below the corresponding team name. Both are optional; blank values are hidden. `team_photo` holds one optional JPEG, PNG, WebP or AVIF image up to 10 MB. The website and spectator app show it below that season's teams without cropping, and request a 960-pixel thumbnail to reduce downloads. Records without a photo show only their team details. The existing champion and runner-up logo fields remain separate.

Published records remain visible through the existing public read rules. Team records also have optional `owner_name` and `owner_photo` fields, editable under Teams in the committee portal; these are independent of player profiles.

## Testing records

The identified fictional teams, players, fixtures and player statistics were removed before real data entry. `backend/testing-records.json` is the historical list of those test IDs. The active season, staff and current history records were preserved.

## Support form

The website footer links to `/support`, where visitors can send a correction,
question or suggestion with optional photos. Submissions are private and stored
in `ce_support_requests`. PocketBase queues email notifications for the committee,
delivered through the existing Gmail connection in n8n. See [the support setup and review guide](backend/support-requests.md)
for the collection, notification queue and server hook deployment details.

## Validation

Run `node --test test/scoring.test.mjs` to verify scoring rules and `npm run build` to check the website.

## Production build

The public header opens Android installation guidance before offering the latest signed spectator APK at `https://github.com/madhu734/CE-app/releases/latest/download/Crick-English.apk`. GitHub updates this stable link when a newer release is published. The guidance also links to release details.

```powershell
npm run build
```

The output is in `dist`. The live website is at https://crickenglish.enggames.tech. Coolify builds the Dockerfile from the GitHub main branch and Nginx serves `dist/index.html` for app routes such as `/matches/<id>`. PocketBase remains on its existing server.

Hero image: generated for this project with the built-in image generator. Prompt: documentary photograph of a Bangladesh university cricket ground at twilight with a helmeted batter to the right, floodlights, and a quiet navy left side for the heading. Saved as `public/cricket-hero.webp`.


