require('dotenv').config();
const express = require('express');
const cors = require('cors');
const geocodeRouter    = require('./server/routes/geocode.cjs');
const satelliteRouter  = require('./server/routes/satellite.cjs');
const traceRouter      = require('./server/routes/trace.cjs');
const solarRouter      = require('./server/routes/solar.cjs');
const recommendRouter  = require('./server/routes/recommend.cjs');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/geocode',    geocodeRouter);
app.use('/api/satellite',  satelliteRouter);
app.use('/api/trace',      traceRouter);
app.use('/api/solar',      solarRouter);
app.use('/api/recommend',  recommendRouter);

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
