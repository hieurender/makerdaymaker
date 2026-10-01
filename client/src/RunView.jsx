import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Spinner from './Spinner.jsx';
import WinnersShow, { Finale } from './WinnersShow.jsx';

const VISIBLE_LOGS = 12;
const FAILED = 'failed spectacularly';

const noVotes = { cast: 0, last: null };

const initial = {
  step: null,
  logs: [],
  results: {},
  interim: null,
  statuses: {},
  pitches: {},
  error: null,
  voting: noVotes,
  finished: false,
  startedAt: null,
};

function reduce(state, event) {
  switch (event.type) {
    case 'step': {
      const { [event.key]: _, ...results } = state.results;
      return { ...state, error: null, step: event, logs: [], results, interim: null, statuses: {}, pitches: {}, voting: noVotes, startedAt: event.at };
    }
    case 'interim':
      return { ...state, logs: [], interim: event };
    case 'team-status':
      return {
        ...state,
        statuses: { ...state.statuses, [event.slug]: event.status },
        pitches: event.pitch ? { ...state.pitches, [event.slug]: event.pitch } : state.pitches,
      };
    case 'finished':
      return { ...state, finished: event.next };
    case 'vote':
      return {
        ...state,
        voting: { cast: event.n, last: event },
      };
    case 'log':
      const keepGrid = state.interim?.view === 'projects';
      return { ...state, logs: [...state.logs, event], interim: keepGrid ? state.interim : null };
    case 'error':
      return { ...state, error: event.message };
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
  const [pending, setPending] = useState(false);
  const indexRef = useRef(-1);
  const heldRef = useRef(null);
  const [finalSlide, setFinalSlide] = useState(false);
  const onFinalSlide = useCallback((value) => setFinalSlide(value), []);

  useEffect(() => {
    const source = new EventSource(`/api/runs/${runId}/events`);
    source.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (heldRef.current) return heldRef.current.push(event);
      const advancing = event.type === 'step' && indexRef.current >= 0 && event.index > indexRef.current;
      if (event.type === 'step') indexRef.current = event.index;
      if (!advancing || !document.startViewTransition) return dispatch(event);
      heldRef.current = [];
      document.startViewTransition(() =>
        flushSync(() => {
          dispatch(event);
          heldRef.current.forEach(dispatch);
          heldRef.current = null;
        }),
      );
    };
    return () => source.close();
  }, [runId]);

  async function act(action) {
    setPending(true);
    await fetch(`/api/runs/${runId}/${action}`, { method: 'POST' });
    setPending(false);
  }

  const { step, logs, results, interim, statuses, pitches, voting, finished, startedAt, error } = state;
  if (!step) return null;
  const result = results[step.key];
  const pinnedTheme = step.key !== 'theme' && results.theme;

  return (
    <section className="run">
      <div className="stepbar">
        <div className="stepbar-label">
          <span className="step-count">Step {step.index + 1}/{step.total}</span>
          <h2>{step.name}</h2>
        </div>
        <ol className="stepbar-segments" aria-hidden="true">
          {Array.from({ length: step.total }, (_, i) => (
            <li key={i} className={i < step.index || finished ? 'done' : i === step.index ? 'current' : ''} />
          ))}
        </ol>
      </div>

      {pinnedTheme && (
        <div className="pinned">
          {pinnedTheme.banner && <ThemeBanner src={pinnedTheme.banner} alt={pinnedTheme.name} />}
          <div className="theme-block">
            <span className="overline">Theme</span>
            <p className="theme-name">{pinnedTheme.name}</p>
            <p className="theme-tagline">{pinnedTheme.tagline}</p>
          </div>
        </div>
      )}

      <div className="stage">
        {finished ? <Finale reveals={result.reveals} next={finished} /> : result ? <Reveal view={step.key} data={result} voting={voting} onFinalSlide={onFinalSlide} /> : interim ? <Reveal view={interim.view} data={interim.data} statuses={statuses} pitches={pitches} voting={voting} /> : (
          <div className="working">
            {error ? <p role="alert">Step failed: {error}</p> : <Spinner />}
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

      {result && step.index === step.total - 1 && finalSlide && !finished && (
        <div className="actions">
          <button className="btn btn-primary" onClick={() => act('approve')} disabled={pending}>Wrap up Maker Day</button>
        </div>
      )}

      {(error || (result && step.index < step.total - 1)) && (
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => act('retry')} disabled={pending}>Retry</button>
          {result && <button className="btn btn-primary" onClick={() => act('approve')} disabled={pending}>Next</button>}
        </div>
      )}
    </section>
  );
}

function awardLabel(award, i) {
  return award.grand ? 'Grand prize' : String(i + 1).padStart(2, '0');
}

function ThemeBanner({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img className="theme-banner" src={src} alt={alt} onError={() => setFailed(true)} />;
}

function Reveal({ view, data, statuses, pitches, voting, onFinalSlide }) {
  if (view === 'theme') return <ThemeReveal theme={data} />;
  if (view === 'awards') return <AwardsReveal awards={data} />;
  if (view === 'headcount') return <HeadcountReveal roster={data} />;
  if (view === 'teams') return <TeamsReveal teams={data.teams} />;
  if (view === 'winners') return <WinnersShow reveals={data.reveals} onFinalSlide={onFinalSlide} />;
  if (view === 'voting') return <VotingBoard total={data.total} awards={data.awards} voting={voting} />;
  if (view === 'projects') return <TeamsReveal teams={data.teams} statuses={statuses ?? {}} pitches={pitches ?? {}} allReady={!statuses} />;
  return null;
}

function TeamsReveal({ teams, statuses, pitches = {}, allReady }) {
  const tracking = Boolean(statuses);
  return (
    <ol className="teams">
      {teams.map((team, i) => {
        const status = allReady ? (team.failed ? FAILED : 'ready') : statuses?.[team.slug];
        const pitch = pitches[team.slug];
        const body = (
          <>
            <h3 className="team-name">{team.name}</h3>
            {pitch && status === 'ready' && <Pitch pitch={pitch} />}
            <ul>
              {team.members.map((m) => (
                <li key={m.id} className={m.fake ? undefined : 'existing'}>
                  <span>{m.name}</span>
                  <span className="team-org">{m.org ?? '—'}</span>
                </li>
              ))}
            </ul>
            {status === 'ready' && <span className="team-ready">Ready ↗</span>}
          </>
        );
        return (
          <li key={team.name} className="team" style={{ animationDelay: `${Math.min(i * 30, 900)}ms` }}>
            {status === 'ready' ? (
              <a className="team-link" href={`/${team.slug}`} target="_blank" rel="noopener noreferrer">{body}</a>
            ) : body}
            {tracking && <TeamStatus status={status} pitch={pitch} />}
          </li>
        );
      })}
    </ol>
  );
}

function Pitch({ pitch }) {
  return (
    <div className="team-pitch">
      <strong>{pitch.product}</strong>
      <span>{pitch.tagline}</span>
    </div>
  );
}

function VotingBoard({ total, awards, voting }) {
  const remaining = total - voting.cast;
  const { last } = voting;
  return (
    <div className="voting">
      <div className="voting-head">
        <div className="countdown">
          <span className="overline">{remaining === 0 ? 'Polls closed' : 'Votes remaining'}</span>
          <span className="countdown-number">{remaining.toLocaleString()}</span>
        </div>
        <div className="voter" aria-live="off">
          {last && (
            <div key={last.n} className="voter-flash">
              <span className="overline">Ballot cast</span>
              <span className="voter-name">{last.voter.name}</span>
              <span className="voter-org">{last.voter.org ?? '\u00a0'}</span>
            </div>
          )}
        </div>
      </div>
      <ol className="ballot-awards">
        {awards.map((name, i) => {
          const team = last?.picks[i];
          return (
            <li key={name} className="ballot-award">
              <span className="overline">{name}</span>
              <span key={last?.n} className={team ? 'ballot-team flash' : 'ballot-team'}>{team ?? 'Awaiting votes'}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TeamStatus({ status, pitch }) {
  const done = status === 'ready';
  const failed = status === FAILED;
  return (
    <div className={done ? 'team-overlay done' : failed ? 'team-overlay failed' : 'team-overlay'} aria-hidden={done}>
      {!done && !failed && <Spinner />}
      <span>{done ? status : status ?? 'waiting'}</span>
      {!done && pitch && <Pitch pitch={pitch} />}
    </div>
  );
}

function AwardsReveal({ awards }) {
  return (
    <ol className="awards">
      {awards.map((award, i) => (
        <li key={award.name} className="award" style={{ animationDelay: `${i * 120}ms` }}>
          <span className="overline">{awardLabel(award, i)}</span>
          {award.icon && <img className="award-icon" src={award.icon} alt="" width="48" height="48" />}
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
