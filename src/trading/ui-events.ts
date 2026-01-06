export type HybridMode = 'RESEARCH' | 'TRADING' | 'PAUSED';

export type HybridUiEventLevel = 'info' | 'ok' | 'warn' | 'error';

export interface HybridUiEvent {
  id: string;
  ts: number;
  level: HybridUiEventLevel;
  message: string;
  kind:
    | 'mode'
    | 'gate'
    | 'drift'
    | 'redline'
    | 'trade'
    | 'system';
}

export function newUiEvent(
  partial: Omit<HybridUiEvent, 'id' | 'ts'> & { ts?: number; id?: string }
): HybridUiEvent {
  const ts = partial.ts ?? Date.now();
  const id = partial.id ?? `${ts}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    ts,
    level: partial.level,
    message: partial.message,
    kind: partial.kind,
  };
}


