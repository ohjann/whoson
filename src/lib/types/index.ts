export type ActPriority = 1 | 2 | 3;

export interface FestivalTheme {
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface Festival {
  id?: number;
  name: string;
  timezone: string; // IANA timezone string, e.g. 'Europe/Amsterdam'
  dayBoundaryHour: number; // default 6, hour at which the "day" resets
  startDate: string; // ISO 8601 date string
  endDate: string; // ISO 8601 date string
  theme?: FestivalTheme;
  clashfinderSlug?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Act {
  id?: number;
  festivalId: number;
  name: string;
  stage: string;
  startTime: string; // ISO 8601 datetime string (festival-local time)
  endTime: string; // ISO 8601 datetime string (festival-local time)
  description?: string;
  genre?: string;
  imageUrl?: string;
}

export interface UserHighlight {
  id?: number;
  festivalId: number;
  actId: number;
  priority?: ActPriority;
  notes?: string;
  createdAt: string;
}

export interface FestivalMap {
  festivalId: number; // primary key
  imageBlob: Blob;
  updatedAt: string;
}

export interface AppSettings {
  id?: number;
  clashfinderUsername?: string;
  // Note: private key is NOT stored in plaintext — use AB-004 credential encryption
  encryptedPrivateKey?: string;
  defaultFestivalId?: number;
  notificationsEnabled: boolean;
  ntfyTopic?: string;
}
