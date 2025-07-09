// Auto-generated TypeScript types

export interface AddressCoordinates {
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface PreferencesNotifications {
  email: boolean;
  sms: boolean;
  push: boolean;
  frequency: string;
}

export interface MetadataSession {
  id: string;
  expires: string;
  device: string;
}

export interface Address {
  street: string;
  city: string;
  country: string;
  coordinates: AddressCoordinates;
}

export interface Preferences {
  theme: string;
  language: string;
  notifications: PreferencesNotifications;
}

export interface Metadata {
  created: string;
  lastLogin: string;
  session: MetadataSession;
}

export interface GeneratedRecord {
  id: string;
  name: string;
  email: string;
  age: number;
  address: Address;
  preferences: Preferences;
  roles: string[];
  metadata: Metadata;
}

