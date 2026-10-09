import { useCourse } from '../components/context.js';
import { Bar, Ring } from '../components/Ring.jsx';
import { Flag } from '../components/Flag.jsx';
import { update, useStore } from '../lib/store.js';
import { currentStreak, levelFromXP } from '../lib/gamify.js';
import { dateKey } from '../lib/date.js';
import { dueCards } from '../lib/srs.js';
import { isUnlocked, levelReached, nextLessonId } from '../lib/content.js';
import { KINDS, kindOf } from '../lib/lesson.js';

export function Home() {
  const course = useCourse();
  const s = useStore();
  const lang = course.lang.code;
  const done = s.lessons[lang] || {};
  const starts = s.levelStarts?.[lang] || {};
  const next = nextLessonId(course, done, starts);
  const nextEntry = next && course.lessonIndex.get(next);
  const nextLevel = nextEntry?.level.id;
  const today = s.xpLog[dateKey()] || 0;
  const streak = currentStreak(s);
  const lvl = levelFromXP(s.xp);
  const due = dueCards(s.cards[lang]).length;
  const ctx = { course, done, starts, next };

  return (
    <div class="home">
      <section class="hero card">
        <div class="hero-text">
          <p class="eyebrow"><Flag code={course.lang.code} /> {course.course.title}</p>
          <h1>{greeting(course.lang)}!</h1>
          <p class="muted">
            {streak.count > 0
              ? streak.doneToday
                ? `🔥 ${streak.count}-day streak — you've practised today.`
                : `🔥 ${streak.count}-day streak — practise today to keep it${streak.frozen ? ' (a freeze is covering you)' : ''}!`
              : 'Start a streak today — just one lesson.'}
          </p>
          {nextEntry ? (
            <a class="btn primary big" href={`#/lesson/${next}`}>
              ▶ {Object.keys(done).length ? 'Continue' : 'Start'}: {nextEntry.lesson.title}
            </a>
          ) : (
            <p class="lead">🎓 You've finished every available lesson! Keep your speaking sharp in Review and Speak.</p>
          )}
          {due > 0 && (
            <a class="btn ghost" href="#/review">
              🔁 {due} phrase{due > 1 ? 's' : ''} to review
            </a>
          )}
        </div>
        <div class="hero-rings">
          <Ring value={today} max={s.settings.dailyGoal} size={92} label={`Daily goal: ${today} of ${s.settings.dailyGoal} XP`}>
            <strong>{today}</strong>
            <span class="tiny">/ {s.settings.dailyGoal} XP</span>
          </Ring>
          <div class="level-mini">
            <span>Level {lvl.level}</span>
            <Bar value={lvl.current} max={lvl.needed} />
          </div>
        </div>
      </section>

      {(course.tracks || []).map((track) => <Track key={track.id} track={track} ctx={ctx} />)}

      {course.levels.map((level) => {
        const ids = level.units.flatMap((u) => u.lessons.map((l) => l.id));
        const count = ids.filter((id) => done[id]?.done).length;
        const reachable = ids.length > 0 && isUnlocked(course, done, ids[0], starts);
        const startHere = () => {
          if (!confirm(`Start at ${level.id}? Earlier levels stay available, and your progress is kept.`)) return;
          update((d) => {
            d.levelStarts = { ...d.levelStarts, [lang]: { ...(d.levelStarts?.[lang] || {}), [level.id]: true } };
          });
          location.hash = `#/lesson/${ids[0]}`;
        };
        return (
          <details class="level" key={level.id} open={level.id === nextLevel || (!nextLevel && level === course.levels[0])}>
            <summary class="level-head" id={`lvl-${level.id}`}>
              <span class="cefr">{level.id}</span>
              <div>
                <h2>{level.title}</h2>
                <p class="muted small">{level.description}</p>
              </div>
              {!level.comingSoon && <span class="muted small nowrap">{count === ids.length && count ? '🎓 ' : ''}{count}/{ids.length}</span>}
            </summary>
            {!level.comingSoon && !reachable && (
              <div class="card level-skip">
                <p class="small">Already speak some German? Jump straight in — earlier levels stay open.</p>
                <button type="button" class="btn ghost" onClick={startHere}>⏩ Start at {level.id}</button>
              </div>
            )}
            {level.comingSoon ? (
              <p class="card muted center">🚧 Coming soon — finish the levels above first!</p>
            ) : (
              level.units.map((unit, ui) => <Unit key={unit.id} unit={unit} label={`Unit ${ui + 1}`} ctx={ctx} />)
            )}
          </details>
        );
      })}
    </div>
  );
}

function greeting(lang) {
  const g = lang.greetings || { morning: 'Good morning', day: 'Hello', evening: 'Good evening' };
  const h = new Date().getHours();
  if (h < 11) return g.morning;
  if (h < 18) return g.day;
  return g.evening;
}

function Track({ track, ctx }) {
  const { course, done, starts } = ctx;
  const ids = track.units.flatMap((u) => u.lessons.map((l) => l.id));
  const count = ids.filter((id) => done[id]?.done).length;
  const open = track.units.filter((u) => levelReached(course, done, u.level, starts));
  const locked = track.units.filter((u) => !open.includes(u));
  return (
    <details class="level track" id={`track-${track.id}`}>
      <summary class="level-head">
        <span class="cefr" aria-hidden="true">{track.badge || 'Ü'}</span>
        <div>
          <h2>{track.title}</h2>
          <p class="muted small">{track.description}</p>
        </div>
        <span class="muted small nowrap">{count}/{ids.length}</span>
      </summary>
      {open.map((unit) => <Unit key={unit.id} unit={unit} label={`Sounds · ${unit.level}`} ctx={ctx} />)}
      {locked.length > 0 && (
        <p class="card muted small center">
          🔒 {locked.length} more sound{locked.length > 1 ? 's' : ''} unlock as you reach {[...new Set(locked.map((u) => u.level))].join(', ')}.
        </p>
      )}
    </details>
  );
}

function Unit({ unit, label, ctx }) {
  const { course, done, starts, next } = ctx;
  const unitDone = unit.lessons.every((l) => done[l.id]?.done);
  return (
    <div class={`unit ${unitDone ? 'unit-done' : ''}`}>
      <div class="unit-head">
        <span class="unit-icon" aria-hidden="true">{unit.icon}</span>
        <div>
          <p class="eyebrow">{label}</p>
          <h3 lang={course.lang.code}>{unit.title}</h3>
          <p class="muted small">{unit.subtitle}</p>
        </div>
        {unitDone && <span class="badge-chip" title="Unit complete">🏁</span>}
      </div>
      <ol class="path">
        {unit.lessons.map((l, li) => {
          const d = done[l.id];
          const unlocked = isUnlocked(course, done, l.id, starts);
          const current = l.id === next;
          const stars = d ? (d.best >= 1 ? 3 : d.best >= 0.8 ? 2 : 1) : 0;
          const kind = KINDS[kindOf(l)];
          const glyph = d?.done ? '✓' : current ? '▶' : kind.icon || li + 1;
          const kindLabel = kind.icon ? `${kind.label}: ` : '';
          return (
            <li key={l.id} class={`node-wrap offset-${li % 4} kind-${kindOf(l)}`}>
              {unlocked ? (
                <a class={`node ${d?.done ? 'done' : ''} ${current ? 'current' : ''}`} href={`#/lesson/${l.id}`} aria-label={`${kindLabel}${l.title}${d?.done ? ' (completed)' : current ? ' (next)' : ''}`}>
                  <span aria-hidden="true">{glyph}</span>
                </a>
              ) : (
                <span class="node locked" aria-label={`${kindLabel}${l.title} (locked)`}>
                  <span aria-hidden="true">🔒</span>
                </span>
              )}
              <span class="node-label">
                {kind.icon && <span class="kind-tag">{kind.icon} {kind.label}</span>}
                {l.title}
                {stars > 0 && <span class="stars" aria-label={`${stars} of 3 stars`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}