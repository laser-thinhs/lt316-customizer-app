const FORMULA_PREFIX = /^[=+\-@]/;

export function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, header, idx) => {
      acc[header] = cols[idx] ?? "";
      return acc;
    }, {});
  });

  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  out.push(current.trim());
  return out;
}

export function toErrorCsv(rows: Array<Record<string, string>>) {
  if (rows.length === 0) return "rowIndex,error\n";
  const headers = Object.keys(rows[0]);
  const body = rows
    .map((row) => headers.map((header) => sanitizeForCsvExport(row[header] ?? "")).join(","))
    .join("\n");
  return `${headers.join(",")}\n${body}\n`;
}

function sanitizeForCsvExport(value: string) {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
