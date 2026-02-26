import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { authenticate } from './middleware/auth.js';
import { requestLoggingMiddleware, log, formatError } from './services/logger.js';
import partnersRouter from './routes/partners.js';
import partnerKeysRouter from './routes/partnerKeys.js';
import devicesRouter from './routes/devices.js';
import deviceSpecsRouter from './routes/deviceSpecs.js';
import tiersRouter from './routes/tiers.js';
import telemetryRouter from './routes/telemetry.js';
import alertsRouter from './routes/alerts.js';
import auditRouter from './routes/audit.js';
import searchRouter from './routes/search.js';
import reportsRouter from './routes/reports.js';
import uploadRouter from './routes/upload.js';

admin.initializeApp();
log.info('Firebase Admin initialized');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' }));
app.use(requestLoggingMiddleware);

app.use('/api', authenticate);

app.use('/api/partners', partnersRouter);
app.use('/api/partner-keys', partnerKeysRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/device-specs', deviceSpecsRouter);
app.use('/api/tiers', tiersRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/search', searchRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/upload', uploadRouter);

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const rlog = req.log;
    if (rlog) {
      rlog.error('Unhandled error in request pipeline', formatError(err));
    } else {
      log.error('Unhandled error (no request context)', formatError(err));
    }
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  },
);

log.info('Express app configured with all routes');

export const api = onRequest({ region: 'us-central1', invoker: 'private' }, app);
