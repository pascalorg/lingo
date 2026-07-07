# Prior-art study: NL date/duration parsing & humanization

Research pass 2026-07-03 (background agent, source-level). Subjects: chrono-node, inclusive-dates, Humanizer (C#), date-fns, Luxon, moment, timeago.js, humanize-duration, ms, tinyduration, Intl.RelativeTimeFormat.

## chrono-node internals (the reference parser)

- Architecture: ordered parsers + refiners pipeline; EN ships 14 parsers. Custom parser example (Christmas, ~6 lines) is the best extensibility story in the space.
- **Known vs implied components** (`isCertain('weekday')`): the only mainstream certainty model — we extend it with grain + interval.
- Casual heuristics worth keeping: `midnight` → hour 0 **+1 day when ref hour > 2**; `last night` → hour 0 same day when ref < 6 am; `tonight` → implied 22:00; `now` assigns full instant.
- Number words: only one–twelve + a/an→1, couple→2, few→3, several→7, half→0.5 (our words layer goes far beyond).
- **Weekday table** (calculation/weekdays.ts): `this X` = forward incl. today; `next X` = next-week instance (Sunday/Saturday special cases); `last X` = backward; bare X = closest, forward wins ties; `forwardDate: true` option forces future (inclusive-dates always sets it).
- Reference is `{instant, timezone}`; timezone abbrevs resolved via DST-aware map consulting the parsed date, not today.
- Gaps we own: durations as values, `1h30`, "end of month", "day before yesterday", "just now", words > twelve, Q2, mid-June, `beginning of next week`.

## Humanize threshold tables (source-verified)

- **moment**: thresholds `{ss:44, s:45, m:45, h:22, d:26, M:11}`, Math.round; 45–89 s → "a minute ago", 22–35 h → "a day ago", 26–45 d → "a month ago", 320–547 d → "a year ago".
- **date-fns formatDistance**: qualifier-laden ("about 1 hour", "over 1 year", "almost 2 years") — hostile to round-trip; `formatDistanceStrict` (qualifier-free, `roundingMethod` default round, **DST-normalized minutes** before day bucketing) is the right base model.
- **Luxon toRelative**: units years→seconds (no weeks), default rounding **trunc** (reads wrong: 47 h → "1 day ago"); `toRelativeCalendar` compares via startOf → "yesterday" correct across DST. Steal the calendar/elapsed split, not trunc.
- **timeago.js**: `SEC_ARRAY=[60,60,24,7,365/7/12,12]`, floor; ≤9 s → "just now".
- **humanize-duration**: exact decomposition, `largest`, `round`, `conjunction`, unitMeasures y=365.25 d, mo=y/12 (fixed-ms months — what we avoid for calendar work).
- **ms**: 2.5 hrs OK, no months, silent undefined on garbage (avoid), 1y = 365.25 d.
- **Intl.RelativeTimeFormat**: no auto-unit/thresholds; `numeric:'auto'` gives "yesterday"/"tomorrow". Free i18n backend — mirror its lexicon.
- **Humanizer (C#)**: precision strategy (unit switch at 75% of next), `maxUnit`/`minUnit`, `toWords`; words↔numbers both ways ("one hundred and five".ToNumber()); refuses date dehumanize ("lossy") — we instead *bound* loss per grain with a property test.

## Adopted round-trip-safe table (plan 005 addenda)

<10 s just now · 10–59 s N seconds · <45 min minutes · 45–89 min an hour · <24 h hours · 24–47 h calendar-compare yesterday/tomorrow · 2–6 d days · 7–29 d weeks (units-optional) · 30–319 d calendar months · else calendar years. Round (not trunc); emit digits, accept words; strip about/over/almost as no-op qualifiers on parse; `maxUnit`/`minUnit`/`justNow`/`numeric` options.

## inclusive-dates a11y contract (the DOM-layer blueprint)

- Required `id` prop → deterministic `label[for]`/input association; error region `<div id="{id}-error" role="status">`; input gets `aria-describedby` **only while in error** + `aria-invalid`.
- Announce the *interpretation*, once, politely: "Tuesday May 2, 2021 selected"; assertive only for calendar month changes; errors rendered into the role="status" region with machine-readable reasons (`invalid | minDate | maxDate | rangeOutOfBounds`) mapped to human copy.
- Public `parseDate(text) → {value, reason}` method; quick buttons ("Yesterday", "In 10 days") whose labels are literally fed through the parser — self-demonstrating grammar; placeholder teaches the grammar ("Try 'tomorrow' or 'in ten days'").
- Styling: BEM parts + ~9 semantic CSS custom properties (--focus-color, --error-color…) — small token set beats per-part variables.
- Their `removeTimezoneOffset(new Date())` shifting hack corrupts near-midnight instants — do real civil-field math instead. Their `@react-aria/live-announcer` dep → we implement a ~20-line internal announcer.

## Pitfalls encoded as tests

- Month-end clamp: Jan 31 +1 mo → Feb 28/29 (never setMonth overflow → Mar 2/3); non-associative: +1mo+1mo ≠ +2mo — composite offsets apply largest-first with ONE clamp; Feb 29 +1 y → Feb 28.
- "in 24 hours" (exact ms) ≠ "tomorrow" (calendar, wall-clock preserved) across DST; day-level thresholds use DST-normalized minutes.
- Spring-forward nonexistent times (2:30 am) & fall-back ambiguous times (1:30 am twice): deterministic default + flag.
- Weeks: chrono hardcodes Sunday; ISO says Monday; single `weekStart` option honored everywhere (default 1).
- Bare "2024"/lone "1" not parsed as dates in free text (chrono's UnlikelyFormatFilter) — bypassable under explicit kind:'date'.

## Licenses

chrono-node MIT · inclusive-dates MIT · Humanizer MIT (.NET Foundation) · date-fns MIT · Luxon MIT · moment MIT · timeago.js MIT · humanize-duration **Unlicense** · ms MIT · tinyduration MIT · Intl spec (ECMA-402).
