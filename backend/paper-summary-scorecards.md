# Paper summary scorecards

Summary matches use the existing `ce_matches` record with `scoring: null`,
`status: completed`, an official `winner`, `overs` set to that match's actual
quota, and a `scorecard` containing both innings. No delivery log is synthesized.
Future fixtures retain their own format.

`scorecard.entryMode: "summary"` and `summaryNote` identify a partial paper
transcription. `playerStats` remains the single source for recorded figures in
both clients; do not duplicate these rows in `ce_player_match_stats`.

For numeric statistics the scorer's existing shape is preserved. An unavailable
field uses a numeric storage placeholder of zero and its snake-case name in the
row's `unrecorded` array. This marker means **unknown**, not an actual zero.
Website and spectator app show a dash for unrecorded batting fields. A known
zero remains visible as zero. Rates combine runs and balls from complete pairs
only, so a paper innings with runs but unknown balls cannot inflate a player's
strike rate after a subsequent ball-by-ball match.

Unidentified players, conflicting figures and unfinished transcriptions belong
in `scorecard.pendingPaperFigures`, outside the ranked player figures. Do not
invent player IDs, ball counts, dismissal methods, fall-of-wicket positions,
awards or a complete playing XI. Official team totals can differ from the sum
of the available individual figures; the public note explains the incomplete
transcription. NRR uses the official innings totals and actual legal balls.

When reviewing a paper scorecard, fill only confirmed fields and remove those
field names from `unrecorded`. Once the figure is fully known the normal rate
and ranking calculations include it automatically.
