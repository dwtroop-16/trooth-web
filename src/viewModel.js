import { gradeFor, hexA, spark, statusMeta, methodMeta } from "./helpers.js";

// Ported from the original renderVals(). Given the current state, a set of
// action callbacks, and the data ({ F, P, CATCOLORS }), it returns the full
// view-model the components render.
export function buildVals(state, actions, data) {
  const s = state;
  const { F, P, CATCOLORS } = data;
  const { setState, openF, openP, goHome, setCat, submit } = actions;
  const cats = ["Financial", "Sports", "Weather", "Politics"];

  // rank within each category by accuracy
  const rankMap = {};
  cats.forEach((c) => {
    F.filter((f) => f.cat === c)
      .sort((a, b) => b.acc - a.acc)
      .forEach((f, i) => {
        rankMap[f.id] = i + 1;
      });
  });

  // ---- HOME rows (topic search takes precedence over name search)
  const q = (s.q || "").toLowerCase().trim();
  const tq = (s.topicQ || "").toLowerCase().trim();
  const scopeCats = s.cat === "All" ? cats : [s.cat];

  // topic universe (unique focus labels) for the suggestion chips
  const seenT = {},
    topicUniverse = [];
  F.filter((f) => scopeCats.includes(f.cat)).forEach((f) =>
    f.breakdown.forEach((b) => {
      const k = b.label.toLowerCase();
      if (!seenT[k]) {
        seenT[k] = 1;
        topicUniverse.push(b.label);
      }
    })
  );
  const topicChips = topicUniverse.map((label) => {
    const active = label.toLowerCase() === tq;
    return {
      label,
      style:
        "padding:7px 13px;border-radius:20px;font-size:13px;cursor:pointer;" +
        (active
          ? "font-weight:600;background:#15503A;color:#F4F0E8;border:1px solid #15503A;"
          : "font-weight:500;background:#F1ECE0;color:#4A4438;border:1px solid #E3DCCD;"),
      onClick: () => setState({ topicQ: active ? "" : label }),
    };
  });
  const phMap = {
    Financial: "Try “rates”, “equities”, “crypto”, “FX”, “macro”…",
    Sports: "Try “spreads”, “playoffs”, “player props”, “totals”…",
    Weather: "Try “hurricanes”, “heat”, “winter”, “severe”…",
    Politics: "Try “senate”, “turnout”, “primaries”, “polls”…",
    All: "Search any call — rates, hurricanes, playoffs, senate…",
  };

  let rows,
    rankNote = "ranked by career accuracy",
    accHeader = "Accuracy",
    focusHeader = "Focus";
  if (tq) {
    const matched = [];
    F.filter((f) => scopeCats.includes(f.cat)).forEach((f) => {
      let best = null;
      f.breakdown.forEach((b) => {
        const bl = b.label.toLowerCase();
        if (bl.includes(tq) || tq.includes(bl)) {
          if (!best || b.pct > best.pct) best = { label: b.label, pct: b.pct };
        }
      });
      if (!best) {
        const pr = P.find((x) => x.f === f.id && x.claim.toLowerCase().includes(tq));
        if (pr) best = { label: "Mentioned in a call", pct: f.acc };
        else if (
          f.name.toLowerCase().includes(tq) ||
          f.handle.toLowerCase().includes(tq) ||
          f.org.toLowerCase().includes(tq)
        )
          best = { label: f.cat, pct: f.acc };
      }
      if (best) matched.push({ f, best });
    });
    matched.sort((a, b) => b.best.pct - a.best.pct);
    rows = matched.map((m, i) => {
      const f = m.f,
        val = m.best.pct,
        gr = gradeFor(val),
        cm = CATCOLORS[f.cat];
      return {
        rank: i + 1, name: f.name, handle: f.handle, org: f.org, initials: f.initials, avatar: f.avatar,
        verified: f.verified, primaryCat: m.best.label, catColor: cm.color, catTint: cm.tint, resolved: f.resolved,
        accuracy: val, grade: gr.g, gradeColor: gr.c, gradeTint: hexA(gr.c, 0.12),
        spark: spark(f.spark, 132, 34), open: () => openF(f.id),
      };
    });
    rankNote = "ranked by accuracy on this call type";
    accHeader = "On topic";
    focusHeader = "Matched focus";
  } else {
    let list = F.filter(
      (f) =>
        (s.cat === "All" || f.cat === s.cat) &&
        (!q || f.name.toLowerCase().includes(q) || f.handle.toLowerCase().includes(q) || f.org.toLowerCase().includes(q))
    );
    list = list.sort((a, b) => b.acc - a.acc);
    rows = list.map((f, i) => {
      const gr = gradeFor(f.acc),
        cm = CATCOLORS[f.cat];
      return {
        rank: i + 1, name: f.name, handle: f.handle, org: f.org, initials: f.initials, avatar: f.avatar,
        verified: f.verified, primaryCat: f.cat, catColor: cm.color, catTint: cm.tint, resolved: f.resolved,
        accuracy: f.acc, grade: gr.g, gradeColor: gr.c, gradeTint: hexA(gr.c, 0.12),
        spark: spark(f.spark, 132, 34), open: () => openF(f.id),
      };
    });
  }

  const categories = ["All", ...cats].map((c) => ({ label: c, active: s.cat === c, onClick: () => setCat(c) }));
  const boardTitle = tq
    ? "Best on “" + (s.topicQ || "").trim() + "”"
    : s.cat === "All"
    ? "Leaderboard"
    : s.cat + " forecasters";
  const totalResolved = F.reduce((a, f) => a + f.resolved, 0);

  // ---- PROFILE
  let p = null;
  if (s.view === "profile" && s.fId) {
    const f = F.find((x) => x.id === s.fId);
    if (f) {
      const gr = gradeFor(f.acc);
      const diff = f.acc - f.conf;
      const calib =
        diff > 4
          ? { label: "Underconfident.", c: "#1B7A4B" }
          : diff < -4
          ? { label: "Overconfident.", c: "#BC2E29" }
          : { label: "Well calibrated.", c: "#2E6BA6" };
      const preds = P.filter((x) => x.f === f.id).map((x) => {
        const sm = statusMeta(x.status);
        const imp = x.status === "pending" ? "—" : (x.impact > 0 ? "+" : "") + x.impact.toFixed(1) + " pts";
        const impC = x.status === "pending" ? "#A79E8C" : x.impact > 0 ? "#1B7A4B" : "#BC2E29";
        return {
          claim: x.claim, primaryCat: f.cat, date: x.date, conf: x.conf, statusLabel: sm.label,
          statusColor: sm.color, statusTint: sm.tint, impact: imp, impactColor: impC, open: () => openP(x.id),
        };
      });
      const cm = CATCOLORS[f.cat];
      p = {
        name: f.name, handle: f.handle, org: f.org, initials: f.initials, avatar: f.avatar, verified: f.verified,
        bio: f.bio, primaryCat: f.cat, catColor: cm.color, catTint: cm.tint,
        accuracy: f.acc, grade: gr.g, gradeColor: gr.c, gradeTint: hexA(gr.c, 0.12),
        resolved: f.resolved, pending: f.pending, rankInCat: rankMap[f.id], avgConf: f.conf,
        calibLabel: calib.label, calibColor: calib.c, heroSpark: spark(f.spark, 220, 52),
        breakdown: f.breakdown.map((b) => {
          const g = gradeFor(b.pct);
          return { label: b.label, pct: b.pct, color: g.c, width: b.pct + "%" };
        }),
        predictions: preds,
      };
    }
  }

  // ---- PREDICTION DETAIL
  let d = null;
  if (s.view === "prediction" && s.pId) {
    const x = P.find((y) => y.id === s.pId);
    if (x) {
      const f = F.find((y) => y.id === x.f);
      const sm = statusMeta(x.status),
        mm = methodMeta(x.method),
        cm = CATCOLORS[f.cat];
      const total = x.agree + x.dispute;
      const ap = total ? Math.round((x.agree / total) * 100) : 0;
      const imp = x.status === "pending" ? "—" : (x.impact > 0 ? "+" : "") + x.impact.toFixed(1) + " pts";
      const impC = x.status === "pending" ? "#8A8375" : x.impact > 0 ? "#1B7A4B" : "#BC2E29";
      d = {
        claim: x.claim, primaryCat: f.cat, catColor: cm.color, catTint: cm.tint, date: x.date, conf: x.conf,
        fName: f.name, handle: f.handle, initials: f.initials, avatar: f.avatar, accuracy: f.acc,
        resolvedDate: x.resolvedDate, // (added: original view-model omitted this)
        statusLabel: sm.label, statusColor: sm.color, statusTint: sm.tint, statusBorder: sm.border, statusIcon: sm.icon,
        methodLabel: mm.label, methodColor: mm.color,
        outcome:
          x.status === "pending"
            ? "This prediction has not resolved yet. It stays pending — and out of the grade — until the outcome is known."
            : x.outcome,
        source: x.source || "Awaiting resolution", impact: imp, impactColor: impC,
        impactArrow: x.impact >= 0 ? "M14 7h7v7" : "M14 17h7v-7",
        agree: x.agree, dispute: x.dispute, agreePct: ap, disputePct: 100 - ap, agreeW: ap + "%", disputeW: 100 - ap + "%",
        backToProfile: () => openF(f.id), openForecaster: () => openF(f.id),
      };
    }
  }

  return {
    goHome, categories, q: s.q, onSearch: (e) => setState({ q: e.target.value }),
    openModal: () => setState({ modal: true }),
    isHome: s.view === "home", isProfile: s.view === "profile" && !!p, isPrediction: s.view === "prediction" && !!d,
    stat: { forecasters: F.length, resolved: totalResolved.toLocaleString() },
    boardTitle, resultCount: rows.length + (rows.length === 1 ? " forecaster" : " forecasters"),
    rankNote, accHeader, focusHeader,
    topicQ: s.topicQ, onTopic: (e) => setState({ topicQ: e.target.value }), clearTopic: () => setState({ topicQ: "" }),
    topicActive: !!tq, topicScope: s.cat === "All" ? "ALL CATEGORIES" : s.cat.toUpperCase(),
    topicPlaceholder: phMap[s.cat] || phMap.All, topicChips,
    rows, noResults: rows.length === 0,
    p, d,
    modal: s.modal, closeModal: () => setState({ modal: false }), stop: (e) => e.stopPropagation(),
    mClaim: s.mClaim, onClaim: (e) => setState({ mClaim: e.target.value }),
    mCat: s.mCat, onMCat: (e) => setState({ mCat: e.target.value }),
    mDeadline: s.mDeadline, onDeadline: (e) => setState({ mDeadline: e.target.value }),
    mConf: s.mConf, onConf: (e) => setState({ mConf: +e.target.value }),
    submitModal: submit, toast: s.toast,
  };
}
