import { z } from 'zod';

const CardsItemSchema = z.object({
  id: z.string().uuid(),
  oracleId: z.string().uuid(),
  name: z.string(),
  releasedAt: z.string().datetime(),
  uri: z.string().url(),
  scryfallUri: z.string().url(),
  highresImage: z.boolean(),
  imageStatus: z.enum(['highres_scan', 'lowres', 'placeholder']),
  artOnlyUri: z.string().url(),
  fullCardUri: z.string().url(),
  colors: z.array(z.string()),
  setId: z.string().uuid(),
  set: z.string(),
  setName: z.string(),
  setType: z.enum([
    'core',
    'memorabilia',
    'expansion',
    'starter',
    'box',
    'masters',
    'draft_innovation',
    'commander',
    'masterpiece',
    'duel_deck',
    'planechase',
    'archenemy',
    'premium_deck',
    'spellbook',
    'from_the_vault',
    'arsenal',
    'token',
  ]),
  setUri: z.string().url(),
  setSearchUri: z.string().url(),
  artist: z.string(),
  artistIds: z.array(z.string().uuid()),
  borderColor: z.enum(['black', 'white', 'borderless', 'silver']),
  frame: z.union([z.string().regex(/^\d+$/), z.string()]),
  fullArt: z.boolean(),
  scryfallId: z.string().uuid(),
});

export const RecordSchema = z.object({
  name: z.string(),
  oldestCardDate: z.string().datetime(),
  cardCount: z.number().int(),
  cards: z.array(CardsItemSchema),
});

export type Record = z.infer<typeof RecordSchema>;
