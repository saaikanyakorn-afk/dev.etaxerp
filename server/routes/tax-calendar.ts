import type { Express } from "express";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export interface TaxDeadline {
  date: string;
  title: string;
  forms: string[];
  type: "filing" | "e-filing";
  note?: string;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function adjustForWeekend(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() + 2);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  return d;
}

export function getStandardTaxDeadlines(year: number, month: number): TaxDeadline[] {
  const deadlines: TaxDeadline[] = [];

  const filing7 = adjustForWeekend(new Date(year, month - 1, 7));
  deadlines.push({
    date: formatDate(filing7),
    title: "ยื่นแบบ ภ.ง.ด.1/2/3/53/54, ภ.พ.36",
    forms: ["ภ.ง.ด.1", "ภ.ง.ด.2", "ภ.ง.ด.3", "ภ.ง.ด.53", "ภ.ง.ด.54", "ภ.พ.36"],
    type: "filing",
  });

  const efiling15 = adjustForWeekend(new Date(year, month - 1, 15));
  deadlines.push({
    date: formatDate(efiling15),
    title: "ยื่น ภ.ง.ด.1/2/3/53/54 ทางอินเทอร์เน็ต",
    forms: ["ภ.ง.ด.1", "ภ.ง.ด.2", "ภ.ง.ด.3", "ภ.ง.ด.53", "ภ.ง.ด.54", "ภ.พ.36"],
    type: "e-filing",
  });

  const filing15 = adjustForWeekend(new Date(year, month - 1, 15));
  deadlines.push({
    date: formatDate(filing15),
    title: "ยื่นแบบ ภ.พ.30, ภ.ธ.40",
    forms: ["ภ.พ.30", "ภ.ธ.40"],
    type: "filing",
  });

  const efiling23 = adjustForWeekend(new Date(year, month - 1, 23));
  deadlines.push({
    date: formatDate(efiling23),
    title: "ยื่น ภ.พ.30, ภ.ธ.40 ทางอินเทอร์เน็ต",
    forms: ["ภ.พ.30", "ภ.ธ.40"],
    type: "e-filing",
  });

  if (month === 2) {
    const lastFeb = new Date(year, 2, 0);
    const dayFeb = adjustForWeekend(lastFeb);
    deadlines.push({
      date: formatDate(dayFeb),
      title: "ยื่น ภ.ง.ด.1ก (สรุปประจำปี)",
      forms: ["ภ.ง.ด.1ก"],
      type: "filing",
    });
  }

  if (month === 3) {
    const day31 = adjustForWeekend(new Date(year, 2, 31));
    deadlines.push({
      date: formatDate(day31),
      title: "ยื่น ภ.ง.ด.90/91 (ภาษีบุคคลธรรมดา)",
      forms: ["ภ.ง.ด.90", "ภ.ง.ด.91"],
      type: "filing",
    });
  }

  if (month === 5) {
    const day31 = adjustForWeekend(new Date(year, 4, 31));
    deadlines.push({
      date: formatDate(day31),
      title: "ยื่น ภ.ง.ด.50 (ภาษีนิติบุคคล 12 เดือน)",
      forms: ["ภ.ง.ด.50"],
      type: "filing",
    });
  }

  if (month === 8) {
    const day31 = adjustForWeekend(new Date(year, 7, 31));
    deadlines.push({
      date: formatDate(day31),
      title: "ยื่น ภ.ง.ด.51 (ภาษีนิติบุคคลครึ่งปี)",
      forms: ["ภ.ง.ด.51"],
      type: "filing",
    });
  }

  return deadlines;
}

export function getUpcomingTaxDeadlines(daysAhead: number = 7): TaxDeadline[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const futureLimit = new Date(today);
  futureLimit.setDate(futureLimit.getDate() + daysAhead);

  const thisMonth = getStandardTaxDeadlines(now.getFullYear(), now.getMonth() + 1);
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = getStandardTaxDeadlines(nextDate.getFullYear(), nextDate.getMonth() + 1);

  return [...thisMonth, ...nextMonth].filter(d => {
    const dlDate = new Date(d.date + "T00:00:00");
    return dlDate >= today && dlDate <= futureLimit;
  });
}

let cachedRdData: { month: number; year: number; deadlines: TaxDeadline[] }[] = [];

async function scrapeRdCalendar(year: number, month: number): Promise<TaxDeadline[]> {
  try {
    const beYear = year + 543;
    const url = month === new Date().getMonth() + 1 && year === new Date().getFullYear()
      ? "https://www.rd.go.th/62348.html"
      : `https://www.rd.go.th/62348/archive/${beYear}/${month}.html`;

    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 E-Tax Center Calendar" },
    });
    if (!resp.ok) return [];

    const html = await resp.text();
    const deadlines: TaxDeadline[] = [];

    const dayPattern = /(\d{1,2})\s*\n\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)/g;
    let match;
    while ((match = dayPattern.exec(html)) !== null) {
      const day = parseInt(match[1]);
      if (day > 0 && day <= 31) {
        const section = html.slice(match.index, match.index + 1000);
        const formMatches = section.match(/ภ\.\S+\.\s*\d+\S*/g) || [];
        const isEfiling = section.includes("อินเทอร์เน็ต");
        if (formMatches.length > 0) {
          const pad = (n: number) => n.toString().padStart(2, "0");
          deadlines.push({
            date: `${year}-${pad(month)}-${pad(day)}`,
            title: isEfiling
              ? `ยื่น ${formMatches.join(", ")} ทางอินเทอร์เน็ต`
              : `ยื่นแบบ ${formMatches.join(", ")}`,
            forms: formMatches,
            type: isEfiling ? "e-filing" : "filing",
          });
        }
      }
    }

    return deadlines;
  } catch {
    return [];
  }
}

export function registerTaxCalendarRoutes(app: Express) {
  app.get("/api/calendar/tax-deadlines", requireAuth, async (req, res) => {
    try {
      const { year, month } = req.query;
      if (!year || !month) return res.status(400).json({ error: "year and month required" });

      const y = Number(year);
      const m = Number(month);

      const cached = cachedRdData.find(c => c.year === y && c.month === m);
      if (cached && cached.deadlines.length > 0) {
        return res.json({ deadlines: cached.deadlines, source: "rd_cached" });
      }

      const standard = getStandardTaxDeadlines(y, m);
      return res.json({ deadlines: standard, source: "standard" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/calendar/tax-deadlines/upcoming", requireAuth, async (req, res) => {
    try {
      const days = Number(req.query.days) || 7;
      const deadlines = getUpcomingTaxDeadlines(days);
      res.json({ deadlines });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/calendar/tax-deadlines/sync", requireAuth, async (req, res) => {
    try {
      const { year, month } = req.body;
      if (!year || !month) return res.status(400).json({ error: "year and month required" });

      const y = Number(year);
      const m = Number(month);

      const scraped = await scrapeRdCalendar(y, m);
      if (scraped.length > 0) {
        cachedRdData = cachedRdData.filter(c => !(c.year === y && c.month === m));
        cachedRdData.push({ year: y, month: m, deadlines: scraped });
        return res.json({ deadlines: scraped, source: "rd_scraped", count: scraped.length });
      }

      const standard = getStandardTaxDeadlines(y, m);
      return res.json({ deadlines: standard, source: "standard_fallback", count: standard.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
