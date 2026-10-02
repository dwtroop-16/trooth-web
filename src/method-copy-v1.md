# Trooth methodology (public copy v1.3.0)

Site `/method` should use this language. Tolerances below are part of rubric v1.3.0; change them only with a new rubric version and a changelog entry.

Trooth scores **explicit public forecasts** against **official prints**. We do not score vibes, advice, or polls of our users.

## What we take
A forecast must name a speaker, a public source URL, a number or a yes/no/category, and a date or event when the world will have an official result. Domains: Finance, Sports, Weather, Politics.

## How we choose what to track
Each speaker page shows a **Coverage** line: how many claims we captured, the date span, and the source sites they came from. That is the whole record we grade. It is not everything the person has ever said. We add sources whole (for example, every published pick in a weekly picks column, or every NWS outlook for Central Park) rather than picking single claims after the fact. A tip sent through “Suggest a source” is never graded on its own.

## How we match
One forecast, one official actual. We match on the thing predicted (place, ticker, game, race) and the date or event, not on who said it. Several speakers can be right or wrong about the same print.

## What counts as the result
- Weather: NWS / NOAA station observations
- Finance: FRED or the listing exchange’s official close
- Sports: the league’s official box score
- Politics: the certified canvass (state Secretary of State or FEC) or an official roll call on congress.gov

An AP “called” race, a poll, a betting market, or a Wikipedia page is not the result. Until the official print exists, the forecast stays **Pending**. Pending is not a miss.

## Hit or miss
Every grade is Hit or Miss. There is no Partial. Each kind of forecast has one rule, published here before anything resolves:
- **Game picks** (“Chiefs 23-20 over Chargers”): Hit if the picked team wins. The predicted score is shown as **margin error** on the claim page but is not graded.
- **Temperatures**: Hit if within **±2 °F** of the official station reading.
- **Macro rates in percent** (GDP growth, inflation, fed funds): Hit if within **±0.25 percentage points** of the official print.
- **Stock price targets**: Hit if the official close on the horizon date is within **10%** of the target.
- **Analyst ratings**: over 12 months from the date said, measured in total return against the sector benchmark named at capture. Buy-type ratings (Buy, Outperform, Overweight) hit if the stock beats the benchmark. Sell-type ratings hit if it trails. Hold-type ratings (Hold, Neutral, Equal-weight) hit if it lands within **±5 points**.
- **Categories** (champions, election winners, seeds): exact match.
- **Ranges**: if the speaker gave a range, the print has to land inside it.

## Baselines
A hit rate alone does not say whether someone is good. Some calls are easy. So we grade a naive forecaster on the same claims, under the same rule:
- Games: always pick the home team.
- Temperatures: assume the target day will match the last full day of official readings before the forecast was published.

**vs baseline** on the leaderboard is the speaker’s hit rate minus the naive forecaster’s, in percentage points, on the same claims.

## The leaderboard
A speaker is ranked once **10 claims** have resolved. Below that, results mostly reflect luck, so those speakers are listed as “Not ranked yet.” Ranked speakers are ordered by the **low end of their 95% range**, so a long, solid record beats a short hot streak. **Avg error** is the mean absolute error on numeric forecasts.

## What changed in v1.3
Earlier rubrics (v1.2 and before) required an exact match on every claim. A game pick counted only if the final score matched to the point, and a temperature only if it matched to the degree. That graded almost every call a miss and said nothing about skill. v1.3 grades each kind of claim on what the speaker was actually calling. Every re-graded claim page shows its old v1.2 grade.

## What you see on a card
Speaker, the exact words, the source link, the date said, the horizon, the official actual (or Pending), the actual’s source, and the grade: Hit, Miss, Pending, Unscorable, or In review.

## What we do not do
We do not invent results. We do not let a community vote replace an official print. We do not grade guest “log a prediction” submissions. Corrections live on `/changelog`.
