import type { Work } from "../types/work";

function slugPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getWorkId(work: Work, index: number) {
  const base = slugPart(`${work.year}-${work.artist}-${work.title}`) || "work";
  return `${base}-${index}`;
}
