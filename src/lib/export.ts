export type Sheet = {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
};

function csvCell(v: string | number | null) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sheetsToCsv(sheets: Sheet[], theory: string[]) {
  const lines: string[] = [];
  sheets.forEach((s) => {
    lines.push(s.title);
    lines.push(s.columns.map(csvCell).join(","));
    s.rows.forEach((r) => lines.push(r.map(csvCell).join(",")));
    lines.push("");
  });
  if (theory.length) {
    lines.push("Theory");
    theory.forEach((t) => lines.push(csvCell(t)));
  }
  return lines.join("\n");
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export function sheetsToHtml(heading: string, sheets: Sheet[], theory: string[]) {
  const tables = sheets
    .map(
      (s) => `<h2>${esc(s.title)}</h2>
<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px">
<thead><tr>${s.columns.map((c) => `<th align="left">${esc(c)}</th>`).join("")}</tr></thead>
<tbody>${
        s.rows.length
          ? s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")
          : `<tr><td colspan="${s.columns.length}">Nothing recorded.</td></tr>`
      }</tbody></table>`,
    )
    .join("");

  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(
    heading,
  )}</title></head><body style="font-family:Arial,sans-serif"><h1>${esc(
    heading,
  )}</h1>${tables}<h2>Theory</h2>${theory
    .map((t) => `<p>${esc(t)}</p>`)
    .join("")}</body></html>`;
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function sheetsToText(heading: string, sheets: Sheet[], theory: string[]) {
  const parts = [`*${heading}*`];
  sheets.forEach((s) => {
    parts.push(`\n*${s.title}*`);
    if (!s.rows.length) parts.push("Nothing recorded.");
    s.rows.forEach((r) => parts.push(r.map((c) => (c === null ? "—" : String(c))).join(" | ")));
  });
  parts.push("\n*Theory*");
  theory.forEach((t) => parts.push(t));
  return parts.join("\n");
}
