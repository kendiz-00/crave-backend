import 'dotenv/config';
import { createApp } from './app';
import { config } from '@/config';
import { connectDatabase, disconnectDatabase } from '@/database';

const app = createApp();

const server = app.listen(config.port, async () => {
  try {
    await connectDatabase();
    console.log(`🚀 CRAVE Platform API running on port ${config.port}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
    console.log(`🔗 Database connected`);
  } catch {
    console.log(`🚀 CRAVE Platform API running on port ${config.port}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
    console.log(`⚠️  Database connection failed - running without database`);
  }
});

const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    await disconnectDatabase();
    console.log('Database disconnected.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server };
