// Express stub for Swap Shifts API
// This is a reference implementation sketch; wire into your existing app.

const express = require('express');
const bodyParser = require('body-parser');
const swaps = require('./routes/swaps');
const timeoff = require('./routes/timeoff');
const availability = require('./routes/availability');
const schedule = require('./routes/schedule');

const app = express();
app.use(bodyParser.json());

// TODO: plug in your JWT auth middleware before routes
// app.use(authMiddleware)

app.use('/api/swaps', swaps);
app.use('/api', timeoff);
app.use('/api', availability);
app.use('/api', schedule);

app.get('/health', (_req, res) => res.json({ ok: true }));

module.exports = app;
