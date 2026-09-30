import { useEffect, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Spinner from './Spinner.jsx';

const initial = { step: null, logs: [], results: {}, startedAt: null };

function reduce(state, event) {
  switch (event.type) {
    case 'step': {
      const { [event.key]: _, ...results } = state.results;
      return { ...state, step: event, logs: [], results, startedAt: event.at };
    }
    case 'log':
      return { ...state, logs: [...state.logs, event] };
    case 'result':
      return { ...state, results: { ...state.results, [event.key]: event.data } };
    default:
      return state;
  }
}

function elapsed(from, to) {
  return `+${((to - from) / 1000).toFixed(1)}s`;
}

function withTransition(update) {
  if (!document.startViewTransition) return update();
  document.startViewTransition(() => flushSync(update));
}

export default function RunView({ runId }) {
  const [state, dispatch] = useReducer(reduce, initial);
  const [pending, setPending] = useState(false);
  const indexRef = useRef(-1);

  useEffect(() => {
    const source = new EventSource(`/api/runs/${runId}/events`);
    source.onmessage = (e) => {
      const event = JSON.parse(e.data);
      const advancing = event.type === 'step' && indexRef.current >= 0 && event.index > indexRef.current;
      if (event.type === 'step') indexRef.current = event.index;
      if (advancing) withTransition(() => dispatch(event));
      else dispatch(event);
    };
    return () => source.close();
  }, [runId]);

  async function act(action) {
    setPending(true);
    await fetch(`/api/runs/${runId}/${action}`, { method: 'POST' });
    setPending(false);
  }

  const { step, logs, results, startedAt } = state;
  if (!step) return null;
  const result = results[step.key];
  const pinnedTheme = step.key !== 'theme' && results.theme;

  return (
    <section className="run">
      <div className="stepbar">
        <div className="stepbar-label">
          <span className="overline">Step {step.index + 1}/{step.total}</span>
          <h2>{step.name}</h2>
        </div>
        <ol className="stepbar-segments" aria-hidden="true">
          {Array.from({ length: step.total }, (_, i) => (
            <li key={i} className={i < step.index ? 'done' : i === step.index ? 'current' : ''} />
          ))}
        </ol>
      </div>

      {pinnedTheme && (
        <div className="pinned">
          <div className="theme-block">
            <span className="overline">Theme</span>
            <p className="theme-name">{pinnedTheme.name}</p>
            <p className="theme-tagline">{pinnedTheme.tagline}</p>
          </div>
        </div>
      )}

      <div className="stage">
        {step.key === 'theme' && result ? <ThemeReveal theme={result} /> : (
          <div className="working">
            <Spinner />
            <ul className="log">
              {logs.map((l) => (
                <li key={l.id}>
                  <span className="log-time">{elapsed(startedAt, l.at)}</span>
                  <span>{l.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {result && (
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => act('retry')} disabled={pending}>Retry</button>
          <button className="btn btn-primary" onClick={() => act('approve')} disabled={pending}>Approve</button>
        </div>
      )}
    </section>
  );
}

function ThemeReveal({ theme }) {
  return (
    <div className="reveal">
      <div className="theme-block">
        <span className="overline">This year’s theme</span>
        <h1 className="theme-name">{theme.name}</h1>
        <p className="tagline theme-tagline">{theme.tagline}</p>
      </div>
    </div>
  );
}
