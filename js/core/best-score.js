// ---------------------------------------------------------------------
// best-score (step 7, new): the player's best final score, persisted in
// localStorage so it survives a page reload/restart -- gives a reason
// to replay ("beat your record") instead of every run starting from a
// blank slate. Guarded with try/catch throughout: localStorage can
// throw in some contexts (private browsing, disabled storage), and
// losing this is a cosmetic nice-to-have, not something worth a hard
// failure over -- same "safe degradation" pattern already used for
// haptics elsewhere in this project.
// ---------------------------------------------------------------------
var KEY = 'copito-best-score';

export function getBestScore() {
  try {
    var raw = localStorage.getItem(KEY);
    var value = raw === null ? 0 : parseInt(raw, 10);
    return isNaN(value) ? 0 : value;
  } catch (e) {
    return 0;
  }
}

// Returns true if `score` beat (or tied a fresh) the stored best and
// was saved as the new one.
export function updateBestScore(score) {
  var rounded = Math.round(score);
  var best = getBestScore();
  if (rounded <= best) return false;
  try {
    localStorage.setItem(KEY, String(rounded));
    return true;
  } catch (e) {
    return false;
  }
}
