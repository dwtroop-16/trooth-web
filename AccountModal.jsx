import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

export default function AccountModal({ vals }) {
  const a = vals.account;

  return (
    <div onClick={a.close} style={css("position:fixed;inset:0;z-index:40;background:rgba(26,23,18,0.42);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;animation:vScrimIn .2s ease;")}>
      <div onClick={vals.stop} style={css("background:#F7F4EC;border:1px solid #E3DCCD;border-radius:18px;padding:30px;width:100%;max-width:420px;box-shadow:0 30px 70px -30px rgba(26,23,18,0.6);animation:vFadeUp .26s ease;")}>
        <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;")}>
          <h2 style={css("font-family:Newsreader,serif;font-size:24px;font-weight:600;margin:0;")}>
            {a.isRegistered ? "Your account" : "Save your account"}
          </h2>
          <Hover as="button" onClick={a.close} style="background:none;border:none;cursor:pointer;color:#A79E8C;font-size:22px;line-height:1;padding:4px;" hover="color:#1A1712;">×</Hover>
        </div>

        {a.isRegistered ? (
          <>
            <p style={css("font-size:13.5px;color:#77705F;margin:0 0 22px;")}>
              Signed in as <strong style={css("color:#1A1712;")}>{a.userEmail}</strong>. Predictions you log count toward this account.
            </p>
            <Hover as="button" onClick={a.logout} disabled={a.submitting} style={"width:100%;background:#F1ECE0;color:#4A4438;border:1px solid #E3DCCD;border-radius:11px;padding:13px;font-size:14.5px;font-weight:600;" + (a.submitting ? "cursor:not-allowed;opacity:0.65;" : "cursor:pointer;")} hover={a.submitting ? "" : "background:#E9E2D2;"}>
              {a.submitting ? "Signing out…" : "Log out"}
            </Hover>
          </>
        ) : (
          <>
            <p style={css("font-size:13.5px;color:#77705F;margin:0 0 18px;")}>
              {a.mode === "login"
                ? "Log into an existing account. (Predictions logged as a guest stay with the guest session, not this account.)"
                : "You're currently posting as a guest. Add an email and password to keep this history under a real account — nothing you've logged is lost."}
            </p>

            <div style={css("display:flex;gap:4px;margin-bottom:18px;background:#F1ECE0;border-radius:9px;padding:3px;")}>
              <Hover
                as="button"
                onClick={() => a.setMode("save")}
                style={"flex:1;border:none;border-radius:7px;padding:8px;font-size:13px;font-weight:600;cursor:pointer;" + (a.mode === "save" ? "background:#15503A;color:#F4F0E8;" : "background:none;color:#4A4438;")}
              >
                Save this account
              </Hover>
              <Hover
                as="button"
                onClick={() => a.setMode("login")}
                style={"flex:1;border:none;border-radius:7px;padding:8px;font-size:13px;font-weight:600;cursor:pointer;" + (a.mode === "login" ? "background:#15503A;color:#F4F0E8;" : "background:none;color:#4A4438;")}
              >
                I already have one
              </Hover>
            </div>

            <label style={css("display:block;font-size:12px;font-weight:600;letter-spacing:0.04em;color:#4A4438;margin-bottom:7px;text-transform:uppercase;")}>Email</label>
            <input
              type="email"
              value={a.email}
              onChange={a.onEmail}
              placeholder="you@example.com"
              style={css("width:100%;border:1px solid #D9D0BF;background:#FBF9F4;border-radius:10px;padding:11px 13px;font-size:14.5px;color:#1A1712;outline:none;margin-bottom:14px;")}
            />

            <label style={css("display:block;font-size:12px;font-weight:600;letter-spacing:0.04em;color:#4A4438;margin-bottom:7px;text-transform:uppercase;")}>Password</label>
            <input
              type="password"
              value={a.password}
              onChange={a.onPassword}
              placeholder="At least 6 characters"
              style={css("width:100%;border:1px solid #D9D0BF;background:#FBF9F4;border-radius:10px;padding:11px 13px;font-size:14.5px;color:#1A1712;outline:none;")}
            />

            <Hover
              as="button"
              onClick={a.mode === "login" ? a.login : a.save}
              disabled={a.submitting}
              style={"width:100%;margin-top:20px;background:#15503A;color:#F4F0E8;border:none;border-radius:11px;padding:14px;font-size:15px;font-weight:600;" + (a.submitting ? "cursor:not-allowed;opacity:0.65;" : "cursor:pointer;")}
              hover={a.submitting ? "" : "background:#0E3A29;"}
            >
              {a.submitting ? "Working…" : a.mode === "login" ? "Log in" : "Save account"}
            </Hover>
          </>
        )}
      </div>
    </div>
  );
}
