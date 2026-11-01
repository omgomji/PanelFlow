'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { register as registerApi } from '@/lib/api';
import axios from 'axios';
import Link from 'next/link';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-paper">
        <div className="w-full max-w-md animate-pulse rounded-xl bg-paper/50 p-8">
          <div className="h-4 bg-ink/10 rounded w-full mb-4" />
          <div className="h-4 bg-ink/10 rounded w-3/4" />
        </div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  // Invitation support: prefill email and lock it when coming from an invite link
  const inviteToken = searchParams.get('token') || undefined;
  const invitedEmail = searchParams.get('email') || '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: invitedEmail,
      password: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError('');
    try {
      await registerApi({ ...data, inviteToken });
      router.push('/login?registered=1');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { error?: string } | undefined)?.error;
        setError(msg || 'Registration failed');
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  };

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
            <CardTitle className="text-center text-xl uppercase tracking-widest text-ink">
              {inviteToken ? 'Accept Invitation' : 'Create Account'}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {inviteToken && (
              <div className="mb-6 p-3 rounded-sm border-2 border-sage bg-sage/5 text-sage text-sm font-mono">
                You&rsquo;re invited to join PanelFlow. Your email is prefilled from your invitation link.
              </div>
            )}

            {error && (
              <div className="mb-6 border border-oxblood bg-oxblood/10 px-4 py-3 font-mono text-xs text-oxblood">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="mb-2 block font-display text-sm font-bold uppercase tracking-wider text-ink/70">
                  Full name
                </label>
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Your name"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-oxblood font-mono">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block font-display text-sm font-bold uppercase tracking-wider text-ink/70">
                  Email address
                </label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register('email')}
                  disabled={Boolean(inviteToken)}
                />
                {inviteToken && (
                  <p className="mt-1 text-xs text-sage font-mono">
                    Email locked to your invitation: {invitedEmail}
                  </p>
                )}
                {errors.email && (
                  <p className="mt-1 text-xs text-oxblood font-mono">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block font-display text-sm font-bold uppercase tracking-wider text-ink/70">
                  Password
                </label>
                <Input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-oxblood font-mono">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                id="register-submit"
                disabled={isSubmitting}
                className="w-full text-sm font-bold uppercase tracking-widest"
              >
                {isSubmitting ? 'Creating account...' : inviteToken ? 'Accept invitation' : 'Create account'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-ink/60 font-mono uppercase tracking-widest">
              Already have an account?{' '}
              <Link href="/login" className="text-stamp font-bold hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
