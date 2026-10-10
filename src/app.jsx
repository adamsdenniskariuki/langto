import { useEffect, useState } from 'preact/hooks';
import { CourseContext } from './components/context.js';
import { useStore, useToasts } from './lib/store.js';
import { loadCourse } from './lib/content.js';
import { applyAppearance } from './lib/appearance.js';
import { currentStreak } from './lib/gamify.js';
import { useRoute } from './router.js';
import { Home } from './views/Home.jsx';
import { LessonView } from './views/Lesson.jsx';
import { Review } from './views/Review.jsx';
import { Speak } from './views/Speak.jsx';
import { Progress } from './views/Progress.jsx';
import { Settings } from './views/Settings.jsx';
import { Onboarding, welcomeReturn } from './views/Onboarding.jsx';

const NAV = [
  { name: 'home', href: '#/', icon: '🗺️', label: 'Learn' },
  { name: 'review', href: '#/review', icon: '🔁', label: 'Review' },
  { name: 'speak', href: '#/speak', icon: '🎙️', label: 'Speak' },
  { name: 'progress', href: '#/progress', icon: '🏅', label: 'Progress' },
  { name: 'settings', href: '#/settings', icon: '⚙️', label: 'Settings' },
];

function Toasts() {
  const toasts = useToasts();
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} class={`toast ${t.kind}`}>
          <span aria-hidden="true">{t.icon}</span> {t.text}
        </div>
      ))}
    </div>
  );
}

function TopBar() {
  const s = useStore();
  const streak = currentStreak(s);
  return (
    <header class="topbar">
      <a href="#/" class="brand" aria-label="Langto home">
        <img src="/icons/icon.svg" alt="" width="28" height="28" />
        <span>Langto</span>
      </a>
      <div class="top-stats">
        <span title={`${streak.count}-day streak`} class={streak.doneToday ? 'lit' : ''}>🔥 {streak.count}</span>
        <span title="Streak freezes">❄️ {s.streak.freezes}</span>
        <span title="Total XP">⭐ {s.xp}</span>
      </div>
    </header>
  );
}

function BottomNav({ current }) {
  return (
    <nav class="bottomnav" aria-label="Main">
      {NAV.map((n) => (
        <a key={n.name} href={n.href} class={current === n.name ? 'active' : ''} aria-current={current === n.name ? 'page' : undefined}>
          <span aria-hidden="true">{n.icon}</span>
          <span class="nav-label">{n.label}</span>
        </a>
      ))}
    </nav>
  );
}

export function App() {
  const s = useStore();
  const route = useRoute();
  const lang = s.settings.lang;
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => applyAppearance(s.settings), [s.settings]);

  useEffect(() => {
    let live = true;
    setError('');
    loadCourse(lang)
      .then((c) => live && setCourse(c))
      .catch((e) => live && setError(e.message || 'Could not load the course.'));
    return () => (live = false);
  }, [lang]);

  if (error)
    return (
      <main class="page center">
        <h1>😕 Couldn't load lessons</h1>
        <p class="error">{error}</p>
        <button type="button" class="btn primary" onClick={() => location.reload()}>Try again</button>
      </main>
    );
  if (!course) return <main class="page center loading" aria-busy="true">Loading…</main>;

  const inLesson = route.name === 'lesson';
  let view;
  if (!s.onboarded) view = <Onboarding />;
  else if (route.name === 'welcome') view = <Onboarding replay returnTo={welcomeReturn(route.params[0])} />;
  else if (route.name === 'lesson' && course.lessonIndex.has(route.params[0])) view = <LessonView key={route.params[0]} lessonId={route.params[0]} />;
  else if (route.name === 'review') view = <Review />;
  else if (route.name === 'speak') view = <Speak tab={route.params[0]} />;
  else if (route.name === 'progress') view = <Progress />;
  else if (route.name === 'settings') view = <Settings />;
  else view = <Home />;

  const chrome = s.onboarded && !inLesson && route.name !== 'welcome';
  return (
    <CourseContext.Provider value={course}>
      {chrome && <TopBar />}
      <main id="main" class={chrome ? 'with-nav' : ''}>{view}</main>
      {chrome && <BottomNav current={route.name} />}
      <Toasts />
    </CourseContext.Provider>
  );
}
