import Dexie from 'dexie';

export class WhosOnDB extends Dexie {
  constructor() {
    super('whoson');
    // Tables will be defined in AB-002
  }
}

export const db = new WhosOnDB();
