import { useEffect, useRef, useState } from "react";
import { buildVals } from "./viewModel.js";
import { loadData, submitPrediction } from "./dataSource.js";
import { hasSupabase, ensureSession, onAuthChange, upgradeGuest, signIn, signOut } from "./lib/supabase.js";
import { F, P, CATCOLORS } from "./data.js";
import Header from "./components/Header.jsx";
import Home from "./components/Home.jsx";
import Profile from "./components/Profile.jsx";
import PredictionDetail from "./components/PredictionDetail.jsx";
import LogModal from "./components/LogModal.jsx";
import AccountModal from "./components/AccountModal.jsx";
import Toast from "./components/Toast.jsx";
import { css } from "./helpers.js";

const INITIAL = {
  view: "home", fId: null, pId: null, cat: "All", q: "", topicQ: "",
  modal: false, toast: "", mClaim: "", mCat: "Financial", mConf: 65, mDeadline: "",
  submitting: false,
  accountModal: false, accountMode: "save", aEmail: "", aPassword: "", accountSubmitting: false,
};

// Bundled data renders instantly; live data from Supabase (if configured)
// replaces it once loaded. Identical content today, so no visible change.
const BUNDLED = { F, P, CATCOLORS };

export default function App() {
  const [state, setStateRaw] = useState(INITIAL);
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

  // Every visitor gets a session: a guest one the moment the app loads
  // (if Supabase + anonymous sign-ins are configured), or their saved
  // account if they've logged in before.
  useEffect(() => {
    let alive = true;
    ensureSession().then((s) => { if (alive) setSession(s); });
    const unsubscribe = onAuthChange((s) => setSession(s));
    return () => { alive = false; unsubscribe(); };
  }, []);

  const setState = (patch) => setStateRaw((prev) => ({ ...prev, ...patch }));

  const scrollTop = () => window.scrollTo({ top: 0 });
  const openF = (id) => { setState({ view: "profile", fId: id }); scrollTop(); };
  const openP = (id) => { setState({ view: "prediction", pId: id }); scrollTop(); };
  const goHome = () => { setState({ view: "home" }); scrollTop(); };
  const setCat = (c) => { setState({ cat: c, view: "home", topicQ: "" }); scrollTop(); };

  const flashToast = (text) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setState({ toast: text });
    toastTimer.current = setTimeout(() => setState({ toast: "" }), 2800);
  };

  const user = session?.user || null;
  const isRegistered = !!user && user.is_anonymous === false;

  const submit = async () => {
    const c = (state.mClaim || "").trim();
    if (c.length < 10) {
      flashToast("Add a bit more detail to the claim (10+ characters).");
      return;
    }
    if (!hasSupabase) {
      flashToast("Can't save right now — the site isn't connected to a backend.");
      return;
    }
    if (!user) {
      flashToast("Couldn't verify your session — try refreshing the page.");
      return;
    }

    setState({ submitting: true });
    try {
      await submitPrediction({
        claim: c,
        category: state.mCat,
        confidence: state.mConf,
        deadline: (state.mDeadline || "").trim(),
        userId: user.id,
      });
      setState({
        modal: false,
        mClaim: "", mCat: "Financial", mConf: 65, mDeadline: "",
      });
      flashToast('Logged — "' + (c.length > 46 ? c.slice(0, 46) + "…" : c) + '" is in review.');
    } catch (err) {
      console.error("Trooth: failed to save prediction.", err);
      flashToast("Couldn't save that — check your connection and try again.");
    } finally {
      setState({ submitting: false });
    }
  };

  // --- account ---------------------------------------------------------
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
      const s = await ensureSession();
      setSession(s);
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

  const vals = buildVals(state, { setState, openF, openP, goHome, setCat, submit, account }, data);

  return (
    <div style={css("min-height:100vh;background:#F4F0E8;font-family:Archivo,sans-serif;color:#1A1712;")}>
      <Header vals={vals} />
      {vals.isHome && <Home vals={vals} />}
      {vals.isProfile && <Profile vals={vals} />}
      {vals.isPrediction && <PredictionDetail vals={vals} />}
      {vals.modal && <LogModal vals={vals} />}
      {vals.accountModal && <AccountModal vals={vals} />}
      {vals.toast && <Toast text={vals.toast} />}
    </div>
  );
}
