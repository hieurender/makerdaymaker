import { useEffect, useState } from 'react';
import Landing from './Landing.jsx';
import RunView from './RunView.jsx';

export default function App() {
  const [config, setConfig] = useState(null);
  const [runId, setRunId] = useState(null);

  useEffect(() => {
    fetch('/api/config').then((r) => r.json()).then(setConfig);
  }, []);

  async function make() {
    const res = await fetch('/api/make', { method: 'POST' });
    const run = await res.json();
    setRunId(run.id);
  }

  return (
    <main className="shell">
      <header className="masthead">
        <img className="logo logo-light" src="/render-logo-black-full.svg" alt="Render" />
        <img className="logo logo-dark" src="/render-logo-white-full.svg" alt="Render" />
        <span className="overline">Maker Day Maker</span>
      </header>
      {runId ? <RunView runId={runId} /> : <Landing config={config} onMake={make} />}
    </main>
  );
}
