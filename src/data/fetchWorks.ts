const BASE =
  "https://opensheet.elk.sh/1SUNeimLX56E4fBopXi7Dxg-VHRTp9keTad4lmVtirR0";

async function fetchSheet(name: string) {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`Failed: ${name}`);
  return res.json();
}

function parseValue(value: any, type: string) {
  if (value === "" || value == null) return null;

  switch (type) {
    case "number":
      return Number(value);

    case "boolean":
      return value === "true" || value === true;

    case "array":
      return String(value)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

    default:
      return value;
  }
}

export async function fetchWorks() {
  const [works, schemaRows] = await Promise.all([
    fetchSheet("Works"),
    fetchSheet("Schema"),
  ]);

  // schemaをmap化
  const schema: Record<string, string> = {};
  for (const row of schemaRows) {
    schema[row.field] = row.type;
  }

  return works.map((row: any) => {
    const parsed: any = {};

    for (const key in row) {
      const type = schema[key] || "string";
      parsed[key] = parseValue(row[key], type);
    }

    return parsed;
  });
}
