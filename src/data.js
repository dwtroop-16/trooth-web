// Schema-complete sample data for the v1 page map.
// Visible cards never invent an official actual. Rows without a source URL,
// horizon, or allowlisted official print are Pending / Unscorable / In review.

export const DOMAINS = ["Finance", "Sports", "Weather", "Politics"];

export const CATCOLORS = {
  Finance: { color: "#1F6F5C", tint: "#E3EFEA" },
  Sports: { color: "#B4571F", tint: "#F6E9DE" },
  Weather: { color: "#2E6BA6", tint: "#E1EBF4" },
  Politics: { color: "#9A3B5A", tint: "#F4E4EA" },
};

// Official-print allowlist (schema v1.1.0). Politics: SOS / FEC / congress.gov only.
export const OFFICIAL_PRINT = {
  finance: { name: "FRED", url: "https://fred.stlouisfed.org/series/SP500" },
  weather: { name: "NWS", url: "https://api.weather.gov/stations/KNYC/observations" },
  sports: { name: "NFL official box score", url: "https://www.nfl.com/scores/" },
  politics: { name: "FEC certified canvass", url: "https://www.fec.gov/" },
};

export const SUBJECTS = {
  "us-spx-close": { id: "us-spx-close", label: "S&P 500 official close", domain: "finance", unit: "index" },
  "us-nyc-central-park-tmax": { id: "us-nyc-central-park-tmax", label: "Central Park daily high", domain: "weather", unit: "degF" },
  "us-nyc-central-park-precip": { id: "us-nyc-central-park-precip", label: "Central Park daily precip", domain: "weather", unit: "in" },
  "nfl-fixture-final-score": { id: "nfl-fixture-final-score", label: "NFL fixture final score (engine tests only)", domain: "sports", unit: "pts" },
  "us-fixture-election-winner": { id: "us-fixture-election-winner", label: "US fixture election winner (engine tests only)", domain: "politics", unit: "enum" },
  "us-fixture-vote-share": { id: "us-fixture-vote-share", label: "US fixture vote share (engine tests only)", domain: "politics", unit: "pct" },
};

export const SPEAKERS = [
  { id: "marcus-feld", name: "Marcus Feld", org: "Halcyon Capital", accounts: ["x:feldmacro"], domain: "finance", avatar: "#1F6F5C", initials: "MF", bio: "Macro strategist. Rates, equities, and the occasional commodity call." },
  { id: "dana-reyes", name: "Dana Reyes", org: "Coastal Weather Group", accounts: ["x:dxweather"], domain: "weather", avatar: "#2E6BA6", initials: "DR", bio: "Operational meteorologist focused on tropical systems and heat events." },
  { id: "gridiron-model", name: "GridIron Model", org: "GridIron Analytics", accounts: ["x:gridiron_model"], domain: "sports", avatar: "#B4571F", initials: "GI", bio: "Automated game model. Final scores against the league box score." },
  { id: "priya-anand", name: "Priya Anand", org: "Meridian Polling", accounts: ["x:priyapolls"], domain: "politics", avatar: "#9A3B5A", initials: "PA", bio: "Elections analyst. Winner and vote-share claims, scored only on certified canvasses." },
  { id: "chip-delgado", name: "Chip Delgado", org: "Business-channel contributor", accounts: ["x:chipcalls"], domain: "finance", avatar: "#3C6E4F", initials: "CD", bio: "On-air stock picker with a taste for bold single-name targets." },
  { id: "bea-okafor", name: "Bea Okafor", org: "The Courtline", accounts: ["x:beahoops"], domain: "sports", avatar: "#C2703A", initials: "BO", bio: "NBA writer. Playoff brackets, award races, and player props." },
  { id: "ellis-tran", name: "Ellis Tran", org: "StormPath", accounts: ["x:transtorms"], domain: "weather", avatar: "#35618C", initials: "ET", bio: "Seasonal and severe-weather forecaster covering the continental US." },
  { id: "ron-vance", name: "Ron Vance", org: "independent pundit", accounts: ["x:vancetake"], domain: "politics", avatar: "#8A4A6B", initials: "RV", bio: "Cable-news regular known for confident, contrarian predictions." },
  { id: "aisha-kamara", name: "Aisha Kamara", org: "independent FX trader", accounts: ["x:aishafx"], domain: "finance", avatar: "#237A6B", initials: "AK", bio: "Currency trader. Major pairs, emerging-market FX, and intervention calls." },
  { id: "ray-dellinger", name: "Ray Dellinger", org: "former coach, analyst", accounts: ["x:coachdell"], domain: "sports", avatar: "#A85A2E", initials: "RD", bio: "Retired coach turned broadcaster with strong takes on team results." },
  { id: "nate-brioux", name: "Nate Brioux", org: "Brioux Electoral Model", accounts: ["x:briouxmodel"], domain: "politics", avatar: "#6B4E9E", initials: "NB", bio: "Election model. Track record uses certified SOS/FEC results only — not AP calls or polls." },
];

const byId = Object.fromEntries(SPEAKERS.map((s) => [s.id, s]));

function fct(n, speakerId, fields) {
  const id = "fct_01K8SV1PAGEMAP" + String(n).padStart(12, "0");
  const sp = byId[speakerId];
  return {
    schema_version: "1.1.0",
    id,
    speaker_id: speakerId,
    captured_at: fields.captured_at,
    published_at: fields.published_at,
    source: fields.source,
    speaker: { name: sp.name, org: sp.org },
    domain: fields.domain,
    subject: fields.subject,
    horizon_end: fields.horizon_end,
    claim: fields.claim,
    scorable: fields.scorable,
    unscorable_reason: fields.unscorable_reason,
    match_key: fields.match_key,
  };
}

export const FORECASTS = [
  fct(1, "marcus-feld", {
    captured_at: "2026-08-12T14:00:00Z",
    published_at: "2026-08-12T13:40:00Z",
    source: { type: "x", url: "https://x.com/feldmacro", account: "feldmacro" },
    domain: "finance",
    subject: SUBJECTS["us-spx-close"],
    horizon_end: "2026-12-31T21:00:00Z",
    claim: { text: "S&P 500 official close at 6500 on the 2026 year-end session.", type: "numeric", value: 6500, unit: "index", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "finance|us-spx-close|2026-12-31|index",
  }),
  fct(2, "marcus-feld", {
    captured_at: "2026-08-20T15:00:00Z",
    published_at: "2026-08-20T14:10:00Z",
    source: { type: "x", url: "https://x.com/feldmacro", account: "feldmacro" },
    domain: "finance",
    subject: SUBJECTS["us-spx-close"],
    horizon_end: "2026-09-30T20:00:00Z",
    claim: { text: "S&P 500 official close between 5600 and 5800 on the September 30, 2026 session.", type: "numeric", value: 5700, unit: "index", probability: null, band: { low: 5600, high: 5800 } },
    scorable: true,
    unscorable_reason: null,
    match_key: "finance|us-spx-close|2026-09-30|index",
  }),
  fct(3, "dana-reyes", {
    captured_at: "2026-09-01T16:00:00Z",
    published_at: "2026-09-01T15:20:00Z",
    source: { type: "x", url: "https://x.com/dxweather", account: "dxweather" },
    domain: "weather",
    subject: SUBJECTS["us-nyc-central-park-tmax"],
    horizon_end: "2026-09-03T23:59:59Z",
    claim: { text: "High in the city tomorrow 88°F", type: "numeric", value: 88, unit: "degF", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "weather|us-nyc-central-park-tmax|2026-09-03|degF",
  }),
  fct(4, "dana-reyes", {
    captured_at: "2026-08-28T12:00:00Z",
    published_at: "2026-08-28T11:05:00Z",
    source: { type: "x", url: "https://x.com/dxweather", account: "dxweather" },
    domain: "weather",
    subject: SUBJECTS["us-nyc-central-park-tmax"],
    horizon_end: "2026-08-29T23:59:59Z",
    claim: { text: "Looks like a rough, stormy week ahead in the city.", type: "numeric", value: "", unit: "degF", probability: null, band: null },
    scorable: false,
    unscorable_reason: "qualitative",
    match_key: "weather|us-nyc-central-park-tmax|2026-08-29|degF",
  }),
  fct(5, "gridiron-model", {
    captured_at: "2026-09-01T18:00:00Z",
    published_at: "2026-09-01T17:00:00Z",
    source: { type: "x", url: "https://x.com/gridiron_model", account: "gridiron_model" },
    domain: "sports",
    subject: SUBJECTS["nfl-fixture-final-score"],
    horizon_end: "2026-09-14T23:59:59Z",
    claim: { text: "Fixture final score: 27 points for the listed home side.", type: "numeric", value: 27, unit: "pts", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "sports|nfl-fixture-final-score|nfl-fixture-final-score|pts",
  }),
  fct(6, "priya-anand", {
    captured_at: "2026-08-15T19:00:00Z",
    published_at: "2026-08-15T18:12:00Z",
    source: { type: "x", url: "https://x.com/priyapolls", account: "priyapolls" },
    domain: "politics",
    subject: SUBJECTS["us-fixture-election-winner"],
    horizon_end: "2026-11-03T23:59:59Z",
    claim: { text: "Certified winner of the fixture election is smith.", type: "categorical", value: "smith", unit: "enum", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "politics|us-fixture-election-winner|us-fixture-election-winner|enum",
  }),
  fct(7, "chip-delgado", {
    captured_at: "2026-08-18T20:00:00Z",
    published_at: "2026-08-18T19:40:00Z",
    source: { type: "x", url: "https://x.com/chipcalls", account: "chipcalls" },
    domain: "finance",
    subject: { id: "tesla-price-end-q4", label: "Tesla share price" },
    horizon_end: "2026-12-31T21:00:00Z",
    claim: { text: "Tesla reaches $400 by the end of Q4 2026.", type: "numeric", value: 400, unit: "USD", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "finance|tesla-price-end-q4|2026-12-31|USD",
  }),
  fct(8, "bea-okafor", {
    captured_at: "2026-04-12T16:00:00Z",
    published_at: "2026-04-12T15:00:00Z",
    source: { type: "x", url: "https://x.com/beahoops", account: "beahoops" },
    domain: "sports",
    subject: { id: "nba-celtics-ecf", label: "Celtics Eastern Conference Finals" },
    horizon_end: "2026-06-01T23:59:59Z",
    claim: { text: "The Celtics reach the Eastern Conference Finals.", type: "binary", value: "yes", unit: "enum", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "sports|nba-celtics-ecf|nba-celtics-ecf|enum",
  }),
  fct(9, "ellis-tran", {
    captured_at: "2026-09-01T11:00:00Z",
    published_at: "2026-09-01T10:30:00Z",
    source: { type: "x", url: "https://x.com/transtorms", account: "transtorms" },
    domain: "weather",
    subject: SUBJECTS["us-nyc-central-park-precip"],
    horizon_end: "2026-09-04T23:59:59Z",
    claim: { text: "Central Park daily precip 0.40 in on September 4.", type: "numeric", value: 0.4, unit: "in", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "weather|us-nyc-central-park-precip|2026-09-04|in",
  }),
  fct(10, "ron-vance", {
    captured_at: "2026-08-02T22:00:00Z",
    published_at: "2026-08-02T21:15:00Z",
    source: { type: "x", url: "https://x.com/vancetake", account: "vancetake" },
    domain: "politics",
    subject: SUBJECTS["us-fixture-election-winner"],
    horizon_end: "2026-11-03T23:59:59Z",
    claim: { text: "Red wave coming.", type: "categorical", value: "", unit: "enum", probability: null, band: null },
    scorable: false,
    unscorable_reason: "qualitative",
    match_key: "politics|us-fixture-election-winner|us-fixture-election-winner|enum",
  }),
  fct(11, "aisha-kamara", {
    captured_at: "2026-07-01T13:00:00Z",
    published_at: "2026-07-01T12:20:00Z",
    source: { type: "x", url: "https://x.com/aishafx", account: "aishafx" },
    domain: "finance",
    subject: { id: "eurusd-1-15", label: "EUR/USD" },
    horizon_end: "2026-12-31T21:00:00Z",
    claim: { text: "EUR/USD tests 1.15 by Q4 2026.", type: "numeric", value: 1.15, unit: "", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "finance|eurusd-1-15|2026-12-31|",
  }),
  fct(12, "ray-dellinger", {
    captured_at: "2026-09-02T12:00:00Z",
    published_at: "2026-09-02T11:00:00Z",
    source: { type: "x", url: "https://x.com/coachdell", account: "coachdell" },
    domain: "sports",
    subject: SUBJECTS["nfl-fixture-final-score"],
    horizon_end: "2026-09-14T23:59:59Z",
    claim: { text: "Fixture final score: 21 points for the listed home side.", type: "numeric", value: 21, unit: "pts", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "sports|nfl-fixture-final-score|nfl-fixture-final-score|pts",
  }),
  fct(13, "nate-brioux", {
    captured_at: "2026-09-01T16:30:00Z",
    published_at: "2026-09-01T16:00:00Z",
    source: { type: "x", url: "https://x.com/briouxmodel", account: "briouxmodel" },
    domain: "politics",
    subject: SUBJECTS["us-fixture-vote-share"],
    horizon_end: "2026-11-03T23:59:59Z",
    claim: { text: "Certified vote share for the fixture leading ticket is 51.2%.", type: "numeric", value: 51.2, unit: "pct", probability: 0.7, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "politics|us-fixture-vote-share|us-fixture-vote-share|pct",
  }),
  fct(14, "priya-anand", {
    captured_at: "2026-08-20T18:00:00Z",
    published_at: "2026-08-20T17:45:00Z",
    source: { type: "x", url: "https://x.com/priyapolls", account: "priyapolls" },
    domain: "politics",
    subject: SUBJECTS["us-fixture-election-winner"],
    horizon_end: "2026-11-03T23:59:59Z",
    claim: { text: "AP has already called the fixture for smith.", type: "categorical", value: "smith", unit: "enum", probability: null, band: null },
    scorable: false,
    unscorable_reason: "no_explicit_value",
    match_key: "politics|us-fixture-election-winner|us-fixture-election-winner|enum",
  }),
  fct(15, "chip-delgado", {
    captured_at: "2026-08-21T14:00:00Z",
    published_at: "2026-08-21T13:10:00Z",
    source: { type: "x", url: "https://x.com/chipcalls", account: "chipcalls" },
    domain: "finance",
    subject: SUBJECTS["us-spx-close"],
    horizon_end: "2026-10-30T20:00:00Z",
    claim: { text: "S&P 500 official close at 6100 on the October 30, 2026 session.", type: "numeric", value: 6100, unit: "index", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "finance|us-spx-close|2026-10-30|index",
  }),
  fct(16, "ellis-tran", {
    captured_at: "2026-09-02T09:00:00Z",
    published_at: "2026-09-02T08:40:00Z",
    source: { type: "agency", url: "https://www.weather.gov/", account: "NWS" },
    domain: "weather",
    subject: SUBJECTS["us-nyc-central-park-tmax"],
    horizon_end: "2026-09-05T23:59:59Z",
    claim: { text: "Central Park daily high 78°F on September 5.", type: "numeric", value: 78, unit: "degF", probability: null, band: null },
    scorable: true,
    unscorable_reason: null,
    match_key: "weather|us-nyc-central-park-tmax|2026-09-05|degF",
  }),
];

// No official prints in this sample. Never invent actuals.
export const ACTUALS = [];

function scr(n, forecastId, status, extra = {}) {
  return {
    schema_version: "1.1.0",
    id: "scr_01K8SV1PAGEMAP" + String(n).padStart(12, "0"),
    forecast_id: forecastId,
    actual_id: null,
    match_key: FORECASTS.find((f) => f.id === forecastId)?.match_key || "",
    status,
    hit: null,
    error: extra.error ?? null,
    abs_error: extra.abs_error ?? null,
    ape: extra.ape ?? null,
    brier: extra.brier ?? null,
    scored_at: extra.scored_at || "2026-09-02T12:00:00Z",
  };
}

const VOID_SUBJECTS = new Set(["tesla-price-end-q4", "nba-celtics-ecf", "eurusd-1-15"]);

export const SCORES = FORECASTS.map((f, i) => {
  if (!f.scorable) return scr(i + 1, f.id, "unscorable");
  if (!SUBJECTS[f.subject.id] || VOID_SUBJECTS.has(f.subject.id)) return scr(i + 1, f.id, "void");
  return scr(i + 1, f.id, "pending");
});

export const CHANGELOG = [];
