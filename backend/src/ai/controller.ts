import type { Request, Response } from 'express';
import { BadRequestError } from '../utils/errors';
import { z } from 'zod4';
import { aiConfig } from './config';
import { screenAiQuery } from './security';
import { runPanelFlowAi } from './graph';
import { reindexAll } from './indexers/indexer.service';

const ChatRequestSchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  context: z.object({
    meetingId: z.number().int().positive().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).optional(),
}).strict();

export const aiController = {
  async chat(req: Request, res: Response) {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError('Invalid AI request. Provide a query and optional meeting/date context.');

    const screened = screenAiQuery(parsed.data.query);
    if (screened.allowed === false) {
      const reason = screened.reason;
      throw new BadRequestError(
        reason === 'prompt_injection'
          ? 'This request conflicts with PanelFlow AI security rules.'
          : 'Please provide a normal PanelFlow question.'
      );
    }

    aiConfig.requireChatProviderKey();
    const result = await runPanelFlowAi({
      userId: req.user!.id,
      role: req.user!.role,
      query: screened.normalizedQuery,
      context: parsed.data.context,
    });
    res.json(result);
  },

  async rebuildIndex(_req: Request, res: Response) {
    aiConfig.requireEmbeddingKey();
    const startedAt = Date.now();
    const result = await reindexAll();
    console.info('[ai] index rebuild', { ...result, latencyMs: Date.now() - startedAt });
    res.json(result);
  },
};
