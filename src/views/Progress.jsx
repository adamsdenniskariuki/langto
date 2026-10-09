import { useCourse } from '../components/context.js';
import { Bar } from '../components/Ring.jsx';
import { useStore } from '../lib/store.js';
import { BADGES } from '../lib/badges.js';
import { currentStreak, lessonsDone, levelFromXP, MAX_FREEZES } from '../lib/gamify.js';
import { lastNDays } from '../lib/date.js';

export function Progress() {
  const course = useCourse();
  const s = useStore();
  const done = s.lessons[course.lang.code] || {};
  const lvl = levelFromXP(s.xp);
  const streak = currentStreak(s);
  const days = lastNDays(14);
  const maxDay = Math.max(s.settings.dailyGoal, ...days.map((d) => s.xpLog[d] || 0));
  const sp = s.speaking;
  const earned = BADGES.filter((b) => s.badges[b.id]).length;

  return (
    <section class="page">
      <h1>🏅 Progress</h1>

      <div class="stat-grid">
        <div class="stat"><span class="stat-num">🔥 {streak.count}</span><span>day streak</span></div>
        <div class="stat"><span class="stat-num">{s.streak.best}</span><span>best streak</span></div>
        <div class="stat"><span class="stat-num">❄️ {s.streak.freezes}/{MAX_FREEZES}</span><span>streak freezes</span></div>
        <div class="stat"><span class="stat-num">⭐ {s.xp}</span><span>total XP</span></div>
      </div>
      <p class="muted small">Earn a streak freeze every 7 days in a row. A freeze automatically protects your streak if you miss a day.</p>

      <div class="card">
        <div class="row between"><h2>Level {lvl.level}</h2><span class="muted small">{lvl.current} / {lvl.needed} XP to level {lvl.level + 1}</span></div>
        <Bar value={lvl.current} max={lvl.needed} />
      </div>

      <div class="card">
        <h2>{course.lang.flag} {course.lang.name} — CEFR path</h2>
        {course.levels.map((level) => {
          const ids = level.units.flatMap((u) => u.lessons.map((l) => l.id));
          const n = ids.filter((id) => done[id]?.done).length;
          return (
            <div class="cefr-row" key={level.id}>
              <span class="cefr">{level.id}</span>
              <div class="grow">
                <div class="row between small"><span>{level.title}</span><span class="muted">{level.comingSoon ? 'coming soon' : `${n}/${ids.length} lessons`}</span></div>
                <Bar value={n} max={ids.length || 1} tone={n && n === ids.length ? 'success' : ''} />
              </div>
            </div>
          );
        })}
      </div>

      <div class="card">
        <h2>🎙️ Speaking</h2>
        <div class="stat-grid">
          <div class="stat"><span class="stat-num">{(sp.seconds / 60).toFixed(1)}</span><span>minutes spoken</span></div>
          <div class="stat"><span class="stat-num">{sp.sentences}</span><span>sentences said</span></div>
          <div class="stat"><span class="stat-num">{sp.dialogues}</span><span>dialogues completed</span></div>
          <div class="stat"><span class="stat-num">{sp.prompts}</span><span>quick answers</span></div>
          <div class="stat"><span class="stat-num">{sp.attempts ? Math.round((sp.sentences / sp.attempts) * 100) : 0}%</span><span>clear on 1st try</span></div>
          <div class="stat"><span class="stat-num">{sp.aces}</span><span>95%+ scores</span></div>
        </div>
      </div>

      <div class="card">
        <h2>📅 Last 14 days</h2>
        <div class="chart" role="img" aria-label="XP earned per day over the last 14 days">
          {days.map((d) => {
            const v = s.xpLog[d] || 0;
            return (
              <div class="chart-col" key={d} title={`${d}: ${v} XP`}>
                <span class={`chart-bar ${v >= s.settings.dailyGoal ? 'met' : ''}`} style={{ height: `${(v / maxDay) * 100}%` }} />
                <span class="tiny">{new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            );
          })}
        </div>
        <p class="muted small">{lessonsDone(s)} lessons completed · {s.reviews || 0} reviews · daily goal hit {s.goalsMet || 0} times</p>
      </div>

      <div class="card">
        <h2>🏆 Badges <span class="muted small">{earned}/{BADGES.length}</span></h2>
        <ul class="badges">
          {BADGES.map((b) => {
            const got = s.badges[b.id];
            return (
              <li key={b.id} class={`badge ${got ? 'earned' : 'locked'}`} title={b.desc}>
                <span class="badge-icon" aria-hidden="true">{got ? b.icon : '🔒'}</span>
                <strong>{b.name}</strong>
                <span class="tiny muted">{got ? `Earned ${got}` : b.desc}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
