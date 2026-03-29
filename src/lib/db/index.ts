import Dexie, { type EntityTable } from 'dexie';
import type { Act, AppSettings, Festival, FestivalMap, HiddenAct, UserHighlight } from '$lib/types';

export class WhosOnDB extends Dexie {
  festivals!: EntityTable<Festival, 'id'>;
  acts!: EntityTable<Act, 'id'>;
  highlights!: EntityTable<UserHighlight, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  festivalMaps!: EntityTable<FestivalMap, 'festivalId'>;
  hiddenActs!: EntityTable<HiddenAct, 'id'>;

  constructor() {
    super('whoson');
    this.version(1).stores({
      festivals: '++id, name, startDate, endDate',
      acts: '++id, festivalId, [festivalId+stage], [festivalId+startTime], name, stage, startTime',
      highlights: '++id, festivalId, actId, [festivalId+actId]',
      settings: '++id',
      festivalMaps: 'festivalId'
    });
    this.version(2).stores({
      hiddenActs: '++id, festivalId, actId, [festivalId+actId]'
    });
  }
}

export const db = new WhosOnDB();
