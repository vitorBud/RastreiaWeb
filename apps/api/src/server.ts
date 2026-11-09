import { app } from './app.js';

const port = Number(process.env.PORT ?? 3333);

const server = app.listen(port, () => {
  console.log(`API do RastreiaWeb disponível em http://localhost:${port}`);
});

function shutdown(signal: string) {
  console.log(`Sinal ${signal} recebido. Encerrando a API.`);
  server.close((error) => {
    if (error) {
      console.error('Falha ao encerrar a API.', error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
