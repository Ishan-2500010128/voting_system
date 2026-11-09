import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import routes from './routes.js';

for (const k of ['MONGODB_URI', 'JWT_SECRET', 'BALLOT_KEY']) {
  if (!process.env[k]) { console.error(`Missing ${k} in server/.env`); process.exit(1); }
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use('/api', routes);

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.name === 'CastError') return res.status(404).json({ error: 'Not found.' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on the server.' });
});

await mongoose.connect(process.env.MONGODB_URI);
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API ready on http://localhost:${port}`));
