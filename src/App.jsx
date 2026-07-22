import { useEffect, useRef, useState } from "react";
import { buildVals } from "./viewModel.js";
import { loadData } from "./dataSource.js";
import { F, P, CATCOLORS } from "./data.js";
import Header from "./components/Header.jsx";
import Home from "./components/Home.jsx";
import Profile from "./components/Profile.jsx";
import PredictionDetail from "./components/PredictionDetail.jsx";
import LogModal from "./components/LogModal.jsx";
import Toast from "./components/Toast.jsx";
import { css } from "./helpers.js";

const INITIAL = {
  view: "home", fId: null, pId: null, cat: "All", q: "", topicQ: "",
  modal: false, toast: "", mClaim: "", mCat: "Financial", mConf: 65, mDeadline: "",
};

// Bundled data renders instantly; live data from Supabase (if configured)
// replaces it once loaded. Identical content today, so no visible change.
const BUNDLED = { F, P, CATCOLORS };

export default function App() {
  const [state, setStateRaw] = useState(INITIAL);
  const [data, setData] = useState(BUNDLED);
  const toastTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    loadData()
      .then((d) => { if (alive && d.source === "supabase") setData(d); })
      .catch((err) => console.error("Trooth: live data load failed, using bundled data.", err));
    return () => { alive = false; };
  }, []);

  const setState = (patch) => setStateRaw((prev) => ({ ...prev, ...patch }));

  const scrollTop = () => window.scrollTo({ top: 0 });
  const openF = (id) => { setState({ view: "profile", fId: id }); scrollTop(); };
  const openP = (id) => { setState({ view: "prediction", pId: id }); scrollTop(); };
  const goHome = () => { setState({ view: "home" }); scrollTop(); };
  const setCat = (c) => { setState({ cat: c, view: "home", topicQ: "" }); scrollTop(); };

  const submit = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const c = (state.mClaim || "").trim();
    setState({
      modal: false,
      toast: c
        ? 'Logged — "' + (c.length > 46 ? c.slice(0, 46) + "…" : c) + '" is now pending.'
        : "Prediction logged — now pending resolution.",
      mClaim: "", mCat: "Financial", mConf: 65, mDeadline: "",
    });
    toastTimer.current = setTimeout(() => setState({ toast: "" }), 2800);
  };

  const vals = buildVals(state, { setState, openF, openP, goHome, setCat, submit }, data);

  return (
    <div style={css("min-height:100vh;background:#F4F0E8;font-family:Archivo,sans-serif;color:#1A1712;")}>
      <Header vals={vals} />
      {vals.isHome && <Home vals={vals} />}
      {vals.isProfile && <Profile vals={vals} />}
      {vals.isPrediction && <PredictionDetail vals={vals} />}
      {vals.modal && <LogModal vals={vals} />}
      {vals.toast && <Toast text={vals.toast} />}
    </div>
  );
}
