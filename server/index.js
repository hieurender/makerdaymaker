import express from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = process.env.PORT || 3000;
const location = process.env.MAKER_DAY_LOCATION || 'San Francisco';
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

const runs = new Map();

const app = express();
app.use(express.json());

app.get('/api/config', (_req, res) => {
  res.json({ year: 2027, location });
});

app.post('/api/make', (_req, res) => {
  const run = { id: randomUUID(), phase: 'theme', startedAt: new Date().toISOString() };
  runs.set(run.id, run);
  res.status(202).json(run);
});

app.get('/api/runs/:id', (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'not found' });
  res.json(run);
});

app.use(express.static(distDir));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(port, () => console.log(`makerdaymaker listening on :${port}`));
