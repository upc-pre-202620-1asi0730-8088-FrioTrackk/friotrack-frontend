import { randomBytes } from 'node:crypto';

export function requirePreparedPostgres(settings) {
  const mode = settings.FRIOTRACK_PERSISTENCE ?? 'postgres';
  const connection = settings.FRIOTRACK_DB ?? settings.ConnectionStrings__FrioTrack;
  if (mode !== 'postgres' || typeof connection !== 'string' || !connection.trim()) {
    throw new Error('Configure the existing App Service for PostgreSQL with FRIOTRACK_DB or ConnectionStrings__FrioTrack before uploading AV2.');
  }
  if (settings.FRIOTRACK_MIGRATE === 'true') {
    throw new Error('Apply reviewed database migrations separately and disable FRIOTRACK_MIGRATE before a cloud redeployment.');
  }
  if (settings.FRIOTRACK_SEED === 'true') {
    throw new Error('Initialize the intended demonstration database separately and disable FRIOTRACK_SEED before a cloud redeployment.');
  }
}

export function requireCompatibleBackend(health) {
  const version = /^(\d+)\.(\d+)\.(\d+)(?:-[\w.-]+)?$/.exec(health?.version || '');
  if (health?.status !== 'ok' || health?.service !== 'FrioTrack' || health?.persistence !== 'postgresql' || !version || (Number(version[1]) === 0 && Number(version[2]) < 2)) {
    throw new Error('Publish and verify the PostgreSQL REST API version 0.2.0 or later before uploading the AV2 frontend.');
  }
}

export function requireCompatibleDeploymentOrder(components) {
  const api = components.indexOf('api'), frontend = components.indexOf('frontend');
  if (api >= 0 && frontend >= 0 && api > frontend) {
    throw new Error('Place the API before the frontend in the deployment plan so its REST contract is verified before the SPA upload.');
  }
}

export function createCoordinatorRegistrationProbe() {
  return {
    name: 'Deployment verification',
    email: `deployment-verification-${randomBytes(16).toString('hex')}@example.invalid`,
    organization: 'FrioTrack verification',
    password: 'Verification!' + randomBytes(16).toString('hex'),
    consent: true,
    role: 'coordinator'
  };
}
