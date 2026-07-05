import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/prisma';

describe('Auth Endpoints', () => {
  const getTestUser = (id: string) => ({
    name: 'Test User',
    email: `testauth_${id}@example.com`,
    password: 'password123',
  });

  it('should register a new user', async () => {
    const testUser = getTestUser('1');
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('should not register duplicate user', async () => {
    const testUser = getTestUser('2');
    await request(app).post('/api/auth/register').send(testUser);
    
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('An account with this email already exists');
  });

  it('should login an existing user', async () => {
    const testUser = getTestUser('3');
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged in successfully');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should fetch current user via /me when logged in', async () => {
    const testUser = getTestUser('4');
    await request(app).post('/api/auth/register').send(testUser);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    const cookie = loginRes.headers['set-cookie'];

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(testUser.email);
  });
});
