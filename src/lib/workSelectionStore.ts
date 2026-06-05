type SelectionCallback = (id: string | null) => void;

let selectedWorkId: string | null = null;
const subscribers = new Set<SelectionCallback>();

export function setSelectedWork(id: string | null) {
  if (selectedWorkId === id) return;
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
