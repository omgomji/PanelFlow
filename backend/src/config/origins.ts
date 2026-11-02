const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

export function getAllowedFrontendOrigins(): string[] {
  return (process.env.FRONTEND_URL || DEFAULT_FRONTEND_ORIGIN)
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function getPrimaryFrontendOrigin(): string {
  return getAllowedFrontendOrigins()[0] || DEFAULT_FRONTEND_ORIGIN;
}

export function isAllowedFrontendOrigin(origin: string): boolean {
  return getAllowedFrontendOrigins().includes(origin.replace(/\/$/, ''));
}
