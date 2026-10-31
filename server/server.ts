import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { getDatabase } from './db/index.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { orderRoutes } from './routes/orders.js';
import { whatsappRoutes } from './routes/whatsapp.js';
import { settingsRoutes } from './routes/settings.js';
import { financialRoutes } from './routes/financial.js';

dotenv.config();

export async function buildApp() {
  const app = fastify({
    logger: process.env.NODE_ENV === 'test' ? false : true
  });

  // Ensure database is initialized
  getDatabase();

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  // Healthcheck
  app.get('/api/health', async () => {
    return {
      status: 'healthy',
      app: 'COD RTO Intelligence',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    };
  });

  // Register API routes
  await app.register(dashboardRoutes);
  await app.register(orderRoutes);
  await app.register(whatsappRoutes);
  await app.register(settingsRoutes);
  await app.register(financialRoutes);

  // Serve frontend static build if present
  const clientDist = path.join(process.cwd(), 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: '/'
    });

    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url && req.raw.url.startsWith('/api')) {
        reply.code(404).send({ error: 'API endpoint not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const PORT = parseInt(process.env.PORT || '3001', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  buildApp()
    .then(server => {
      server.listen({ port: PORT, host: HOST }, (err, address) => {
        if (err) {
          console.error('Server failed to start:', err);
          process.exit(1);
        }
        console.log(`COD RTO Intelligence API running at ${address}`);
      });
    })
    .catch(err => {
      console.error('Failed to initialize application:', err);
      process.exit(1);
    });
}
