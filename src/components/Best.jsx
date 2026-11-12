import { css } from "../helpers.js";
import Hover from "./Hover.jsx";
import TrustFinder from "./TrustFinder.jsx";

export default function Best({ vals, openClaim }) {
  return (
    <main className="trooth-page" style={css("max-width:1180px;margin:0 auto;padding:28px 20px 56px;")}>
      <Hover as="button" onClick={vals.goHome} style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0;margin-bottom:16px;" hover="color:var(--forest);">← Home</Hover>
      <TrustFinder trust={vals.trust} openClaim={openClaim} showResults />
    </main>
  );
}
