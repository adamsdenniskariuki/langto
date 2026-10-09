import { useEffect, useState } from 'preact/hooks';

export const GREETINGS = [
  ['en', 'Welcome to Langto!'],
  ['de', 'Willkommen bei Langto!'],
  ['fr', 'Bienvenue sur Langto !'],
  ['es', '¡Bienvenido a Langto!'],
  ['it', 'Benvenuto su Langto!'],
  ['pt', 'Bem-vindo ao Langto!'],
  ['nl', 'Welkom bij Langto!'],
  ['sw', 'Karibu Langto!'],
  ['sv', 'Välkommen till Langto!'],
  ['pl', 'Witaj w Langto!'],
];

const reduceQuery = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)');

function useReducedMotion() {
  const [reduce, setReduce] = useState(() => !!reduceQuery()?.matches);
  useEffect(() => {
    const q = reduceQuery();
    if (!q) return;
    const on = () => setReduce(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  return reduce;
}

/** Heading that cycles through "Welcome to Langto!" in several languages.
 *  Screen readers get one stable name; the visual rotation is aria-hidden. */
export function RotatingGreeting({ interval = 2600 }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return setI(0);
    const t = setInterval(() => setI((n) => (n + 1) % GREETINGS.length), interval);
    return () => clearInterval(t);
  }, [reduce, interval]);

  return (
    <h1 class="greeting">
      <span class="sr-only">Welcome to Langto!</span>
      <span class="greeting-stack" aria-hidden="true">
        {GREETINGS.map(([lang, text], n) => (
          <span key={lang} lang={lang} class={n === i ? 'on' : n === (i - 1 + GREETINGS.length) % GREETINGS.length ? 'out' : ''}>
            {text}
          </span>
        ))}
      </span>
    </h1>
  );
}
