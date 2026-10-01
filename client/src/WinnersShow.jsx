import confetti from 'canvas-confetti';
import { useCallback, useEffect, useState } from 'react';

const SUSPENSE_SECONDS = 5;
const CONFETTI_COLORS = ['#8a05ff', '#c29eff', '#e7dbff', '#00db7c', '#ffffff'];

function celebrate() {
  const shared = { particleCount: 140, spread: 75, startVelocity: 60, colors: CONFETTI_COLORS, disableForReducedMotion: true };
  confetti({ ...shared, angle: 60, origin: { x: 0, y: 0.8 } });
  confetti({ ...shared, angle: 120, origin: { x: 1, y: 0.8 } });
  setTimeout(() => confetti({ ...shared, particleCount: 200, spread: 120, origin: { x: 0.5, y: 0.4 } }), 250);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function WinnersShow({ reveals, onFinalSlide }) {
  const [phase, setPhase] = useState('suspense');
  const [countdown, setCountdown] = useState(SUSPENSE_SECONDS);
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState('next');

  const go = useCallback(
    (delta) => {
      const next = slide + delta;
      if (next < 0 || next >= reveals.length) return;
      setDirection(delta > 0 ? 'next' : 'prev');
      setSlide(next);
    },
    [slide, reveals.length],
  );

  useEffect(() => {
    onFinalSlide(phase === 'carousel' && slide === reveals.length - 1);
  }, [phase, slide, reveals.length, onFinalSlide]);

  useEffect(() => {
    if (phase !== 'suspense') return;
    if (countdown === 0) {
      celebrate();
      return setPhase('carousel');
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  useEffect(() => {
    const onKey = (e) => {
      if (phase !== 'carousel' || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      e.preventDefault();
      go(e.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, go]);

  if (phase === 'suspense') {
    return (
      <div className="winners" key="suspense">
        <span className="overline">And the winners are</span>
        <span className="suspense" key={countdown}>{countdown}</span>
      </div>
    );
  }

  const { award, winner, runnersUp } = reveals[slide];
  return (
    <div className="carousel">
      <button className="carousel-arrow" onClick={() => go(-1)} disabled={slide === 0} aria-label="Previous award">←</button>
      <div className={`winners ${direction}${award.grand ? ' grand' : ''}`} key={slide}>
        <span className="overline">{award.grand ? 'Grand prize' : `Award ${slide + 1} of ${reveals.length}`}</span>
        <h2 className="winners-award">{award.name}</h2>
        <h1 className="winners-team">
          <a href={`/${winner.slug}`} target="_blank" rel="noopener noreferrer">{winner.team}</a>
        </h1>
        <span className="winners-votes">{plural(winner.votes, 'vote')}</span>
        <ul className="winners-members">
          {winner.members.map((m) => (
            <li key={m.id} className={m.fake ? undefined : 'existing'}>{m.name}</li>
          ))}
        </ul>
        <ol className="runners-up">
          {runnersUp.map((r, i) => (
            <li key={r.team}>
              <span className="overline">{i === 0 ? '2nd' : '3rd'}</span>
              <span>{r.team}</span>
              <span className="runner-votes">{plural(r.votes, 'vote')}</span>
            </li>
          ))}
        </ol>
        <span className="overline hint">{slide + 1} / {reveals.length}</span>
      </div>
      <button className="carousel-arrow" onClick={() => go(1)} disabled={slide === reveals.length - 1} aria-label="Next award">→</button>
    </div>
  );
}

function nextUrl({ year, location, headcount }) {
  return `/?${new URLSearchParams({ year, location, headcount })}`;
}

export function Finale({ reveals, next }) {
  return (
    <div className="winners" key="finale">
      <span className="overline">That’s a wrap</span>
      <ol className="finale">
        {reveals.map((r) => (
          <li key={r.award.name}>
            <span className="overline">{r.award.name}</span>
            <span className="finale-team">{r.winner.team}</span>
          </li>
        ))}
      </ol>
      <a className="btn btn-primary next-link" href={nextUrl(next)}>To the next one!</a>
    </div>
  );
}
