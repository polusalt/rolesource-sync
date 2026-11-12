// First seen, last checked and closed, kept between syncs (PRD B4: closed jobs are removed every sync).
const DAY = 86400000;

/**
 * Update the state with this sync's live jobs.
 * @param {{jobs:Object<string,{firstSeen:string,lastChecked?:string,closedAt?:string}>}} state  changed in place
 * @param {{id:string}[]} jobs  live jobs this sync (dates are written onto them)
 * @param {string} nowIso
 * @param {number} forgetAfterDays  closed jobs are forgotten after this many days
 * @returns {string[]} ids that closed in this sync
 */
export function updateState(state, jobs, nowIso, forgetAfterDays = 90) {
  const now = new Date(nowIso);
  const live = new Set(jobs.map(j => j.id));
  for (const j of jobs) {
    const s = state.jobs[j.id] ?? { firstSeen: nowIso };
    // A job kept from a board that failed to load was NOT checked today: keep its old date.
    if (!j.stale || !s.lastChecked) s.lastChecked = nowIso;
    delete s.closedAt; // a job can come back (an employer reopens it): it keeps its first-seen date
    state.jobs[j.id] = s;
    j.firstSeen = s.firstSeen;
    j.lastChecked = s.lastChecked;
  }
  const closed = [];
  for (const [id, s] of Object.entries(state.jobs)) {
    if (!live.has(id) && !s.closedAt) { s.closedAt = nowIso; closed.push(id); }
    if (s.closedAt && (now - new Date(s.closedAt)) / DAY > forgetAfterDays) delete state.jobs[id];
  }
  return closed;
}

/** Whether a failed board's jobs from the last good sync should be kept (PRD B4: at most 2 days). */
export function keepFailedBoard(failingSinceIso, nowIso, keepDays = 2) {
  return (new Date(nowIso) - new Date(failingSinceIso)) / DAY <= keepDays;
}
