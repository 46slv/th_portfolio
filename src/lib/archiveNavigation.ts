// Page use case: semantic panel/work IDs only. The browser implements the output port.
export type Disclosure = 'tag' | 'year' | 'audio';
export type Panel = Disclosure | 'detail';
export type ExitCause = 'toggle' | 'explicit-close' | 'escape';
export type DetailOrigin = { kind: 'point' | 'wheel'; workId: string };
export type FocusTarget = { kind: 'disclosure'; panel: Disclosure } | { kind: 'detail-close' } | DetailOrigin;

export type NavigationCommand =
  | { type: 'dismiss-preview' }
  | { type: 'cancel-exit'; panel: Panel; token: number }
  | { type: 'present'; active: Panel | null; exiting: Panel | null }
  | { type: 'begin-exit'; panel: Panel; token: number; cause: ExitCause }
  | { type: 'finish-exit'; panel: Panel; token: number }
  | { type: 'clear-detail' }
  | { type: 'render-detail'; workId: string }
  | { type: 'select-work'; workId: string }
  | { type: 'focus'; target: FocusTarget };

export interface NavigationOutput {
  apply(command: NavigationCommand): void;
}

export class ArchiveNavigation {
  private current: Panel | null = null;
  private origin: DetailOrigin | null = null;
  private exit: { panel: Panel; token: number } | null = null;
  private serial = 0;

  private readonly output: NavigationOutput;
  constructor(output: NavigationOutput) { this.output = output; }

  get active(): Panel | null { return this.current; }

  toggle(panel: Disclosure, reducedMotion = false): void {
    if (this.current === panel) this.navigate(null, false, reducedMotion ? null : 'toggle');
    else this.navigate(panel, false, null);
  }

  openWork(origin: DetailOrigin, available: boolean): boolean {
    if (!available) return false;
    // The Point's deliberate selection is distinct from a Wheel label click.
    if (origin.kind === 'point') this.output.apply({ type: 'select-work', workId: origin.workId });
    this.origin = origin;
    this.navigate('detail', false, null);
    this.output.apply({ type: 'render-detail', workId: origin.workId });
    this.output.apply({ type: 'focus', target: { kind: 'detail-close' } });
    return true;
  }

  wheelSelected(workId: string, available: boolean): void {
    if (this.current === 'detail' && available) this.output.apply({ type: 'render-detail', workId });
  }

  filtersApplied(): void { if (this.current === 'detail') this.navigate(null, false, null); }
  outsideClose(): void { this.navigate(null, false, null); }
  explicitClose(reducedMotion = false): void { this.navigate(null, true, reducedMotion ? null : 'explicit-close'); }
  escape(reducedMotion = false): void { this.navigate(null, true, reducedMotion ? null : 'escape'); }

  // Late completion after cancel/reopen cannot hide the new panel.
  finishExit(token: number): void {
    if (!this.exit || this.exit.token !== token) return;
    const { panel } = this.exit;
    this.exit = null;
    this.output.apply({ type: 'finish-exit', panel, token });
  }

  private navigate(next: Panel | null, restore: boolean, cause: ExitCause | null): void {
    if (this.current === next) return;
    if (this.exit) {
      const old = this.exit;
      this.exit = null;
      this.output.apply({ type: 'cancel-exit', ...old });
    }
    const previous = this.current;
    if (next) this.output.apply({ type: 'dismiss-preview' });
    const reverse = !next && cause !== null && previous !== null;
    if (previous === 'detail' && !reverse) this.output.apply({ type: 'clear-detail' });
    this.current = next;
    this.output.apply({ type: 'present', active: next, exiting: reverse ? previous : null });
    if (reverse && previous && cause) {
      const token = ++this.serial;
      this.exit = { panel: previous, token };
      this.output.apply({ type: 'begin-exit', panel: previous, token, cause });
    }
    if (restore && previous) {
      const target = previous === 'detail' ? this.origin : { kind: 'disclosure' as const, panel: previous };
      if (target) this.output.apply({ type: 'focus', target });
    }
    if (previous === 'detail') this.origin = null;
  }
}
