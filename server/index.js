import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { join } from 'node:path';
import router from './router.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', router);

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
  const dist = join(import.meta.dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(join(dist, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`🎧 Ario is live at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY is not set. Create a .env file with your API key.');
    console.warn('   Copy .env.example → .env and add your key.');
  }
});
