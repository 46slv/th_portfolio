type SelectionCallback = (id: string | null) => void;

let selectedWorkId: string | null = null;
const subscribers = new Set<SelectionCallback>();

// A deliberate selection can supersede an in-progress interaction even when
// the last committed Work ID is the same.
export function setSelectedWork(id: string | null, reaffirm = false) {
  if (selectedWorkId === id && !reaffirm) return;
  selectedWorkId = id;
  subscribers.forEach((callback) => callback(selectedWorkId));
}

export function getSelectedWork() {
  return selectedWorkId;
}

export function subscribe(callback: SelectionCallback) {
  subscribers.add(callback);
  callback(selectedWorkId);
  return () => subscribers.delete(callback);
}
