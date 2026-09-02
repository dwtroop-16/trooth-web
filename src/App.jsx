import { useEffect, useRef, useState } from "react";
import { buildVals } from "./viewModel.js";
import { loadData, submitSourceTip } from "./dataSource.js";
import { hasSupabase, ensureSession, onAuthChange, upgradeGuest, signIn, signOut } from "./lib/supabase.js";
import { SPEAKERS, FORECASTS, ACTUALS, SCORES, CATCOLORS } from "./data.js";
import { parsePath, pathFor, normalizeDomain } from "./router.js";
import Header from "./components/Header.jsx";
import Home from "./components/Home.jsx";
import Profile from "./components/Profile.jsx";
import PredictionDetail from "./components/PredictionDetail.jsx";
import Method from "./components/Method.jsx";
import Changelog from "./components/Changelog.jsx";
import LogModal from "./components/LogModal.jsx";
import AccountModal from "./components/AccountModal.jsx";
import Toast from "./components/Toast.jsx";
import { css } from "./helpers.js";

function initialFromLocation() {
  const parsed = parsePath(window.location.pathname);
  return {
    view: parsed.view,
    speakerId: parsed.speakerId || null,
    forecastId: parsed.forecastId || null,
    cat: "All",
    q: "",
    modal: false,
    toast: "",
    mClaim: "",
    mCat: "Finance",
    mUrl: "",
    submitting: false,
    accountModal: false,
    accountMode: "save",
    aEmail: "",
    aPassword: "",
    accountSubmitting: false,
  };
}

const BUNDLED = {
  speakers: SPEAKERS,
  forecasts: FORECASTS,
  actuals: ACTUALS,
  scores: SCORES,
  CATCOLORS,
};

export default function App() {
  const [state, setStateRaw] = useState(initialFromLocation);
  const [data, setData] = useState(BUNDLED);
  const [session, setSession] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    loadData()
      .then((d) => { if (alive && d.source === "supabase") setData(d); })
      .catch((err) => console.error("Trooth: live data load failed, using bundled data.", err));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    ensureSession().then((s) => { if (alive) setSession(s); });
    const unsubscribe = onAuthChange((s) => setSession(s));
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    const onPop = () => {
      const parsed = parsePath(window.location.pathname);
      setStateRaw((prev) => ({
        ...prev,
        view: parsed.view,
        speakerId: parsed.speakerId || null,
        forecastId: parsed.forecastId || null,
      }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setState = (patch) => setStateRaw((prev) => ({ ...prev, ...patch }));
  const scrollTop = () => window.scrollTo({ top: 0 });

  const navigate = (path, patch = {}) => {
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    const parsed = parsePath(path);
    setState({
      view: parsed.view,
      speakerId: parsed.speakerId || null,
      forecastId: parsed.forecastId || null,
      ...patch,
    });
    scrollTop();
  };

  const openSpeaker = (id) => navigate(pathFor("profile", id));
  const openClaim = (id) => navigate(pathFor("prediction", id));
  const goHome = () => navigate(pathFor("home"));
  const goMethod = () => navigate(pathFor("method"));
  const goChangelog = () => navigate(pathFor("changelog"));
  const setCat = (c) => {
    navigate(pathFor("home"), { cat: normalizeDomain(c), q: "" });
  };

  const flashToast = (text) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setState({ toast: text });
    toastTimer.current = setTimeout(() => setState({ toast: "" }), 2800);
  };

  const user = session?.user || null;
  const isRegistered = !!user && user.is_anonymous === false;

  const submit = async () => {
    const url = (state.mUrl || "").trim();
    const note = (state.mClaim || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      flashToast("Paste a public source URL (http or https). Tips are not scored.");
      return;
    }
    if (!hasSupabase) {
      flashToast("Tip not stored — no backend. This is not official ingest and is never scored.");
      return;
    }
    if (!user) {
      flashToast("Couldn't verify your session — try refreshing the page.");
      return;
    }
    setState({ submitting: true });
    try {
      await submitSourceTip({
        sourceUrl: url,
        note,
        domain: normalizeDomain(state.mCat).toLowerCase(),
        userId: user.id,
      });
      setState({ modal: false, mClaim: "", mCat: "Finance", mUrl: "" });
      flashToast("Tip queued for Ingest. It is not a forecast and will not be graded.");
    } catch (err) {
      console.error("Trooth: failed to save source tip.", err);
      flashToast("Couldn't save that tip — check your connection and try again.");
    } finally {
      setState({ submitting: false });
    }
  };

  const openAccountModal = () => setState({ accountModal: true, accountMode: "save", aEmail: "", aPassword: "" });
  const closeAccountModal = () => setState({ accountModal: false });
  const setAccountMode = (mode) => setState({ accountMode: mode });

  const validateAccountForm = () => {
    const email = (state.aEmail || "").trim();
    if (!email || !email.includes("@")) {
      flashToast("Enter a valid email address.");
      return null;
    }
    if ((state.aPassword || "").length < 6) {
      flashToast("Password needs to be at least 6 characters.");
      return null;
    }
    return { email, password: state.aPassword };
  };

  const saveAccount = async () => {
    if (!hasSupabase) { flashToast("Can't save an account — the site isn't connected to a backend."); return; }
    const creds = validateAccountForm();
    if (!creds) return;
    setState({ accountSubmitting: true });
    try {
      const { user: updated } = await upgradeGuest(creds);
      setState({ accountModal: false, aEmail: "", aPassword: "" });
      flashToast(
        updated?.email_confirmed_at
          ? "Account saved — you're all set."
          : "Almost there — check your email to confirm the account."
      );
    } catch (err) {
      console.error("Trooth: failed to save account.", err);
      flashToast(err?.message || "Couldn't save that account — try again.");
    } finally {
      setState({ accountSubmitting: false });
    }
  };

  const loginAccount = async () => {
    if (!hasSupabase) { flashToast("Can't log in — the site isn't connected to a backend."); return; }
    const creds = validateAccountForm();
    if (!creds) return;
    setState({ accountSubmitting: true });
    try {
      await signIn(creds);
      setState({ accountModal: false, aEmail: "", aPassword: "" });
      flashToast("Signed in.");
    } catch (err) {
      console.error("Trooth: failed to log in.", err);
      flashToast(err?.message || "Couldn't log in — check your email and password.");
    } finally {
      setState({ accountSubmitting: false });
    }
  };

  const logoutAccount = async () => {
    setState({ accountSubmitting: true });
    try {
      await signOut();
      const sess = await ensureSession();
      setSession(sess);
      setState({ accountModal: false });
      flashToast("Signed out.");
    } catch (err) {
      console.error("Trooth: failed to sign out.", err);
      flashToast("Couldn't sign out — try again.");
    } finally {
      setState({ accountSubmitting: false });
    }
  };

  const account = {
    isRegistered,
    label: isRegistered ? (user.email || "Account") : "Guest",
    userEmail: user?.email || "",
    open: openAccountModal,
    close: closeAccountModal,
    mode: state.accountMode,
    setMode: setAccountMode,
    email: state.aEmail,
    onEmail: (e) => setState({ aEmail: e.target.value }),
    password: state.aPassword,
    onPassword: (e) => setState({ aPassword: e.target.value }),
    save: saveAccount,
    login: loginAccount,
    logout: logoutAccount,
    submitting: state.accountSubmitting,
  };

  const vals = buildVals(state, { setState, openSpeaker, openClaim, goHome, setCat, goMethod, goChangelog, submit, account }, data);

  return (
    <div style={css("min-height:100vh;background:#F4F0E8;font-family:Archivo,sans-serif;color:#1A1712;")}>
      <Header vals={vals} />
      {vals.isHome && <Home vals={vals} openClaim={openClaim} />}
      {vals.isProfile && <Profile vals={vals} openClaim={openClaim} />}
      {vals.isPrediction && <PredictionDetail vals={vals} />}
      {vals.isMethod && <Method goHome={goHome} />}
      {vals.isChangelog && <Changelog goHome={goHome} />}
      {vals.modal && <LogModal vals={vals} />}
      {vals.accountModal && <AccountModal vals={vals} />}
      {vals.toast && <Toast text={vals.toast} />}
    </div>
  );
}
