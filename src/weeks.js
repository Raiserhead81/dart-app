// ISO-Wochen (Montag-Start): Gruppierung, Verlauf, Wochen-Text.

import { computePlayerStats, statDeltas } from './stats.js';

// ISO-8601 Woche: "2026-W43"
export function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mo=0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Donnerstag dieser Woche
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const fDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNum + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function mondayOf(key) {
  const m = String(key).match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const w = parseInt(m[2], 10);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayNum);
  const d = new Date(week1Monday);
  d.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  return d;
}

export function weekLabel(key) {
  const m = String(key).match(/^(\d{4})-W(\d{2})$/);
  return m ? `KW${parseInt(m[2], 10)}` : key;
}

// Naechste N Wochen rückwaerts ab dieser Woche (inklusive), aufsteigend
export function lastWeekKeys(n, ref = new Date()) {
  const cur = isoWeekKey(ref);
  const out = [];
  let d = mondayOf(cur);
  for (let i = 0; i < n; i++) {
    out.unshift(isoWeekKey(d));
    const prev = new Date(d);
    prev.setUTCDate(d.getUTCDate() - 7);
    d = prev;
  }
  return out;
}

export function gamesInWeek(games, key) {
  return (games || []).filter(g => g.date && isoWeekKey(new Date(g.date)) === key);
}

// Wochenverlauf fuer einen Spieler: [{key, label, stats, delta}]
export function weeklyTrend(games, player, weeks = 12, ref = new Date()) {
  const keys = lastWeekKeys(weeks, ref);
  let prev = null;
  return keys.map(key => {
    const stats = computePlayerStats(gamesInWeek(games, key), player);
    const delta = prev ? statDeltas(stats, prev) : null;
    prev = stats;
    return { key, label: weekLabel(key), stats, delta };
  });
}

// Motivierender Wochen-Text mit echten Zahlen
export function weekSummaryText(week) {
  const s = week.stats;
  if (!week.delta || s.darts === 0) {
    return s.darts === 0 ? `${week.label}: keine Würfe diese Woche – Zeit für ein Training!` : `${week.label}: ${s.darts} Darts, Avg ${fmt(s.avg3)}`;
  }
  const parts = [`${week.label}:`];
  if (week.delta.avg != null) {
    parts.push(`Avg ${week.delta.avg >= 0 ? '+' : ''}${de(week.delta.avg)}`);
  }
  if (week.delta.doubles != null) {
    parts.push(`Doppel ${prevPct(week, 'doubles')}→${s.doubles.pct}%`);
  }
  if (week.delta.checkout != null) {
    parts.push(`Checkout ${prevPct(week, 'checkout')}→${s.checkout.pct}%`);
  }
  if (s.avg3 != null && week.delta.avg == null) parts.push(`Avg ${fmt(s.avg3)}`);
  if (s.darts > 0) parts.push(`${s.darts} Darts`);
  return parts.join(', ');
}

function prevPct(week, kind) {
  // Vorwochen-Wert aus delta ableiten: cur - delta
  const cur = kind === 'doubles' ? week.stats.doubles.pct : week.stats.checkout.pct;
  const dl = kind === 'doubles' ? week.delta.doubles : week.delta.checkout;
  if (cur == null || dl == null) return '?';
  return cur - dl;
}

export function fmt(x) { return x == null ? '-' : String(x).replace('.', ','); }
export function de(x) { return String(x).replace('.', ','); }
