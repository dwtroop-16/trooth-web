import { css } from "../helpers.js";
import Hover from "./Hover.jsx";

const field = "width:100%;border:1px solid var(--hair);background:var(--surface);border-radius:var(--radius);padding:7px 11px;font-size:14px;color:var(--ink);outline:none;";
const label = "display:block;font-size:11px;font-weight:600;letter-spacing:0.08em;color:var(--muted);margin-bottom:6px;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;";

export default function AccountModal({ vals }) {
  const a = vals.account;

  return (
    <div onClick={a.close} style={css("position:fixed;inset:0;z-index:40;background:rgba(26,23,18,0.42);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;animation:vScrimIn .2s ease;")}>
      <div onClick={vals.stop} style={css("background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:22px;width:100%;max-width:420px;box-shadow:0 24px 56px -28px rgba(26,23,18,0.55);animation:vFadeUp .26s ease;")}>
        <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;")}>
          <h2 style={css("font-family:Newsreader,serif;font-size:22px;font-weight:600;margin:0;color:var(--ink);")}>
            {a.isRegistered ? "Your account" : "Save your account"}
          </h2>
          <Hover as="button" onClick={a.close} style="background:none;border:none;cursor:pointer;color:var(--faint);font-size:20px;line-height:1;padding:4px;" hover="color:var(--ink);">×</Hover>
        </div>

        {a.isRegistered ? (
          <>
            <p style={css("font-size:13px;color:var(--muted);margin:0 0 18px;line-height:1.45;")}>
              Signed in as <strong style={css("color:var(--ink);")}>{a.userEmail}</strong>. Predictions you log count toward this account.
            </p>
            <Hover as="button" onClick={a.logout} disabled={a.submitting} style={"width:100%;background:var(--paper);color:var(--body);border:1px solid var(--hair);border-radius:var(--radius);padding:10px 14px;font-size:14px;font-weight:600;" + (a.submitting ? "cursor:not-allowed;opacity:0.65;" : "cursor:pointer;")} hover={a.submitting ? "" : "background:#EDE7DA;"}>
              {a.submitting ? "Signing out…" : "Log out"}
            </Hover>
          </>
        ) : (
          <>
            <p style={css("font-size:13px;color:var(--muted);margin:0 0 16px;line-height:1.45;")}>
              {a.mode === "login"
                ? "Log into an existing account. (Predictions logged as a guest stay with the guest session, not this account.)"
                : "You're currently posting as a guest. Add an email and password to keep this history under a real account — nothing you've logged is lost."}
            </p>

            <div style={css("display:flex;gap:4px;margin-bottom:16px;background:var(--paper);border-radius:var(--radius);padding:3px;")}>
              <Hover
                as="button"
                onClick={() => a.setMode("save")}
                style={"flex:1;border:none;border-radius:var(--radius-sm);padding:8px;font-size:13px;font-weight:600;cursor:pointer;" + (a.mode === "save" ? "background:var(--forest);color:var(--paper);" : "background:none;color:var(--body);")}
              >
                Save this account
              </Hover>
              <Hover
                as="button"
                onClick={() => a.setMode("login")}
                style={"flex:1;border:none;border-radius:var(--radius-sm);padding:8px;font-size:13px;font-weight:600;cursor:pointer;" + (a.mode === "login" ? "background:var(--forest);color:var(--paper);" : "background:none;color:var(--body);")}
              >
                I already have one
              </Hover>
            </div>

            <label style={css(label)}>Email</label>
            <input
              type="email"
              value={a.email}
              onChange={a.onEmail}
              placeholder="you@example.com"
              style={css(field + "margin-bottom:12px;")}
            />

            <label style={css(label)}>Password</label>
            <input
              type="password"
              value={a.password}
              onChange={a.onPassword}
              placeholder="At least 6 characters"
              style={css(field)}
            />

            <Hover
              as="button"
              onClick={a.mode === "login" ? a.login : a.save}
              disabled={a.submitting}
              style={"width:100%;margin-top:16px;background:var(--forest);color:var(--paper);border:none;border-radius:var(--radius);padding:10px 14px;font-size:14px;font-weight:600;" + (a.submitting ? "cursor:not-allowed;opacity:0.65;" : "cursor:pointer;")}
              hover={a.submitting ? "" : "background:var(--forest-deep);"}
            >
              {a.submitting ? "Working…" : a.mode === "login" ? "Log in" : "Save account"}
            </Hover>
          </>
        )}
      </div>
    </div>
  );
}
