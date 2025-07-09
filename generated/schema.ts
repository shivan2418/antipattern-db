import { z } from 'zod';

export const RecordSchema = z.object({
  name: z.string().optional(),
  oldestCardDate: z.string().datetime().optional(),
  cardCount: z.number().int().optional(),
  cards: z.array(z.unknown()).optional(),
});

export type Record = z.infer<typeof RecordSchema>;
