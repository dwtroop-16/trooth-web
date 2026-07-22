class Component extends DCLogic {
  state = { view: 'home', fId: null, pId: null, cat: 'All', q: '', topicQ: '', modal: false, toast: '',
    mClaim: '', mCat: 'Financial', mConf: 65, mDeadline: '' };

  CATCOLORS = {
    Financial: { color: '#1F6F5C', tint: '#E3EFEA' },
    Sports:    { color: '#B4571F', tint: '#F6E9DE' },
    Weather:   { color: '#2E6BA6', tint: '#E1EBF4' },
    Politics:  { color: '#9A3B5A', tint: '#F4E4EA' }
  };

  F = [
    { id:'f1', name:'Marcus Feld', handle:'@feldmacro', org:'Halcyon Capital', cat:'Financial', acc:84, resolved:142, pending:6, conf:72, verified:true, avatar:'#1F6F5C', initials:'MF', bio:'Macro strategist. Rates, equities, and the occasional commodity call.', spark:[79,80,78,82,83,82,84,85], breakdown:[{label:'Rates',pct:88},{label:'Equities',pct:84},{label:'Commodities',pct:70}] },
    { id:'f2', name:'Dana Reyes', handle:'@dxweather', org:'Coastal Weather Group', cat:'Weather', acc:91, resolved:210, pending:4, conf:78, verified:true, avatar:'#2E6BA6', initials:'DR', bio:'Operational meteorologist focused on tropical systems and heat events.', spark:[88,90,89,91,92,90,91,92], breakdown:[{label:'Hurricanes',pct:93},{label:'Heat',pct:90},{label:'Precipitation',pct:88}] },
    { id:'f3', name:'GridIron Model', handle:'@gridiron_model', org:'GridIron Analytics', cat:'Sports', acc:88, resolved:388, pending:11, conf:70, verified:true, avatar:'#B4571F', initials:'GI', bio:'Automated game model. Spreads, totals, and moneyline across the NFL and NCAA.', spark:[85,86,88,87,89,88,88,90], breakdown:[{label:'Spreads',pct:89},{label:'Totals',pct:86},{label:'Moneyline',pct:90}] },
    { id:'f4', name:'Priya Anand', handle:'@priyapolls', org:'Meridian Polling', cat:'Politics', acc:79, resolved:96, pending:5, conf:62, verified:true, avatar:'#9A3B5A', initials:'PA', bio:'Pollster and elections analyst. Senate, House, and turnout modeling.', spark:[76,78,80,79,81,78,80,79], breakdown:[{label:'Senate',pct:82},{label:'House',pct:77},{label:'Turnout',pct:70}] },
    { id:'f5', name:'Chip Delgado', handle:'@chipcalls', org:'Business-channel contributor', cat:'Financial', acc:61, resolved:74, pending:8, conf:70, verified:false, avatar:'#3C6E4F', initials:'CD', bio:'On-air stock picker with a taste for bold single-name targets.', spark:[66,63,60,64,59,62,60,61], breakdown:[{label:'Single stocks',pct:58},{label:'Crypto',pct:55},{label:'Macro',pct:68}] },
    { id:'f6', name:'Bea Okafor', handle:'@beahoops', org:'The Courtline', cat:'Sports', acc:82, resolved:168, pending:7, conf:60, verified:true, avatar:'#C2703A', initials:'BO', bio:'NBA writer. Playoff brackets, award races, and player props.', spark:[80,82,81,83,82,84,82,83], breakdown:[{label:'Playoffs',pct:85},{label:'Awards',pct:74},{label:'Player props',pct:82}] },
    { id:'f7', name:'Ellis Tran', handle:'@transtorms', org:'StormPath', cat:'Weather', acc:86, resolved:233, pending:5, conf:70, verified:true, avatar:'#35618C', initials:'ET', bio:'Seasonal and severe-weather forecaster covering the continental US.', spark:[84,85,86,85,87,86,87,86], breakdown:[{label:'Winter',pct:88},{label:'Seasonal',pct:85},{label:'Severe',pct:84}] },
    { id:'f8', name:'Ron Vance', handle:'@vancetake', org:'independent pundit', cat:'Politics', acc:54, resolved:61, pending:9, conf:63, verified:false, avatar:'#8A4A6B', initials:'RV', bio:'Cable-news regular known for confident, contrarian predictions.', spark:[58,55,53,56,52,54,55,54], breakdown:[{label:'Elections',pct:52},{label:'Scandals',pct:58}] },
    { id:'f9', name:'Aisha Kamara', handle:'@aishafx', org:'independent FX trader', cat:'Financial', acc:73, resolved:119, pending:6, conf:60, verified:false, avatar:'#237A6B', initials:'AK', bio:'Currency trader. Major pairs, emerging-market FX, and intervention calls.', spark:[70,72,71,74,73,72,74,73], breakdown:[{label:'Majors',pct:76},{label:'EM FX',pct:68},{label:'Intervention',pct:72}] },
    { id:'f10', name:'Ray Dellinger', handle:'@coachdell', org:'former coach, analyst', cat:'Sports', acc:67, resolved:88, pending:4, conf:58, verified:false, avatar:'#A85A2E', initials:'RD', bio:'Retired coach turned broadcaster with strong takes on team results.', spark:[64,66,68,65,69,66,67,68], breakdown:[{label:'Team results',pct:64},{label:'Player props',pct:71}] },
    { id:'f11', name:'Nate Brioux', handle:'@briouxmodel', org:'Brioux Electoral Model', cat:'Politics', acc:90, resolved:174, pending:3, conf:82, verified:true, avatar:'#6B4E9E', initials:'NB', bio:'Aggregation-based election model with a long calibrated track record.', spark:[88,90,89,91,92,91,90,91], breakdown:[{label:'General',pct:92},{label:'Primaries',pct:87},{label:'Senate',pct:90}] }
  ];

  P = [
    { id:'p1', f:'f1', claim:'The Fed cuts rates by 50bps at the September 2025 meeting.', conf:70, status:'incorrect', date:'Aug 4, 2025', resolvedDate:'Sep 17, 2025', method:'auto', outcome:'The FOMC cut by 25bps, half the size of the predicted move. A larger cut was never seriously on the table in the minutes.', source:'FOMC statement, Sep 2025', agree:412, dispute:18, impact:-1.1 },
    { id:'p2', f:'f1', claim:'The S&P 500 closes above 6,000 before year-end 2025.', conf:65, status:'correct', date:'Jun 12, 2025', resolvedDate:'Nov 6, 2025', method:'auto', outcome:'The index first closed above 6,000 in early November, comfortably ahead of the deadline.', source:'Market close data', agree:388, dispute:9, impact:0.5 },
    { id:'p3', f:'f1', claim:'Nvidia beats consensus on Q2 FY26 earnings.', conf:80, status:'correct', date:'Jul 30, 2025', resolvedDate:'Aug 27, 2025', method:'auto', outcome:'Reported EPS and revenue both came in above the Street consensus at the print.', source:'Company earnings release', agree:501, dispute:12, impact:0.4 },
    { id:'p4', f:'f1', claim:'Brent crude falls below $65/bbl during Q1 2026.', conf:55, status:'pending', date:'Dec 2, 2025', resolvedDate:'', method:'auto', outcome:'', source:'', agree:0, dispute:0, impact:0 },

    { id:'p5', f:'f2', claim:'Hurricane Elena makes landfall as a Category 3 on the Gulf coast.', conf:75, status:'correct', date:'Sep 1, 2025', resolvedDate:'Sep 9, 2025', method:'editorial', outcome:'Elena came ashore near the Florida panhandle as a strong Category 3, matching the forecast intensity and region.', source:'NHC post-storm report', agree:640, dispute:22, impact:0.3 },
    { id:'p6', f:'f2', claim:'The 2025 Atlantic season produces 18 or more named storms.', conf:80, status:'correct', date:'May 20, 2025', resolvedDate:'Nov 30, 2025', method:'auto', outcome:'The season closed with 19 named storms, exceeding the threshold.', source:'NOAA season summary', agree:410, dispute:7, impact:0.3 },
    { id:'p7', f:'f2', claim:'A July heat dome pushes Phoenix past 115°F on three consecutive days.', conf:85, status:'correct', date:'Jul 2, 2025', resolvedDate:'Jul 21, 2025', method:'auto', outcome:'Phoenix recorded four straight days at or above 115°F during the mid-July ridge.', source:'NWS Phoenix records', agree:355, dispute:5, impact:0.3 },

    { id:'p8', f:'f3', claim:'The Chiefs win the AFC West.', conf:82, status:'correct', date:'Sep 3, 2025', resolvedDate:'Jan 5, 2026', method:'auto', outcome:'Kansas City clinched the division in Week 17.', source:'League standings', agree:290, dispute:14, impact:0.2 },
    { id:'p9', f:'f3', claim:'The underdog covers the spread in the Rose Bowl.', conf:60, status:'incorrect', date:'Dec 20, 2025', resolvedDate:'Jan 1, 2026', method:'auto', outcome:'The favorite won by more than the number, so the underdog did not cover.', source:'Final score + closing line', agree:180, dispute:31, impact:-0.6 },
    { id:'p10', f:'f3', claim:'Over 47.5 total points in Week 3 Monday Night Football.', conf:58, status:'correct', date:'Sep 19, 2025', resolvedDate:'Sep 22, 2025', method:'auto', outcome:'The teams combined for 51 points, clearing the total.', source:'Final box score', agree:210, dispute:8, impact:0.3 },

    { id:'p11', f:'f4', claim:'The incumbent wins the Ohio Senate race by 3–6 points.', conf:68, status:'correct', date:'Oct 1, 2025', resolvedDate:'Nov 4, 2025', method:'editorial', outcome:'Final certified margin was 4.2 points, inside the predicted band.', source:'State certified results', agree:260, dispute:41, impact:0.3 },
    { id:'p12', f:'f4', claim:'Turnout exceeds 62% in the special election.', conf:55, status:'incorrect', date:'Sep 10, 2025', resolvedDate:'Oct 14, 2025', method:'auto', outcome:'Turnout came in at 58%, short of the threshold.', source:'Secretary of State report', agree:145, dispute:22, impact:-0.5 },

    { id:'p13', f:'f5', claim:'Tesla reaches $400 by the end of Q4 2025.', conf:75, status:'incorrect', date:'Aug 15, 2025', resolvedDate:'Dec 31, 2025', method:'auto', outcome:'The stock peaked in the mid-$300s and never touched $400 in the window.', source:'Market close data', agree:198, dispute:36, impact:-1.3 },
    { id:'p14', f:'f5', claim:'Regional banks rally 20% within a month of the first rate cut.', conf:60, status:'partial', date:'Aug 20, 2025', resolvedDate:'Oct 20, 2025', method:'editorial', outcome:'The sector index rose about 12% — a clear rally, but well short of the 20% called.', source:'Sector ETF performance', agree:120, dispute:58, impact:-0.4 },
    { id:'p15', f:'f5', claim:'Bitcoin breaks $100k before June 2026.', conf:70, status:'pending', date:'Jan 8, 2026', resolvedDate:'', method:'auto', outcome:'', source:'', agree:0, dispute:0, impact:0 },

    { id:'p16', f:'f6', claim:'The Celtics reach the Eastern Conference Finals.', conf:70, status:'correct', date:'Apr 12, 2026', resolvedDate:'May 28, 2026', method:'auto', outcome:'Boston advanced past the second round to the conference finals.', source:'Playoff results', agree:220, dispute:12, impact:0.3 },
    { id:'p17', f:'f6', claim:'MVP goes to the reigning scoring leader.', conf:55, status:'incorrect', date:'Jan 5, 2026', resolvedDate:'Jun 24, 2026', method:'community', outcome:'The award went to a different player; the scoring leader finished third in voting.', source:'Official award ballot', agree:98, dispute:44, impact:-0.5 },

    { id:'p18', f:'f7', claim:'First hard frost in the upper Midwest by October 10.', conf:72, status:'correct', date:'Sep 15, 2025', resolvedDate:'Oct 6, 2025', method:'auto', outcome:'Widespread frost was observed across the region on October 5–6.', source:'NWS observations', agree:180, dispute:6, impact:0.3 },
    { id:'p19', f:'f7', claim:'Sierra snowpack ends the season above 110% of normal.', conf:65, status:'correct', date:'Dec 1, 2025', resolvedDate:'Apr 1, 2026', method:'auto', outcome:'April 1 measurements came in at 118% of the seasonal average.', source:'State snow survey', agree:150, dispute:9, impact:0.3 },

    { id:'p20', f:'f8', claim:'The governor resigns before the primary.', conf:65, status:'incorrect', date:'Feb 2, 2026', resolvedDate:'May 1, 2026', method:'editorial', outcome:'The governor did not resign and appeared on the primary ballot.', source:'Official candidate filing', agree:60, dispute:88, impact:-1.4 },
    { id:'p21', f:'f8', claim:'A third-party candidate takes more than 10% nationally.', conf:60, status:'incorrect', date:'Mar 10, 2026', resolvedDate:'Jun 5, 2026', method:'auto', outcome:'Third-party support polled and finished in the low single digits.', source:'Aggregated results', agree:45, dispute:71, impact:-0.9 },

    { id:'p22', f:'f9', claim:'EUR/USD tests 1.15 by Q4 2025.', conf:62, status:'correct', date:'Jul 1, 2025', resolvedDate:'Nov 14, 2025', method:'auto', outcome:'The pair traded up to 1.152 in mid-November.', source:'FX tick data', agree:130, dispute:11, impact:0.3 },
    { id:'p23', f:'f9', claim:'Authorities intervene to defend the yen below 160.', conf:58, status:'partial', date:'Aug 5, 2025', resolvedDate:'Oct 2, 2025', method:'editorial', outcome:'Verbal intervention occurred but no confirmed direct market operation below 160.', source:'Central bank communications', agree:88, dispute:39, impact:-0.3 },

    { id:'p24', f:'f10', claim:'The Cowboys make the playoffs.', conf:60, status:'incorrect', date:'Sep 2, 2025', resolvedDate:'Jan 5, 2026', method:'auto', outcome:'Dallas finished 8-9 and missed the postseason.', source:'League standings', agree:140, dispute:26, impact:-0.7 },
    { id:'p25', f:'f10', claim:'A rookie quarterback throws for 4,000 yards.', conf:55, status:'correct', date:'Sep 2, 2025', resolvedDate:'Jan 5, 2026', method:'auto', outcome:'A rookie passer finished the regular season with 4,180 yards.', source:'League passing stats', agree:110, dispute:14, impact:0.3 },

    { id:'p26', f:'f11', claim:'The model calls 48 of 50 states correctly in the general election.', conf:88, status:'correct', date:'Sep 1, 2025', resolvedDate:'Nov 4, 2025', method:'editorial', outcome:'The final map missed only two close states, matching the stated benchmark.', source:'Certified state results', agree:520, dispute:24, impact:0.2 },
    { id:'p27', f:'f11', claim:'Senate control is decided by a single seat.', conf:70, status:'correct', date:'Sep 1, 2025', resolvedDate:'Nov 12, 2025', method:'auto', outcome:'The chamber flipped on the final called race, a one-seat majority.', source:'Certified results', agree:340, dispute:19, impact:0.3 }
  ];

  gradeFor(a) {
    if (a >= 90) return { g:'A', c:'#1B7A4B' };
    if (a >= 80) return { g:'B', c:'#4E9A3D' };
    if (a >= 70) return { g:'C', c:'#C69214' };
    if (a >= 60) return { g:'D', c:'#D9761E' };
    return { g:'F', c:'#BC2E29' };
  }
  hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n>>16&255) + ',' + (n>>8&255) + ',' + (n&255) + ',' + a + ')';
  }
  spark(arr, w, h) {
    const pad = 4, mn = Math.min(...arr), mx = Math.max(...arr), rng = (mx - mn) || 1;
    return arr.map((v, i) => {
      const x = pad + i * (w - 2*pad) / (arr.length - 1);
      const y = h - pad - ((v - mn) / rng) * (h - 2*pad);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
  }
  statusMeta(s) {
    if (s === 'correct')   return { label:'Correct',   color:'#1B7A4B', tint:'#E6F1EA', border:'#BEDDCB', icon:'M20 6L9 17l-5-5', method:1 };
    if (s === 'incorrect') return { label:'Incorrect', color:'#BC2E29', tint:'#F6E4E2', border:'#E6C3BF', icon:'M18 6L6 18M6 6l12 12' };
    if (s === 'partial')   return { label:'Partial',   color:'#C69214', tint:'#F6EED9', border:'#E4D3A6', icon:'M5 12h14' };
    return { label:'Pending', color:'#8A8375', tint:'#F0ECE1', border:'#DED6C6', icon:'M12 7v5l3 2' };
  }
  methodMeta(m) {
    if (m === 'auto')      return { label:'Auto-resolved from data', color:'#2E6BA6' };
    if (m === 'editorial') return { label:'Editorial review', color:'#9A3B5A' };
    return { label:'Community verified', color:'#B4571F' };
  }

  openF = (id) => { this.setState({ view:'profile', fId:id }); window.scrollTo({ top:0 }); };
  openP = (id) => { this.setState({ view:'prediction', pId:id }); window.scrollTo({ top:0 }); };
  goHome = () => { this.setState({ view:'home' }); window.scrollTo({ top:0 }); };
  setCat = (c) => { this.setState({ cat:c, view:'home', topicQ:'' }); window.scrollTo({ top:0 }); };

  submit = () => {
    if (this._t) clearTimeout(this._t);
    const c = (this.state.mClaim || '').trim();
    this.setState({ modal:false, toast: c ? 'Logged — "' + (c.length > 46 ? c.slice(0,46) + '…' : c) + '" is now pending.' : 'Prediction logged — now pending resolution.',
      mClaim:'', mCat:'Financial', mConf:65, mDeadline:'' });
    this._t = setTimeout(() => this.setState({ toast:'' }), 2800);
  };

  renderVals() {
    const s = this.state;
    const cats = ['Financial','Sports','Weather','Politics'];

    // rank within each category by accuracy
    const rankMap = {};
    cats.forEach(c => {
      this.F.filter(f => f.cat === c).sort((a,b) => b.acc - a.acc).forEach((f,i) => { rankMap[f.id] = i + 1; });
    });

    // ---- HOME rows (topic search takes precedence over name search)
    const q = (s.q || '').toLowerCase().trim();
    const tq = (s.topicQ || '').toLowerCase().trim();
    const scopeCats = s.cat === 'All' ? cats : [s.cat];

    // topic universe (unique focus labels) for the suggestion chips
    const seenT = {}, topicUniverse = [];
    this.F.filter(f => scopeCats.includes(f.cat)).forEach(f => f.breakdown.forEach(b => {
      const k = b.label.toLowerCase();
      if (!seenT[k]) { seenT[k] = 1; topicUniverse.push(b.label); }
    }));
    const topicChips = topicUniverse.map(label => {
      const active = label.toLowerCase() === tq;
      return { label,
        style: 'padding:7px 13px;border-radius:20px;font-size:13px;cursor:pointer;' + (active
          ? 'font-weight:600;background:#15503A;color:#F4F0E8;border:1px solid #15503A;'
          : 'font-weight:500;background:#F1ECE0;color:#4A4438;border:1px solid #E3DCCD;'),
        onClick: () => this.setState({ topicQ: active ? '' : label }) };
    });
    const phMap = {
      Financial: 'Try “rates”, “equities”, “crypto”, “FX”, “macro”…',
      Sports: 'Try “spreads”, “playoffs”, “player props”, “totals”…',
      Weather: 'Try “hurricanes”, “heat”, “winter”, “severe”…',
      Politics: 'Try “senate”, “turnout”, “primaries”, “polls”…',
      All: 'Search any call — rates, hurricanes, playoffs, senate…'
    };

    let rows, rankNote = 'ranked by career accuracy', accHeader = 'Accuracy', focusHeader = 'Focus';
    if (tq) {
      const matched = [];
      this.F.filter(f => scopeCats.includes(f.cat)).forEach(f => {
        let best = null;
        f.breakdown.forEach(b => {
          const bl = b.label.toLowerCase();
          if (bl.includes(tq) || tq.includes(bl)) { if (!best || b.pct > best.pct) best = { label:b.label, pct:b.pct }; }
        });
        if (!best) {
          const pr = this.P.find(x => x.f === f.id && x.claim.toLowerCase().includes(tq));
          if (pr) best = { label:'Mentioned in a call', pct:f.acc };
          else if (f.name.toLowerCase().includes(tq) || f.handle.toLowerCase().includes(tq) || f.org.toLowerCase().includes(tq)) best = { label:f.cat, pct:f.acc };
        }
        if (best) matched.push({ f, best });
      });
      matched.sort((a,b) => b.best.pct - a.best.pct);
      rows = matched.map((m, i) => {
        const f = m.f, val = m.best.pct, gr = this.gradeFor(val), cm = this.CATCOLORS[f.cat];
        return { rank:i+1, name:f.name, handle:f.handle, org:f.org, initials:f.initials, avatar:f.avatar,
          verified:f.verified, primaryCat:m.best.label, catColor:cm.color, catTint:cm.tint, resolved:f.resolved,
          accuracy:val, grade:gr.g, gradeColor:gr.c, gradeTint:this.hexA(gr.c,0.12),
          spark:this.spark(f.spark,132,34), open:() => this.openF(f.id) };
      });
      rankNote = 'ranked by accuracy on this call type';
      accHeader = 'On topic';
      focusHeader = 'Matched focus';
    } else {
      let list = this.F.filter(f => (s.cat === 'All' || f.cat === s.cat) &&
        (!q || f.name.toLowerCase().includes(q) || f.handle.toLowerCase().includes(q) || f.org.toLowerCase().includes(q)));
      list = list.sort((a,b) => b.acc - a.acc);
      rows = list.map((f, i) => {
        const gr = this.gradeFor(f.acc), cm = this.CATCOLORS[f.cat];
        return { rank:i+1, name:f.name, handle:f.handle, org:f.org, initials:f.initials, avatar:f.avatar,
          verified:f.verified, primaryCat:f.cat, catColor:cm.color, catTint:cm.tint, resolved:f.resolved,
          accuracy:f.acc, grade:gr.g, gradeColor:gr.c, gradeTint:this.hexA(gr.c,0.12),
          spark:this.spark(f.spark,132,34), open:() => this.openF(f.id) };
      });
    }

    const categories = ['All', ...cats].map(c => ({ label:c, active:s.cat === c, onClick:() => this.setCat(c) }));
    const boardTitle = tq ? 'Best on “' + (s.topicQ || '').trim() + '”' : (s.cat === 'All' ? 'Leaderboard' : s.cat + ' forecasters');
    const totalResolved = this.F.reduce((a,f) => a + f.resolved, 0);

    // ---- PROFILE
    let p = null;
    if (s.view === 'profile' && s.fId) {
      const f = this.F.find(x => x.id === s.fId);
      if (f) {
        const gr = this.gradeFor(f.acc);
        const diff = f.acc - f.conf;
        const calib = diff > 4 ? { label:'Underconfident.', c:'#1B7A4B' } : diff < -4 ? { label:'Overconfident.', c:'#BC2E29' } : { label:'Well calibrated.', c:'#2E6BA6' };
        const preds = this.P.filter(x => x.f === f.id).map(x => {
          const sm = this.statusMeta(x.status), cm = this.CATCOLORS[f.cat];
          const imp = x.status === 'pending' ? '—' : (x.impact > 0 ? '+' : '') + x.impact.toFixed(1) + ' pts';
          const impC = x.status === 'pending' ? '#A79E8C' : x.impact > 0 ? '#1B7A4B' : '#BC2E29';
          return { claim:x.claim, primaryCat:f.cat, date:x.date, conf:x.conf, statusLabel:sm.label,
            statusColor:sm.color, statusTint:sm.tint, impact:imp, impactColor:impC, open:() => this.openP(x.id) };
        });
        const cm = this.CATCOLORS[f.cat];
        p = { name:f.name, handle:f.handle, org:f.org, initials:f.initials, avatar:f.avatar, verified:f.verified,
          bio:f.bio, primaryCat:f.cat, catColor:cm.color, catTint:cm.tint,
          accuracy:f.acc, grade:gr.g, gradeColor:gr.c, gradeTint:this.hexA(gr.c,0.12),
          resolved:f.resolved, pending:f.pending, rankInCat:rankMap[f.id], avgConf:f.conf,
          calibLabel:calib.label, calibColor:calib.c, heroSpark:this.spark(f.spark,220,52),
          breakdown:f.breakdown.map(b => { const g = this.gradeFor(b.pct); return { label:b.label, pct:b.pct, color:g.c, width:b.pct + '%' }; }),
          predictions:preds };
      }
    }

    // ---- PREDICTION DETAIL
    let d = null;
    if (s.view === 'prediction' && s.pId) {
      const x = this.P.find(y => y.id === s.pId);
      if (x) {
        const f = this.F.find(y => y.id === x.f);
        const sm = this.statusMeta(x.status), mm = this.methodMeta(x.method), cm = this.CATCOLORS[f.cat];
        const total = x.agree + x.dispute;
        const ap = total ? Math.round(x.agree / total * 100) : 0;
        const imp = x.status === 'pending' ? '—' : (x.impact > 0 ? '+' : '') + x.impact.toFixed(1) + ' pts';
        const impC = x.status === 'pending' ? '#8A8375' : x.impact > 0 ? '#1B7A4B' : '#BC2E29';
        d = { claim:x.claim, primaryCat:f.cat, catColor:cm.color, catTint:cm.tint, date:x.date, conf:x.conf,
          fName:f.name, handle:f.handle, initials:f.initials, avatar:f.avatar, accuracy:f.acc,
          statusLabel:sm.label, statusColor:sm.color, statusTint:sm.tint, statusBorder:sm.border, statusIcon:sm.icon,
          methodLabel:mm.label, methodColor:mm.color,
          outcome:x.status === 'pending' ? 'This prediction has not resolved yet. It stays pending — and out of the grade — until the outcome is known.' : x.outcome,
          source:x.source || 'Awaiting resolution', impact:imp, impactColor:impC,
          impactArrow: x.impact >= 0 ? 'M14 7h7v7' : 'M14 17h7v-7',
          agree:x.agree, dispute:x.dispute, agreePct:ap, disputePct:100 - ap, agreeW:ap + '%', disputeW:(100 - ap) + '%',
          backToProfile:() => this.openF(f.id), openForecaster:() => this.openF(f.id) };
      }
    }

    return {
      goHome:this.goHome, categories, q:s.q, onSearch:e => this.setState({ q:e.target.value }),
      openModal:() => this.setState({ modal:true }),
      isHome:s.view === 'home', isProfile:s.view === 'profile' && !!p, isPrediction:s.view === 'prediction' && !!d,
      stat:{ forecasters:this.F.length, resolved:totalResolved.toLocaleString() },
      boardTitle, resultCount:rows.length + (rows.length === 1 ? ' forecaster' : ' forecasters'),
      rankNote, accHeader, focusHeader,
      topicQ:s.topicQ, onTopic:e => this.setState({ topicQ:e.target.value }), clearTopic:() => this.setState({ topicQ:'' }),
      topicActive:!!tq, topicScope:(s.cat === 'All' ? 'ALL CATEGORIES' : s.cat.toUpperCase()),
      topicPlaceholder:phMap[s.cat] || phMap.All, topicChips,
      rows, noResults:rows.length === 0,
      p, d,
      modal:s.modal, closeModal:() => this.setState({ modal:false }), stop:e => e.stopPropagation(),
      mClaim:s.mClaim, onClaim:e => this.setState({ mClaim:e.target.value }),
      mCat:s.mCat, onMCat:e => this.setState({ mCat:e.target.value }),
      mDeadline:s.mDeadline, onDeadline:e => this.setState({ mDeadline:e.target.value }),
      mConf:s.mConf, onConf:e => this.setState({ mConf:+e.target.value }),
      submitModal:this.submit, toast:s.toast
    };
  }
}
