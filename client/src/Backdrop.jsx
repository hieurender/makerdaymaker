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

export default function Backdrop({ location, dim }) {
  const background = useBackground(location);
  if (!background) return null;
  return (
    <>
      <div className={dim ? 'backdrop dim' : 'backdrop'} style={{ backgroundImage: `url("${background.url}")` }} aria-hidden="true" />
      <a className="photo-credit" href={background.source} target="_blank" rel="noopener noreferrer">
        Photo: {background.title}, Wikimedia Commons
      </a>
    </>
  );
}
