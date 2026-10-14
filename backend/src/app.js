const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedules');

function createApp({ db, clock = { now: () => Date.now() } /* , ... */ }) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes(db, clock));
  app.use('/api/schedules', scheduleRoutes(db, clock));
  app.get('/api/routes', (req, res) =>
    res.json(db.prepare('SELECT id, origin, destination FROM routes ORDER BY origin').all())
  );

  return app;
}
module.exports = { createApp };