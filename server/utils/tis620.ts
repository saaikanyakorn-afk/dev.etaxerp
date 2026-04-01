const UTF8_TO_TIS620: Record<number, number> = {};

for (let i = 0xA1; i <= 0xFB; i++) {
  const thaiCodePoint = 0x0E01 + (i - 0xA1);
  UTF8_TO_TIS620[thaiCodePoint] = i;
}
UTF8_TO_TIS620[0x0E3F] = 0xDF;

export function utf8ToTis620(str: string): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (UTF8_TO_TIS620[code] !== undefined) {
      bytes.push(UTF8_TO_TIS620[code]);
    } else {
      bytes.push(0x3F);
    }
  }
  return Buffer.from(bytes);
}

export function formatThaiDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear() + 543);
  return `${dd}/${mm}/${yyyy}`;
}

export function cleanTaxId(taxId: string | null | undefined): string {
  return (taxId || "").replace(/[^0-9]/g, "");
}

export function formatBranch(branch: string | null | undefined, length: number = 5): string {
  const cleaned = (branch || "00000").replace(/[^0-9]/g, "");
  if (!cleaned || cleaned === "0") return "00000".substring(0, length);
  return cleaned.padEnd(length, "0").substring(0, length);
}

export function fmtAmount(val: string | number | null | undefined): string {
  return Number(val || 0).toFixed(2);
}
