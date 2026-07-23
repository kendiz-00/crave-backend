import * as Sentry from '@sentry/node';
import { config } from '@/config';

export function initSentry(): void {
  if (!config.sentry.dsn) {
    console.log('Sentry DSN not configured, skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.isProduction ? 0.1 : 1.0,
    beforeSend(event) {
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });

  console.log('Sentry initialized');
}

export function captureException(error: Error): void {
  Sentry.captureException(error);
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, { level });
}
