export type EventKind =
  | 'ALERT_DISPATCH' | 'NET_TX_START' | 'NET_TX_END'
  | 'CLIENT_RECV' | 'CACHE_HIT' | 'CACHE_STORE' | 'DISPLAY';

export interface SimEvent { t: number; kind: EventKind; deviceId?: number; payload?: any; }
