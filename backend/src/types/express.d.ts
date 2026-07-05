/**
 * Express Request Augmentation
 *
 * Adds the `user` property set by requireAuth middleware.
 * Without this declaration, TypeScript rejects all `req.user` accesses
 * in controllers and services that receive a typed Request object.
 */
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: 'ADMIN' | 'INTERVIEWER' };
    }
  }
}

export {};
