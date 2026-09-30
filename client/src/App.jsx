import { useEffect, useState } from 'react';

export default function App() {
  const [config, setConfig] = useState(null);
  const [run, setRun] = useState(null);
  const [making, setMaking] = useState(false);

  useEffect(() => {
    fetch('/api/config').then((r) => r.json()).then(setConfig);
  }, []);

  async function make() {
    setMaking(true);
    const res = await fetch('/api/make', { method: 'POST' });
    setRun(await res.json());
  }

  return (
    <main className="landing">
      <header className="masthead">
        <img className="logo logo-light" src="/render-logo-black-full.svg" alt="Render" />
        <img className="logo logo-dark" src="/render-logo-white-full.svg" alt="Render" />
        <span className="overline">Maker Day Maker</span>
      </header>

      <section className="hero">
        <h1>
          Rendervous Maker Day {config?.year ?? 2027}
          <span className="location"> - {config?.location ?? ' '}</span>
        </h1>
        <button className="make" onClick={make} disabled={making}>
          <span className="make-fill" aria-hidden="true" />
          <span className="make-label">{making ? 'Making' : 'Make'}</span>
        </button>
        {run && <p className="status overline">Run {run.id.slice(0, 8)} · phase {run.phase}</p>}
      </section>
    </main>
  );
}
