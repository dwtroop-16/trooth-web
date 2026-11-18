import { useState } from "react";
import { css } from "../helpers.js";
import { formatAsOf } from "../boardFilter.js";
import { buildNicheLists, nicheMethodology, recordHeading } from "../nicheLists.js";

function prettyDay(ymd) {
  if (!ymd) return "";
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return ymd;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function sectionsFor(lists) {
  const order = ["league", "claim_type", "team", "finance", "politics", "weather"];
  const titles = {
    league: "League",
    claim_type: "Claim type",
    team: "Team",
    finance: "Sub-topic",
    politics: "Sub-topic",
    weather: "Station and metric",
  };
  return order
    .map((family) => {
      const rows = lists.filter((list) => list.family === family);
      if (family === "weather") {
        rows.sort((a, b) => Number(a.group === "metric") - Number(b.group === "metric") || a.label.localeCompare(b.label));
      }
      return { family, title: titles[family], lists: rows };
    })
    .filter((section) => section.lists.length);
}

function ListTable({ list, openSpeaker }) {
  return (
    <article id={"niche-" + list.niche_id} style={css("margin-top:18px;")}>
      <h3 style={css("font-family:Newsreader,serif;font-size:20px;font-weight:600;margin:0;color:var(--ink);")}>{list.label}</h3>
      <p style={css("margin:4px 0 0;font-size:13px;color:var(--muted);")}>{recordHeading(list.record)}</p>
      <p style={css("margin:6px 0 0;font-size:13.5px;color:var(--body);line-height:1.45;")}>{list.definition}</p>
      <p style={css("margin:6px 0 0;font-size:13px;color:var(--muted);line-height:1.45;")}>
        {list.n_ranked} ranked · {list.n_resolved} resolved · {list.n_pending} pending
        {list.resolved_horizon_start_et
          ? ` · resolved forecasts ${prettyDay(list.resolved_horizon_start_et)} to ${prettyDay(list.resolved_horizon_end_et)}`
          : ""}
      </p>
      <div style={css("overflow-x:auto;margin-top:8px;")}>
        <table style={css("width:100%;border-collapse:collapse;font-size:14px;")}>
          <thead>
            <tr style={css("text-align:left;color:var(--muted);font-size:12px;")}>
              <th style={css("padding:6px 8px;font-weight:600;")}>Rank</th>
              <th style={css("padding:6px 8px;font-weight:600;")}>Speaker</th>
              <th style={css("padding:6px 8px;font-weight:600;")}>Resolved</th>
              <th style={css("padding:6px 8px;font-weight:600;")}>Hit rate</th>
              <th style={css("padding:6px 8px;font-weight:600;")}>Pending</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((row) => {
              const ranked = row.rank != null;
              return (
                <tr key={row.speaker_id} style={css("border-top:1px solid var(--hair);")}>
                  <td style={css("padding:8px;white-space:nowrap;")}>{ranked ? row.rank : "Not ranked yet"}</td>
                  <td style={css("padding:8px;")}>
                    <a
                      href={"/person/" + row.speaker_id}
                      onClick={(event) => {
                        if (!openSpeaker) return;
                        event.preventDefault();
                        openSpeaker(row.speaker_id, { entry: "niche", domain: list.domain });
                      }}
                      style={css("color:var(--ink);font-weight:600;")}
                    >
                      {row.speaker_name}
                    </a>
                    {row.agency_label ? <span style={css("margin-left:8px;color:var(--muted);font-size:12px;")}>{row.agency_label}</span> : null}
                    {row.early ? <span style={css("margin-left:8px;color:var(--muted);font-size:12px;")}>early</span> : null}
                  </td>
                  <td style={css("padding:8px;white-space:nowrap;")}>{ranked ? row.n_resolved : `${row.n_resolved} of 3 resolved`}</td>
                  <td style={css("padding:8px;white-space:nowrap;")}>{ranked ? `${row.n_hit} of ${row.n_resolved} resolved` : "Not ranked yet"}</td>
                  <td style={css("padding:8px;")}>{row.n_pending}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export default function NicheLists({ domain, nicheId, openSpeaker, openNiche }) {
  const result = domain && domain !== "All" ? buildNicheLists() : null;
  const lists = result ? result.shown.filter((list) => list.domain === String(domain).toLowerCase()) : [];
  const teams = lists.filter((list) => list.family === "team");
  const teamIds = [...new Set(teams.map((list) => list.team_slug + "|" + list.league))];
  const selectedTeam = teamIds.find((key) => teams.some((list) => list.niche_id === nicheId && list.team_slug + "|" + list.league === key)) || teamIds[0] || "";
  const [picked, setPicked] = useState("");
  const teamKey = teamIds.includes(picked) ? picked : selectedTeam;
  if (!lists.length) return null;
  const sections = sectionsFor(lists.filter((list) => list.family !== "team"));
  const teamLists = teams.filter((list) => list.team_slug + "|" + list.league === teamKey).sort((a, b) => a.record.localeCompare(b.record));
  const asOf = formatAsOf(result.generated_at);

  return (
    <section style={css("margin-top:36px;")} aria-label="Niche lists">
      <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;color:var(--ink);")}>Niche lists</h2>
      <p style={css("margin:8px 0 0;font-size:14px;color:var(--body);line-height:1.5;max-width:720px;")}>{nicheMethodology()}</p>
      <p style={css("margin:8px 0 0;font-size:13px;color:var(--muted);line-height:1.45;max-width:720px;")}>
        {asOf ? asOf + ". " : ""}
        These counts re-tally the published Hit and Miss grades in this bundle. The leaderboard above is the Nov 6, 2026 snapshot and is a separate tally.
      </p>
      {sections.map((section) => (
        <div key={section.family} style={css("margin-top:22px;")}>
          <h3 style={css("font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin:0;")}>{section.title}</h3>
          {section.lists.map((list) => (
            <ListTable key={list.niche_id} list={list} openSpeaker={openSpeaker} />
          ))}
        </div>
      ))}
      {teamLists.length ? (
        <div style={css("margin-top:22px;")}>
          <h3 style={css("font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin:0;")}>Team</h3>
          <label style={css("display:block;margin-top:10px;font-size:13px;color:var(--muted);")}>
            Team
            <select
              value={teamKey}
              onChange={(event) => {
                const key = event.target.value;
                setPicked(key);
                const next = teams.find((list) => list.team_slug + "|" + list.league === key && list.record === "score") || teams.find((list) => list.team_slug + "|" + list.league === key);
                if (next && openNiche) openNiche(next.niche_id);
              }}
              style={css("display:block;margin-top:4px;font-size:14px;padding:6px 8px;border:1px solid var(--hair);border-radius:8px;background:var(--paper);color:var(--ink);")}
            >
              {teamIds.map((key) => {
                const sample = teams.find((list) => list.team_slug + "|" + list.league === key);
                return <option key={key} value={key}>{sample.team_label}</option>;
              })}
            </select>
          </label>
          {teamLists.map((list) => (
            <ListTable key={list.niche_id} list={list} openSpeaker={openSpeaker} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
