import { render } from 'preact';
import { App } from './app.jsx';
import './styles.css';

render(<App />, document.getElementById('app'));

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
