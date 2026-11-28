import { ArchiveSelection, type SelectionCommand, type SelectionIntent, type VisibleStation } from './archiveSelection';
import { getSelectedWork, setSelectedWork } from './workSelectionStore';

// One page-scoped output port for both the Wheel and navigation adapter. The
// store remains the only committed ID; this flag only protects synchronous
// Wheel-origin subscriber delivery (it is not a second selection state).
let wheelCommit = false;
export const isArchiveWheelCommit = () => wheelCommit;

const selection = new ArchiveSelection({
  selected: getSelectedWork,
  apply(command: SelectionCommand) {
    if (command.type === 'commit') {
      if (command.fromWheel) {
        const previous = wheelCommit;
        wheelCommit = true;
        try { setSelectedWork(command.workId, command.reaffirm); }
        finally { wheelCommit = previous; }
      } else setSelectedWork(command.workId, command.reaffirm);
    } else {
      window.dispatchEvent(new CustomEvent('archive-wheel-selected', { detail: command.workId }));
    }
  },
});

export function dispatchArchiveSelection(intent: Exclude<SelectionIntent, { kind: 'filter' }>) {
  return selection.dispatch(intent);
}

export function dispatchArchiveFilter(visibleIds: readonly string[], fallbackIndex: number, applyStation: (station: VisibleStation) => void) {
  return selection.filter(visibleIds, fallbackIndex, applyStation);
}
