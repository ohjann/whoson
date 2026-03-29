export interface FestivalTheme {
  preset?: 'night-rave' | 'day-festival' | 'synthwave' | 'minimal';
  primary?: string;
  secondary?: string;
  accent?: string;
  base?: string;
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
  icalUrl?: string; // iCal feed URL for auto-sync
  lastSyncAt?: string; // ISO datetime of last successful Clashfinder sync
  printAdvisoryLevel?: number; // 1-5, from Clashfinder
  printAdvisoryLabel?: string; // e.g. "5 - Don't even think about it"
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
  clashRank?: number;
  notes?: string;
  createdAt: string;
  notifyMinutesBefore?: number; // minutes before act start to notify (0 = at start)
  notificationId?: number; // Capacitor local notification ID
}

export interface HiddenAct {
  id?: number;
  festivalId: number;
  actId: number;
  createdAt: string;
}

export interface FestivalMap {
  festivalId: number; // primary key
  imageBlob: Blob;
  updatedAt: string;
}

export interface AppSettings {
  id?: number;
  activeFestivalId?: number;
  notificationsEnabled: boolean;
  notifyMinutesBefore?: number; // default lead time for notifications (minutes)
}
