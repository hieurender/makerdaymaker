import { useEffect, useReducer } from 'react';
import Spinner from './Spinner.jsx';

const initial = { step: null, logs: [], results: {}, startedAt: null };

function reduce(state, event) {
  switch (event.type) {
    case 'step':
      return { ...state, step: event, logs: [], startedAt: event.at };
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

export default function RunView({ runId }) {
  const [state, dispatch] = useReducer(reduce, initial);

  useEffect(() => {
    const source = new EventSource(`/api/runs/${runId}/events`);
    source.onmessage = (e) => dispatch(JSON.parse(e.data));
    return () => source.close();
  }, [runId]);

  const { step, logs, results, startedAt } = state;
  if (!step) return null;
  const result = results[step.key];

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

      <div className="stage">
        {result ? <ThemeReveal theme={result} /> : (
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
    </section>
  );
}

function ThemeReveal({ theme }) {
  return (
    <div className="reveal">
      <span className="overline">This year’s theme</span>
      <h1>{theme.name}</h1>
      <p className="tagline">{theme.tagline}</p>
    </div>
  );
}
