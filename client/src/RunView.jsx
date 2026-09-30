import { useEffect, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Spinner from './Spinner.jsx';

const VISIBLE_LOGS = 12;

const initial = { step: null, logs: [], results: {}, interim: null, startedAt: null };

function reduce(state, event) {
  switch (event.type) {
    case 'step': {
      const { [event.key]: _, ...results } = state.results;
      return { ...state, step: event, logs: [], results, interim: null, startedAt: event.at };
    }
    case 'interim':
      return { ...state, logs: [], interim: event };
    case 'log':
      return { ...state, logs: [...state.logs, event], interim: null };
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

  const { step, logs, results, interim, startedAt } = state;
  if (!step) return null;
  const result = results[step.key];
  const pinnedTheme = step.key !== 'theme' && results.theme;
  const pinnedAwards = !['theme', 'awards'].includes(step.key) && results.awards;

  return (
    <section className="run">
      <div className="stepbar">
        <div className="stepbar-label">
          <span className="step-count">Step {step.index + 1}/{step.total}</span>
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
          {pinnedAwards && (
            <ol className="pinned-awards">
              {pinnedAwards.map((award, i) => (
                <li key={award.name} style={{ viewTransitionName: `award-${i}` }}>
                  <span className="overline">{awardLabel(award, i)}</span>
                  <span>{award.name}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="stage">
        {result ? <Reveal view={step.key} data={result} /> : interim ? <Reveal view={interim.view} data={interim.data} /> : (
          <div className="working">
            <Spinner />
            <ul className="log">
              {logs.slice(-VISIBLE_LOGS).map((l) => (
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

function awardLabel(award, i) {
  return award.grand ? 'Grand prize' : String(i + 1).padStart(2, '0');
}

function Reveal({ view, data }) {
  if (view === 'theme') return <ThemeReveal theme={data} />;
  if (view === 'awards') return <AwardsReveal awards={data} />;
  if (view === 'headcount') return <HeadcountReveal roster={data} />;
  if (view === 'teams') return <TeamsReveal teams={data.teams} />;
  return null;
}

function TeamsReveal({ teams }) {
  return (
    <ol className="teams">
      {teams.map((team, i) => (
        <li key={team.name} className="team" style={{ animationDelay: `${Math.min(i * 30, 900)}ms` }}>
          <h3 className="team-name">{team.name}</h3>
          <ul>
            {team.members.map((m) => (
              <li key={m.id} className={m.fake ? undefined : 'existing'}>
                <span>{m.name}</span>
                <span className="team-org">{m.org ?? '—'}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function AwardsReveal({ awards }) {
  return (
    <ol className="awards">
      {awards.map((award, i) => (
        <li key={award.name} className="award" style={{ animationDelay: `${i * 120}ms`, viewTransitionName: `award-${i}` }}>
          <span className="overline">{awardLabel(award, i)}</span>
          <h3>{award.name}</h3>
          <p>{award.description}</p>
        </li>
      ))}
    </ol>
  );
}

function HeadcountReveal({ roster }) {
  return (
    <div className="headcount">
      <div className="headcount-total">
        <span className="overline">Projected headcount</span>
        <span className="headcount-number">{roster.headcount}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Org</th>
            <th>Current</th>
            <th>Frontfilled</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {roster.orgs.map((o) => (
            <tr key={o.org}>
              <td>{o.org}</td>
              <td>{o.current}</td>
              <td>+{o.added}</td>
              <td>{o.current + o.added}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
