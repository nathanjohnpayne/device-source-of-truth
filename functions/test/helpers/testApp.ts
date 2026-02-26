import express from 'express';
import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';
import partnersRouter from '../../src/routes/partners.js';
import partnerKeysRouter from '../../src/routes/partnerKeys.js';
import devicesRouter from '../../src/routes/devices.js';
import deviceSpecsRouter from '../../src/routes/deviceSpecs.js';
import tiersRouter from '../../src/routes/tiers.js';
import telemetryRouter from '../../src/routes/telemetry.js';
import alertsRouter from '../../src/routes/alerts.js';
import auditRouter from '../../src/routes/audit.js';
import searchRouter from '../../src/routes/search.js';
import reportsRouter from '../../src/routes/reports.js';
import uploadRouter from '../../src/routes/upload.js';

interface AuthUser {
  uid: string;
  email: string;
  role: string;
  displayName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function stubAuth(role: string = 'admin') {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      uid: 'test-uid',
      email: 'test@disney.com',
      role,
      displayName: 'Test User',
    };
    const noop = () => {};
    const logger = {
      info: noop, warn: noop, error: noop, debug: noop,
      child: () => logger,
      elapsedMs: () => 0,
    };
    (req as Record<string, unknown>).log = logger;
    next();
  };
}

export function createTestApp(role: string = 'admin') {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '50mb' }));
  app.use(stubAuth(role));

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

  return app;
}
