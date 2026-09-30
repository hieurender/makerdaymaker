import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCATION, YEAR } from './config.js';
import { approve, createRun, getRun, retry } from './runs.js';
import { getPage } from './steps/projects.js';

const port = process.env.PORT || 3000;
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

const app = express();
app.use(express.json());

app.get('/api/config', (_req, res) => {
  res.json({ year: YEAR, location: LOCATION });
});

app.post('/api/make', (_req, res) => {
  const run = createRun();
  res.status(202).json({ id: run.id });
});

for (const [action, fn] of [['retry', retry], ['approve', approve]]) {
  app.post(`/api/runs/:id/${action}`, (req, res) => {
    const run = getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'not found' });
    if (!fn(run)) return res.status(409).json({ error: `cannot ${action} now` });
    res.status(202).end();
  });
}

app.get('/api/runs/:id/events', (req, res) => {
  const run = getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'not found' });

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();

  const send = (event) => res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
  const lastId = Number(req.get('Last-Event-ID') ?? -1);
  run.events.slice(lastId + 1).forEach(send);
  run.emitter.on('event', send);
  req.on('close', () => run.emitter.off('event', send));
});

app.use(express.static(distDir));

app.get('/:slug', (req, res, next) => {
  const page = getPage(req.params.slug);
  if (!page) return next();
  res.type('html').send(page);
});
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(port, () => console.log(`makerdaymaker listening on :${port}`));
