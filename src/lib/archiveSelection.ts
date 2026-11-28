// Selection use case: IDs and intent only. The output port owns the shared store and browser event.
export type SelectionIntent =
  | { kind: 'point-activate'; workId: string }
  | { kind: 'wheel-title'; workId: string | null }
  | { kind: 'wheel-station'; workId: string | null }
  | { kind: 'filter'; visibleIds: readonly string[]; fallbackIndex: number }
  | { kind: 'preview'; workId: string | null };

export type SelectionCommand =
  | { type: 'commit'; workId: string | null; reaffirm: boolean; fromWheel: boolean }
  | { type: 'wheel-selected'; workId: string };

export interface SelectionOutput {
  selected(): string | null;
  apply(command: SelectionCommand): void;
}

export type VisibleStation = { kind: 'keep' } | { kind: 'set'; index: number };
export type SelectionDecision = { changed: boolean; commands: SelectionCommand[] };
export type FilterDecision = SelectionDecision & { station: VisibleStation };

function decideFilter(visibleIds: readonly string[], fallbackIndex: number, selected: string | null): FilterDecision {
  const index = selected === null ? -1 : visibleIds.indexOf(selected);
  return {
    changed: index < 0 && selected !== null,
    // An empty filter has no station to clamp to. Preserve the Wheel's prior
    // index/offset so restoring the list exposes the same visual fallback.
    station: visibleIds.length ? { kind: 'set', index: index >= 0 ? index :
      Math.max(0, Math.min(fallbackIndex, visibleIds.length - 1)) } : { kind: 'keep' },
    commands: index < 0 && selected !== null
      ? [{ type: 'commit', workId: null, reaffirm: false, fromWheel: false }] : [],
  };
}

export function decideSelection(intent: SelectionIntent, selected: string | null): SelectionDecision | FilterDecision {
  if (intent.kind === 'preview') return { changed: false, commands: [] };
  if (intent.kind === 'filter') return decideFilter(intent.visibleIds, intent.fallbackIndex, selected);
  const id = intent.workId;
  if (intent.kind === 'point-activate') return {
    changed: selected !== id,
    commands: [{ type: 'commit', workId: id, reaffirm: true, fromWheel: false }],
  };
  const changed = selected !== id;
  if (!changed) return { changed: false, commands: [] };
  return {
    changed,
    commands: [
      { type: 'commit', workId: id, reaffirm: false, fromWheel: intent.kind === 'wheel-station' },
      ...(intent.kind === 'wheel-station' && id !== null ? [{ type: 'wheel-selected' as const, workId: id }] : []),
    ],
  };
}

export class ArchiveSelection {
  constructor(private readonly output: SelectionOutput) {}
  dispatch(intent: Exclude<SelectionIntent, { kind: 'filter' }>): SelectionDecision {
    // A transient preview has no committed-selection effect or store read.
    if (intent.kind === 'preview') return { changed: false, commands: [] };
    const decision = decideSelection(intent, this.output.selected());
    for (const command of decision.commands) this.output.apply(command);
    return decision;
  }
  filter(visibleIds: readonly string[], fallbackIndex: number, applyStation: (station: VisibleStation) => void): FilterDecision {
    const decision = decideFilter(visibleIds, fallbackIndex, this.output.selected());
    // Store subscribers run synchronously. Update the visual station before
    // the null commit publishes to them, exactly as the previous Wheel did.
    applyStation(decision.station);
    for (const command of decision.commands) this.output.apply(command);
    return decision;
  }
}
