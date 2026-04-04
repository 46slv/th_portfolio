export async function fetchWorks() {
  const res = await fetch(
    "https://opensheet.elk.sh/1SUNeimLX56E4fBopXi7Dxg-VHRTp9keTad4lmVtirR0/Works"
  );

  if (!res.ok) {
    throw new Error("Failed to fetch works");
  }

  const data = await res.json();

  return data.map((row: any) => ({
    title: row.title ?? "",
    artist: row.artist ?? "",
    release: row.release ?? "",
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
    url: row.url ?? "",
  }));
}
