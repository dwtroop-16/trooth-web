/** Legal BLOCK-class hosts for user-submitted forecast URLs. Kept out of the SPA bundle. */
export const BLOCKED_SUBMIT_HOSTS = [
  "newsweek.com",
  "heisman.com",
  "nbcsports.com",
  "marketscreener.com",
  "247wallst.com",
  "gurufocus.com",
  "tradingkey.com",
  "deseret.com",
  "deseretnews.com",
  "patriots.com",
  "kpmg.com",
  "chicagobears.com",
  "49ers.com",
];

export function hostOf(url) {
  try {
    return new URL(String(url).trim()).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isBlockedSubmitHost(url) {
  const host = hostOf(url);
  if (!host) return true;
  return BLOCKED_SUBMIT_HOSTS.some((d) => host === d || host.endsWith("." + d));
}
