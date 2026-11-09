import cors from 'cors';
import express from 'express';

export const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    service: 'rastreiaweb-api',
    status: 'ok',
  });
});

app.use((_request, response) => {
  response.status(404).json({
    error: 'Rota não encontrada.',
  });
});
