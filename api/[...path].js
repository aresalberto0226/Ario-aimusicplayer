import express from 'express';
import cors from 'cors';
import router from '../server/router.js';

const app = express();

app.use(cors());
app.use(express.json());

// On Vercel, requests come in with the full path (/api/...)
// Mount the router to handle /api/* routes
app.use('/api', router);

export default app;
