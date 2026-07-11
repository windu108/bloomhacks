require('dotenv').config();
const express = require('express');
const path = require('path');
const geocodeRouter = require('./server/routes/geocode');
const satelliteRouter = require('./server/routes/satellite');
const traceRouter = require('./server/routes/trace');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/geocode', geocodeRouter);
app.use('/api/satellite', satelliteRouter);
app.use('/api/trace', traceRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
