/**
 * Railway entry point — backend-only Express server.
 * Vercel serves the frontend; Railway handles all /api/* requests.
 */
import express from 'express';
import cors from 'cors';
import router from './router.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', name: 'Ario API', version: '1.0.0' });
});

// API routes
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`🎧 Ario API is live on port ${PORT}`);
});
