const KEY = "trooth.feedback.dismissForever";

export function isFeedbackDismissed() {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissFeedbackForever() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}
