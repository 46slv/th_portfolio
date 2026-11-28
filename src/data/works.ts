import { fetchWorks } from './fetchWorks';
import { getWorkId } from '../lib/workIds';

export const works = await fetchWorks();
// The source-row index is part of the ID. Derive entries before any UI filtering.
export const wheelEntries = works.map((work, index) => ({ id: getWorkId(work, index), work }));
