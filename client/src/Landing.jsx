import { useState } from 'react';

export default function Landing({ config, onMake }) {
  const [making, setMaking] = useState(false);

  function make() {
    setMaking(true);
    onMake();
  }

  return (
    <section className="hero">

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
