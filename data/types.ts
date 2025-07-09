// Auto-generated TypeScript types

export interface CardsItem {
  id: string;
  oracleId: string;
  name: string;
  releasedAt: string;
  uri: string;
  scryfallUri: string;
  highresImage: boolean;
  imageStatus: 'highres_scan' | 'lowres' | 'placeholder';
  artOnlyUri: string;
  fullCardUri: string;
  colors: string[];
  setId: string;
  set: string;
  setName: string;
  setType: 'core' | 'memorabilia' | 'expansion' | 'starter' | 'box' | 'masters' | 'draft_innovation' | 'commander' | 'masterpiece' | 'duel_deck' | 'planechase' | 'archenemy' | 'premium_deck' | 'spellbook' | 'from_the_vault' | 'arsenal' | 'token';
  setUri: string;
  setSearchUri: string;
  artist: string;
  artistIds: string[];
  borderColor: 'black' | 'white' | 'borderless' | 'silver';
  frame: '1993' | '1997' | '2003' | '2015' | 'future';
  fullArt: boolean;
  scryfallId: string;
}

export interface GeneratedRecord {
  name: string;
  oldestCardDate: string;
  cardCount: number;
  cards: CardsItem[];
}

