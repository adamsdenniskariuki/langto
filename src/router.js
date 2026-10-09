import { useEffect, useState } from 'preact/hooks';

export function parseHash(hash = location.hash) {
  const parts = hash.replace(/^#\/?/, '').split(/[/?]/).filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'home', params: parts.slice(1) };
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const h = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}

export function navigate(hash) {
  location.hash = hash;
}
