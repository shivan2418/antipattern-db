import { z } from 'zod';

const AddressCoordinatesSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().int(),
});

const PreferencesNotificationsSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
  frequency: z.string(),
});

const MetadataSessionSchema = z.object({
  id: z.string(),
  expires: z.string().datetime(),
  device: z.string(),
});

const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
  coordinates: AddressCoordinatesSchema,
});

const PreferencesSchema = z.object({
  theme: z.string(),
  language: z.string(),
  notifications: PreferencesNotificationsSchema,
});

const MetadataSchema = z.object({
  created: z.string().datetime(),
  lastLogin: z.string().datetime(),
  session: MetadataSessionSchema,
});

export const RecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().int(),
  address: AddressSchema,
  preferences: PreferencesSchema,
  roles: z.array(z.string()),
  metadata: MetadataSchema,
});

export type Record = z.infer<typeof RecordSchema>;
