export function formatDate(
  val: string | null | undefined,
  era: string = "CE",
  dateFmt: string = "DD/MM/YYYY"
): string {
  if (!val) return "-";
  const d = new Date(val + (val.includes("T") ? "" : "T00:00:00"));
  if (isNaN(d.getTime())) return String(val);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const ceYear = d.getFullYear();
  const yyyy = String(era === "BE" ? ceYear + 543 : ceYear);
  const sep = dateFmt.includes("/") ? "/" : dateFmt.includes("-") ? "-" : ".";
  const parts = dateFmt.split(/[/\-\.]/);
  return parts
    .map((p) => {
      const pu = p.toUpperCase();
      if (pu.startsWith("D")) return dd;
      if (pu.startsWith("M")) return mm;
      if (pu.startsWith("Y")) return yyyy;
      return p;
    })
    .join(sep);
}

export function formatDateTime(
  val: string | null | undefined,
  era: string = "CE",
  dateFmt: string = "DD/MM/YYYY"
): string {
  if (!val) return "-";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const dateStr = formatDate(val, era, dateFmt);
  const hh = d.getHours().toString().padStart(2, "0");
  const mi = d.getMinutes().toString().padStart(2, "0");
  return `${dateStr} ${hh}:${mi}`;
}

export function formatNumber(
  val: number | string | null | undefined,
  decimals: number = 2
): string {
  if (val == null || val === "") return "-";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "-";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
