import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import copySrc from "../method-copy-v1.md?raw";

function publicCopy(md) {
  const lines = String(md || "").split("\n");
  const kept = [];
  for (const line of lines) {
    if (/^#\s/.test(line)) continue;
    if (/should use this language/i.test(line)) continue;
    kept.push(line);
  }
  return kept.join("\n").replace(/^\s+/, "").replace(/\s+$/, "");
}

function Inline({ text, goChangelog }) {
  const nodes = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] != null) {
      nodes.push(<strong key={k++}>{m[1]}</strong>);
    } else {
      const code = m[2];
      if (code === "/changelog" && goChangelog) {
        nodes.push(
          <Hover
            as="button"
            key={k++}
            onClick={goChangelog}
            style="background:none;border:none;cursor:pointer;padding:0;font:inherit;color:var(--forest);"
            hover="color:var(--forest-deep);"
          >
            {code}
          </Hover>
        );
      } else {
        nodes.push(<code key={k++} style={css("font-family:'IBM Plex Mono',monospace;font-size:0.92em;")}>{code}</code>);
      }
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

function Blocks({ md, goChangelog }) {
  const body = "font-size:15.5px;line-height:1.55;color:var(--body);";
  const h2 = "font-family:Newsreader,serif;font-size:20px;font-weight:600;margin:28px 0 8px;color:var(--ink);";
  const lines = publicCopy(md).split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={"h" + i} style={css(h2)}>{line.slice(3).trim()}</h2>);
      i += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={"ul" + i} style={css("font-size:15.5px;line-height:1.6;color:var(--body);padding-left:20px;")}>
          {items.map((t, j) => (
            <li key={j}><Inline text={t} goChangelog={goChangelog} /></li>
          ))}
        </ul>
      );
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("## ") && !lines[i].startsWith("- ")) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={"p" + i} style={css(body)}>
        <Inline text={para.join(" ")} goChangelog={goChangelog} />
      </p>
    );
  }
  return <>{blocks}</>;
}

export default function Method({ goHome, goChangelog }) {
  return (
    <main style={css("max-width:760px;margin:0 auto;padding:28px 20px 48px;animation:vFadeUp .28s ease;")}>
      <Hover as="button" onClick={goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:20px;" hover="color:var(--forest);">← Home</Hover>
      <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.2em;color:var(--forest);margin-bottom:10px;")}>METHODOLOGY · PUBLIC COPY V1.0.0</div>
      <h1 style={css("font-family:Newsreader,serif;font-size:30px;font-weight:600;margin:0 0 16px;color:var(--ink);")}>How Trooth scores a forecast</h1>
      <Blocks md={copySrc} goChangelog={goChangelog} />
    </main>
  );
}
