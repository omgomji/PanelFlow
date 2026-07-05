'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { Suspense } from 'react';
import Link from 'next/link';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!loading && user) {
      router.replace(from);
      setTimeout(() => {
        if (window.location.pathname === '/login') {
          window.location.href = from;
        }
      }, 100);
    }
  }, [user, loading, from, router]);

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    try {
      await login(data.email, data.password);
      router.replace(from);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { error?: string } | undefined)?.error;
        setError(msg || 'Invalid email or password');
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-stamp" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-paper">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center border-2 border-ink text-stamp transform -rotate-6">
            <span className="material-symbols-outlined text-3xl font-bold">gavel</span>
          </div>
          <span className="font-display text-4xl font-bold tracking-tight text-ink">PanelFlow</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl uppercase tracking-widest text-ink">Authentication</CardTitle>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-6 border border-oxblood bg-oxblood/10 px-4 py-3 font-mono text-xs text-oxblood">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="mb-2 block font-display text-sm font-bold uppercase tracking-wider text-ink/70">
                  Email address
                </label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-oxblood font-mono">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block font-display text-sm font-bold uppercase tracking-wider text-ink/70">
                  Password
                </label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-oxblood font-mono">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                id="login-submit"
                disabled={isSubmitting}
                className="w-full text-sm font-bold uppercase tracking-widest"
              >
                {isSubmitting ? 'Authenticating...' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-ink/60 font-mono uppercase tracking-widest">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-stamp font-bold hover:underline">
                Register
              </Link>
            </p>

            {/* Dev hint / Demo Credentials */}
            <div className="mt-8 border-t-2 border-clay/30 pt-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-stamp text-xl">admin_panel_settings</span>
                <span className="font-display text-sm font-bold uppercase tracking-widest text-ink">Demo Credentials</span>
              </div>
              <p className="mb-4 font-mono text-[11px] text-ink/60">
                Use the pre-configured accounts to explore the dashboard.
              </p>
              
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setValue('email', 'om@example.com');
                  setValue('password', 'password123');
                }}
                className="w-full mb-4 text-xs font-bold uppercase tracking-wider"
              >
                Autofill Admin
              </Button>
              
              <div className="flex flex-col gap-1 border border-clay/30 p-3 bg-clay/5">
                <span className="font-display text-[10px] font-bold uppercase tracking-wider text-ink/70 mb-1">Interviewer Account:</span>
                <div className="flex justify-between items-center">
                  <code className="font-mono text-[11px] text-ink">emily.chen@example.com</code>
                  <code className="font-mono text-[11px] text-ink/60">password123</code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-paper"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-stamp" /></div>}>
      <LoginForm />
    </Suspense>
  );
}

