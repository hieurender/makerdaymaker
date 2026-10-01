import { useEffect, useState } from 'react';
import Backdrop from './Backdrop.jsx';
import Landing from './Landing.jsx';
import RunView from './RunView.jsx';

export default function App() {
  const [config, setConfig] = useState(null);
  const [runId, setRunId] = useState(null);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((defaults) => {
        const params = new URLSearchParams(window.location.search);
        setConfig({
          year: Number(params.get('year')) || defaults.year,
          location: params.get('location') || defaults.location,
          headcount: Number(params.get('headcount')) || defaults.headcount,
        });
      });
  }, []);

  async function make() {
    const res = await fetch('/api/make', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const run = await res.json();
    setRunId(run.id);
  }

  return (
    <main className="shell">
      <Backdrop location={config?.location} dim={Boolean(runId)} />
      <header className="masthead">
        <img className="logo logo-light" src="/render-logo-black-full.svg" alt="Render" />
        <img className="logo logo-dark" src="/render-logo-white-full.svg" alt="Render" />
        <span className="overline">Maker Day Maker</span>
      </header>
      {runId ? <RunView runId={runId} /> : <Landing config={config} onMake={make} />}
    </main>
  );
}
