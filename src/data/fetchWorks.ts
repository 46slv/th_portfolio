const BASE =
  "https://opensheet.elk.sh/1SUNeimLX56E4fBopXi7Dxg-VHRTp9keTad4lmVtirR0";

async function fetchSheet(name: string) {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) {
    if (name === "Schema") return [];
    throw new Error(`Failed: ${name}`);
  }
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
      // 💡 year が string で定義されていればそのまま文字列として返ります
      return String(value); 
  }
}

export async function fetchWorks() {
  const [works, schemaRows] = await Promise.all([
    fetchSheet("Works"),
    fetchSheet("Schema"),
  ]);

  const schema: Record<string, string> = {};
  for (const row of schemaRows) {
    if (row.field) schema[row.field] = row.type;
  }

  return works.map((row: any) => {
    const parsed: any = {};

    for (const key in row) {
      // 💡 スプレッドシートの列名が 'year' で、Schemaシートに 'year' : 'string' と書いてあれば自動適用
      const type = schema[key] || "string";
      parsed[key] = parseValue(row[key], type);
    }

    // 数値バリデーション
    parsed.x = isNaN(Number(parsed.x)) ? 0 : Number(parsed.x);
    parsed.y = isNaN(Number(parsed.y)) ? 0 : Number(parsed.y);

    // 💡 既存の tags 用の個別処理（Schemaに頼らない安全策）
    if (parsed.tags && typeof parsed.tags === "string") {
      parsed.tags = parsed.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
    } else if (!parsed.tags) {
      parsed.tags = [];
    }

    // 💡 year が undefined の場合のフォールバック（必要に応じて）
    if (!parsed.year) {
      parsed.year = "Unknown";
    }

    return parsed;
  });
}
