import { useEffect, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Spinner from './Spinner.jsx';

const VISIBLE_LOGS = 12;

const noVotes = { cast: 0, last: null };

const initial = { step: null, logs: [], results: {}, interim: null, statuses: {}, voting: noVotes, startedAt: null };

function reduce(state, event) {
  switch (event.type) {
    case 'step': {
      const { [event.key]: _, ...results } = state.results;
      return { ...state, step: event, logs: [], results, interim: null, statuses: {}, voting: noVotes, startedAt: event.at };
    }
    case 'interim':
      return { ...state, logs: [], interim: event };
    case 'team-status':
      return { ...state, statuses: { ...state.statuses, [event.slug]: event.status } };
    case 'vote':
      return {
        ...state,
        voting: { cast: event.n, last: event },
      };
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

export default function RunView({ runId }) {
  const [state, dispatch] = useReducer(reduce, initial);
  const [pending, setPending] = useState(false);
  const indexRef = useRef(-1);
  const heldRef = useRef(null);

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

  const { step, logs, results, interim, statuses, voting, startedAt } = state;
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
        {result ? <Reveal view={step.key} data={result} voting={voting} /> : interim ? <Reveal view={interim.view} data={interim.data} statuses={statuses} voting={voting} /> : (
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

function Reveal({ view, data, statuses, voting }) {
  if (view === 'theme') return <ThemeReveal theme={data} />;
  if (view === 'awards') return <AwardsReveal awards={data} />;
  if (view === 'headcount') return <HeadcountReveal roster={data} />;
  if (view === 'teams') return <TeamsReveal teams={data.teams} />;
  if (view === 'voting') return <VotingBoard total={data.total} awards={data.awards} voting={voting} />;
  if (view === 'projects') return <TeamsReveal teams={data.teams} statuses={statuses ?? {}} allReady={!statuses} />;
  return null;
}

function TeamsReveal({ teams, statuses, allReady }) {
  const tracking = Boolean(statuses);
  return (
    <ol className="teams">
      {teams.map((team, i) => {
        const status = allReady ? 'ready' : statuses?.[team.slug];
        const body = (
          <>
            <h3 className="team-name">{team.name}</h3>
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
            {tracking && <TeamStatus status={status} />}
          </li>
        );
      })}
    </ol>
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

function TeamStatus({ status }) {
  const done = status === 'ready';
  return (
    <div className={done ? 'team-overlay done' : 'team-overlay'} aria-hidden={done}>
      {!done && <Spinner />}
      <span>{done ? status : status ?? 'waiting'}</span>
    </div>
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
