// Express stub for Swap Shifts API
// This is a reference implementation sketch; wire into your existing app.

const express = require('express');
const bodyParser = require('body-parser');
const swaps = require('./routes/swaps');

const app = express();
app.use(bodyParser.json());

// TODO: plug in your JWT auth middleware before routes
// app.use(authMiddleware)

app.use('/api/swaps', swaps);

app.get('/health', (_req, res) => res.json({ ok: true }));

module.exports = app;

