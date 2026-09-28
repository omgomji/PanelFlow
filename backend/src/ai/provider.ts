import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { aiConfig } from './config';

export type AiProvider = 'gemini' | 'groq';

type Invocation<T> = {
  value: T;
  provider: AiProvider;
};

let groqUnavailableUntil = 0;
let geminiUnavailableUntil = 0;

export function isProviderLimitError(error: unknown): boolean {
  const candidate = error as { status?: number; code?: string; message?: string } | null;
  const status = Number(candidate?.status);
  const code = String(candidate?.code || '').toLowerCase();
  const message = String(candidate?.message || error || '').toLowerCase();

  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code.includes('resource_exhausted') ||
    code.includes('rate_limit') ||
    message.includes('resource_exhausted') ||
    message.includes('rate limit') ||
    message.includes('quota exceeded') ||
    message.includes('too many requests') ||
    message.includes('temporarily unavailable')
  );
}

export function markGroqUnavailable(error: unknown) {
  groqUnavailableUntil = Date.now() + aiConfig.groqFallbackCooldownMs;
  const candidate = error as { status?: number; code?: string } | null;
  console.warn('[ai] Groq provider temporarily unavailable; using Gemini fallback', {
    status: candidate?.status,
    code: candidate?.code,
    cooldownMs: aiConfig.groqFallbackCooldownMs,
  });
}

export function groqIsInCooldown(): boolean {
  return Date.now() < groqUnavailableUntil;
}

export function markGeminiUnavailable(error: unknown) {
  geminiUnavailableUntil = Date.now() + aiConfig.geminiFallbackCooldownMs;
  const candidate = error as { status?: number; code?: string } | null;
  console.warn('[ai] Gemini embeddings temporarily unavailable; using lexical retrieval fallback', {
    status: candidate?.status,
    code: candidate?.code,
    cooldownMs: aiConfig.geminiFallbackCooldownMs,
  });
}

export function createGeminiChatModel() {
  if (!aiConfig.hasGeminiKey()) return null;
  return new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY as string,
    model: aiConfig.geminiModel,
    temperature: 0,
    maxRetries: 2,
  });
}

export function createGroqChatModel() {
  if (!aiConfig.hasGroqKey()) return null;
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY as string,
    model: aiConfig.groqModel,
    temperature: 0,
    timeout: aiConfig.requestTimeoutMs,
    maxRetries: 2,
  });
}

export async function invokeWithGroqFirst<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<Invocation<T>> {
  aiConfig.requireChatProviderKey();

  if (aiConfig.hasGroqKey() && !groqIsInCooldown()) {
    try {
      return { value: await primary(), provider: 'groq' };
    } catch (error) {
      if (!aiConfig.hasGeminiKey() || !isProviderLimitError(error)) throw error;
      markGroqUnavailable(error);
    }
  }

  if (!aiConfig.hasGeminiKey()) {
    throw new Error('Groq is currently unavailable and no Gemini fallback key is configured.');
  }

  return { value: await fallback(), provider: 'gemini' };
}

export async function invokeChatWithFallback(
  messages: any,
): Promise<Invocation<any>> {
  const gemini = createGeminiChatModel();
  const groq = createGroqChatModel();

  return invokeWithGroqFirst(
    async () => {
      if (!groq) throw new Error('Groq key is not configured.');
      return groq.invoke(messages);
    },
    async () => {
      if (!gemini) throw new Error('Gemini key is not configured.');
      return gemini.invoke(messages);
    },
  );
}

export async function invokeStructuredWithFallback<T>(
  schema: any,
  messages: any,
): Promise<Invocation<T>> {
  const gemini = createGeminiChatModel();
  const groq = createGroqChatModel();
  const geminiStructured = gemini?.withStructuredOutput<T>(schema);
  // Qwen's reasoning models can emit blank tool arguments when forced through
  // function calling. JSON mode preserves schema parsing without that tool call.
  const groqStructured = groq?.withStructuredOutput<T>(schema, { method: 'jsonMode' });

  return invokeWithGroqFirst(
    async () => {
      if (!groqStructured) throw new Error('Groq key is not configured.');
      return groqStructured.invoke(messages) as Promise<T>;
    },
    async () => {
      if (!geminiStructured) throw new Error('Gemini key is not configured.');
      return geminiStructured.invoke(messages) as Promise<T>;
    },
  );
}

export function providerStatus() {
  return {
    geminiConfigured: aiConfig.hasGeminiKey(),
    groqConfigured: aiConfig.hasGroqKey(),
    groqInCooldown: groqIsInCooldown(),
    geminiInCooldown: Date.now() < geminiUnavailableUntil,
  };
}
