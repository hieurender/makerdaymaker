import { useEffect, useState } from 'react';

function useBackground(location) {
  const [background, setBackground] = useState(null);
  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    fetch(`/api/background?${new URLSearchParams({ location })}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((bg) => {
        if (!bg || cancelled) return;
        const img = new Image();
        img.onload = () => !cancelled && setBackground(bg);
        img.src = bg.url;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location]);
  return background;
}

export default function Landing({ config, onMake }) {
  const [making, setMaking] = useState(false);
  const background = useBackground(config?.location);

  function make() {
    setMaking(true);
    onMake();
  }

  return (
    <section className="hero">
      {background && (
        <>
          <div className="backdrop" style={{ backgroundImage: `url("${background.url}")` }} aria-hidden="true" />
          <a className="photo-credit" href={background.source} target="_blank" rel="noopener noreferrer">
            Photo: {background.title}, Wikimedia Commons
          </a>
        </>
      )}
      <h1>
        Rendervous Maker Day {config?.year ?? 2027}
        <span className="location"> - {config?.location ?? ' '}</span>
      </h1>
      <button className="make" onClick={make} disabled={making}>
        <span className="make-fill" aria-hidden="true" />
        <span className="make-label">{making ? 'Making' : 'Make'}</span>
      </button>
    </section>
  );
}
