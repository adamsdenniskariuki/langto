import { useCourse } from '../components/context.js';
import { Bar, Ring } from '../components/Ring.jsx';
import { useStore } from '../lib/store.js';
import { currentStreak, levelFromXP } from '../lib/gamify.js';
import { dateKey } from '../lib/date.js';
import { dueCards } from '../lib/srs.js';
import { isUnlocked, nextLessonId } from '../lib/content.js';

export function Home() {
  const course = useCourse();
  const s = useStore();
  const lang = course.lang.code;
  const done = s.lessons[lang] || {};
  const next = nextLessonId(course, done);
  const nextEntry = next && course.lessonIndex.get(next);
  const today = s.xpLog[dateKey()] || 0;
  const streak = currentStreak(s);
  const lvl = levelFromXP(s.xp);
  const due = dueCards(s.cards[lang]).length;

  return (
    <div class="home">
      <section class="hero card">
        <div class="hero-text">
          <p class="eyebrow">{course.lang.flag} {course.course.title}</p>
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

      {course.levels.map((level) => {
        const ids = level.units.flatMap((u) => u.lessons.map((l) => l.id));
        const count = ids.filter((id) => done[id]?.done).length;
        return (
          <section class="level" key={level.id} aria-labelledby={`lvl-${level.id}`}>
            <header class="level-head">
              <span class="cefr">{level.id}</span>
              <div>
                <h2 id={`lvl-${level.id}`}>{level.title}</h2>
                <p class="muted small">{level.description}</p>
              </div>
              {!level.comingSoon && <span class="muted small nowrap">{count}/{ids.length}</span>}
            </header>
            {level.comingSoon ? (
              <p class="card muted center">🚧 Coming soon — finish the levels above first!</p>
            ) : (
              level.units.map((unit, ui) => {
                const unitDone = unit.lessons.every((l) => done[l.id]?.done);
                return (
                  <div class={`unit ${unitDone ? 'unit-done' : ''}`} key={unit.id}>
                    <div class="unit-head">
                      <span class="unit-icon" aria-hidden="true">{unit.icon}</span>
                      <div>
                        <p class="eyebrow">Unit {ui + 1}</p>
                        <h3 lang={course.lang.code}>{unit.title}</h3>
                        <p class="muted small">{unit.subtitle}</p>
                      </div>
                      {unitDone && <span class="badge-chip" title="Unit complete">🏁</span>}
                    </div>
                    <ol class="path">
                      {unit.lessons.map((l, li) => {
                        const d = done[l.id];
                        const unlocked = isUnlocked(course, done, l.id);
                        const current = l.id === next;
                        const stars = d ? (d.best >= 1 ? 3 : d.best >= 0.8 ? 2 : 1) : 0;
                        return (
                          <li key={l.id} class={`node-wrap offset-${li % 4}`}>
                            {unlocked ? (
                              <a class={`node ${d?.done ? 'done' : ''} ${current ? 'current' : ''}`} href={`#/lesson/${l.id}`} aria-label={`${l.title}${d?.done ? ' (completed)' : current ? ' (next)' : ''}`}>
                                <span aria-hidden="true">{d?.done ? '✓' : current ? '▶' : li + 1}</span>
                              </a>
                            ) : (
                              <span class="node locked" aria-label={`${l.title} (locked)`}>
                                <span aria-hidden="true">🔒</span>
                              </span>
                            )}
                            <span class="node-label">
                              {l.title}
                              {stars > 0 && <span class="stars" aria-label={`${stars} of 3 stars`}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })
            )}
          </section>
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
