/**
 * Auth Controller
 *
 * Handles HTTP layer for register, login, logout, and /me.
 *
 * Cookie config differs between dev and production:
 *   - secure: only in prod (requires HTTPS)
 *   - sameSite: 'none' in prod for cross-origin Vercel→Render, 'lax' in dev
 * This is mandatory — SameSite=None requires Secure=true, unavailable on localhost.
 */
import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 mins in ms
const REFRESH_TOKEN_MAX_AGE = 6 * 60 * 60 * 1000; // 6 hours in ms

function setCookieOptions(isProd: boolean, maxAge: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    maxAge,
  };
}

export const authController = {
  async register(req: Request, res: Response) {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name || !email || !password) {
      throw new BadRequestError('name, email, and password are required');
    }
    if (password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters');
    }

    const user = await authService.register({ name, email, password });
    res.status(201).json({ user });
  },

  async login(req: Request, res: Response) {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      throw new BadRequestError('email and password are required');
    }

    const { accessToken, refreshToken } = await authService.login(email, password);
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('accessToken', accessToken, setCookieOptions(isProd, ACCESS_TOKEN_MAX_AGE));
    res.cookie('refreshToken', refreshToken, setCookieOptions(isProd, REFRESH_TOKEN_MAX_AGE));
    res.json({ message: 'Logged in successfully' });
  },

  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedError('No refresh token provided');
    }

    const { accessToken } = await authService.refresh(refreshToken);
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('accessToken', accessToken, setCookieOptions(isProd, ACCESS_TOKEN_MAX_AGE));
    res.json({ message: 'Token refreshed successfully' });
  },

  async logout(_req: Request, res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    const clearOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('none' as const) : ('lax' as const),
    };
    res.clearCookie('accessToken', clearOptions);
    res.clearCookie('refreshToken', clearOptions);
    res.json({ message: 'Logged out successfully' });
  },

  async me(req: Request, res: Response) {
    // req.user is guaranteed by requireAuth middleware
    const user = await authService.getMe(req.user!.id);
    res.json({ user });
  },
};
