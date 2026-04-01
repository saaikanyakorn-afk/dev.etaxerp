interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParsedBankTransaction {
  statementDate: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
  balance: string;
  reference: string;
}

export interface ParsedBankStatement {
  bankName: string;
  accountNumber: string;
  transactions: ParsedBankTransaction[];
  rawText: string;
}

async function extractTextItems(pdfBuffer: Buffer): Promise<{ items: TextItem[][]; rawText: string }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdfDoc = await loadingTask.promise;

  const allPages: TextItem[][] = [];
  const rawParts: string[] = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;

    const pageItems: TextItem[] = [];
    for (const item of textContent.items as any[]) {
      if (!item.str || item.str.trim() === "") continue;
      const tx = item.transform;
      pageItems.push({
        str: item.str.trim(),
        x: Math.round(tx[4]),
        y: Math.round(pageHeight - tx[5]),
        width: Math.round(item.width),
        height: Math.round(item.height || tx[3] || 10),
      });
    }
    allPages.push(pageItems);
    rawParts.push(pageItems.map(it => it.str).join(" "));
  }

  return { items: allPages, rawText: rawParts.join("\n\n") };
}

function groupIntoRows(items: TextItem[], tolerance = 4): TextItem[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) <= tolerance) {
      currentRow.push(sorted[i]);
    } else {
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = [sorted[i]];
      currentY = sorted[i].y;
    }
  }
  currentRow.sort((a, b) => a.x - b.x);
  rows.push(currentRow);
  return rows;
}

function rowText(row: TextItem[]): string {
  return row.map(it => it.str).join(" ");
}

function cleanNumber(str: string): number {
  const cleaned = str.replace(/[,\s฿]/g, "").replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDate(dateStr: string): string {
  const cleaned = dateStr.replace(/\s+/g, " ").trim();

  const dmy = cleaned.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let day = parseInt(d);
    let month = parseInt(m);
    let year = parseInt(y);
    if (year > 2400) year -= 543;
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    if (month > 12 || day > 31) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    let year = parseInt(iso[1]);
    if (year > 2400) year -= 543;
    return `${year}-${iso[2]}-${iso[3]}`;
  }

  const thaiMonths: Record<string, string> = {
    "มกราคม": "01", "ม.ค.": "01", "ม.ค": "01", "มค": "01",
    "กุมภาพันธ์": "02", "ก.พ.": "02", "ก.พ": "02", "กพ": "02",
    "มีนาคม": "03", "มี.ค.": "03", "มี.ค": "03", "มีค": "03",
    "เมษายน": "04", "เม.ย.": "04", "เม.ย": "04", "เมย": "04",
    "พฤษภาคม": "05", "พ.ค.": "05", "พ.ค": "05", "พค": "05",
    "มิถุนายน": "06", "มิ.ย.": "06", "มิ.ย": "06", "มิย": "06",
    "กรกฎาคม": "07", "ก.ค.": "07", "ก.ค": "07", "กค": "07",
    "สิงหาคม": "08", "ส.ค.": "08", "ส.ค": "08", "สค": "08",
    "กันยายน": "09", "ก.ย.": "09", "ก.ย": "09", "กย": "09",
    "ตุลาคม": "10", "ต.ค.": "10", "ต.ค": "10", "ตค": "10",
    "พฤศจิกายน": "11", "พ.ย.": "11", "พ.ย": "11", "พย": "11",
    "ธันวาคม": "12", "ธ.ค.": "12", "ธ.ค": "12", "ธค": "12",
  };
  for (const [name, num] of Object.entries(thaiMonths)) {
    const re = new RegExp(`(\\d{1,2})\\s*${name.replace(".", "\\.")}\\s*(\\d{2,4})`);
    const m = cleaned.match(re);
    if (m) {
      let year = parseInt(m[2]);
      if (year > 2400) year -= 543;
      if (year < 100) year += 2000;
      return `${year}-${num}-${m[1].padStart(2, "0")}`;
    }
  }

  const engMonths: Record<string, string> = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
  };
  for (const [name, num] of Object.entries(engMonths)) {
    const re = new RegExp(`(\\d{1,2})\\s*${name}\\w*\\s*(\\d{2,4})`, "i");
    const m = cleaned.match(re);
    if (m) {
      let year = parseInt(m[2]);
      if (year < 100) year += 2000;
      return `${year}-${num}-${m[1].padStart(2, "0")}`;
    }
  }

  return "";
}

function detectBank(fullText: string): string {
  const lower = fullText.toLowerCase();
  if (/kbank|kasikorn|กสิกร/i.test(fullText)) return "ธนาคารกสิกรไทย";
  if (/scb|siam\s*commercial|ไทยพาณิชย์/i.test(fullText)) return "ธนาคารไทยพาณิชย์";
  if (/krungthai|กรุงไทย|ktb/i.test(fullText)) return "ธนาคารกรุงไทย";
  if (/bangkok\s*bank|กรุงเทพ|bbl/i.test(fullText)) return "ธนาคารกรุงเทพ";
  if (/krungsri|กรุงศรี|bay/i.test(fullText)) return "ธนาคารกรุงศรีอยุธยา";
  if (/tmb|ttb|ทหารไทย|ธนชาต|thanachart/i.test(fullText)) return "ธนาคารทหารไทยธนชาต";
  if (/uob|ยูโอบี/i.test(fullText)) return "ธนาคารยูโอบี";
  if (/cimb|ซีไอเอ็ม/i.test(fullText)) return "ธนาคารซีไอเอ็มบี";
  if (/lh\s*bank|แลนด์|land\s*&\s*houses/i.test(fullText)) return "ธนาคารแลนด์ แอนด์ เฮ้าส์";
  if (/gsb|ออมสิน/i.test(fullText)) return "ธนาคารออมสิน";
  if (/baac|ธกส|เพื่อการเกษตร/i.test(fullText)) return "ธ.ก.ส.";
  return "";
}

function detectAccountNumber(fullText: string): string {
  const patterns = [
    /(?:เลขที่บัญชี|account\s*(?:no\.?|number)|a\/c\s*(?:no\.?|number)|สมุดบัญชี\s*เลขที่)[\s:：]*(\d[\d\-\s]{5,20}\d)/i,
    /(?:saving|current|deposit)\s*(?:account)?\s*[:：]?\s*(\d[\d\-\s]{5,20}\d)/i,
  ];
  for (const p of patterns) {
    const m = fullText.match(p);
    if (m) return m[1].replace(/\s/g, "");
  }
  const acctMatch = fullText.match(/(\d{3}[\-\s]\d{1,2}[\-\s]\d{5,7}[\-\s]?\d?)/);
  if (acctMatch) return acctMatch[1].replace(/\s/g, "");
  return "";
}

function isHeaderRow(text: string): boolean {
  const headerKeywords = /(?:วันที่|date|รายการ|description|ถอน|ฝาก|withdraw|deposit|debit|credit|ยอดคงเหลือ|balance|จำนวนเงิน|amount|รายละเอียด|transaction)/i;
  const headerCount = (text.match(headerKeywords) || []).length;
  return headerCount >= 2;
}

function isFooterRow(text: string): boolean {
  return /(?:ยอดยกไป|ยอดรวม|total|สรุปยอด|ยอดยกมา|brought?\s*forward|carried?\s*forward|page\s*total|balance\s*b\/f|balance\s*c\/f|ปิดยอด|opening\s*balance|closing\s*balance)/i.test(text);
}

function isDateLike(str: string): boolean {
  return /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(str.trim()) ||
    /^\d{1,2}\s*(ม\.?ค|ก\.?พ|มี\.?ค|เม\.?ย|พ\.?ค|มิ\.?ย|ก\.?ค|ส\.?ค|ก\.?ย|ต\.?ค|พ\.?ย|ธ\.?ค|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(str.trim());
}

function extractNumbers(row: TextItem[]): number[] {
  const nums: number[] = [];
  for (const item of row) {
    const cleaned = item.str.replace(/[,\s]/g, "");
    if (/^-?[\d,]+\.?\d*$/.test(cleaned) && cleaned.length > 0) {
      nums.push(cleanNumber(item.str));
    }
  }
  return nums;
}

function analyzeColumnPositions(rows: TextItem[][], headerRowIdx: number): { dateCol: number; descRange: [number, number]; numCols: number[] } {
  const headerRow = rows[headerRowIdx];
  const text = rowText(headerRow);

  let dateCol = 0;
  const numCols: number[] = [];
  let descStart = 0;
  let descEnd = 999;

  for (let i = 0; i < headerRow.length; i++) {
    const s = headerRow[i].str.toLowerCase();
    if (/วันที่|date/.test(s)) {
      dateCol = headerRow[i].x;
    }
    if (/ถอน|withdraw|debit/.test(s)) {
      numCols.push(headerRow[i].x);
    }
    if (/ฝาก|deposit|credit/.test(s)) {
      numCols.push(headerRow[i].x);
    }
    if (/ยอดคงเหลือ|balance|คงเหลือ/.test(s)) {
      numCols.push(headerRow[i].x);
    }
    if (/รายการ|description|รายละเอียด|transaction/.test(s)) {
      descStart = headerRow[i].x;
    }
  }

  numCols.sort((a, b) => a - b);

  if (numCols.length > 0) {
    descEnd = Math.min(...numCols) - 10;
  }

  return { dateCol, descRange: [descStart, descEnd], numCols };
}

export async function parseBankStatementPdf(pdfBuffer: Buffer): Promise<ParsedBankStatement> {
  const { items: pages, rawText } = await extractTextItems(pdfBuffer);
  const bankName = detectBank(rawText);
  const accountNumber = detectAccountNumber(rawText);

  const transactions: ParsedBankTransaction[] = [];

  for (const pageItems of pages) {
    const rows = groupIntoRows(pageItems);

    let headerRowIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const text = rowText(rows[i]);
      if (isHeaderRow(text)) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) continue;

    let lastDate = "";

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const text = rowText(row);

      if (isFooterRow(text)) continue;
      if (text.trim().length < 3) continue;
      if (isHeaderRow(text)) continue;

      let datePart = "";
      const descParts: string[] = [];
      const numbers: number[] = [];

      for (const item of row) {
        const s = item.str.trim();
        if (!s) continue;

        if (!datePart && isDateLike(s)) {
          datePart = s;
          continue;
        }

        const cleaned = s.replace(/[,\s]/g, "");
        if (/^-?[\d]+\.?\d{0,2}$/.test(cleaned) && cleaned.length >= 2 && parseFloat(cleaned) !== 0) {
          numbers.push(cleanNumber(s));
        } else if (!/^\d{1,2}$/.test(s)) {
          descParts.push(s);
        }
      }

      if (!datePart && numbers.length === 0 && descParts.length > 0) {
        if (transactions.length > 0) {
          const last = transactions[transactions.length - 1];
          last.description += " " + descParts.join(" ");
          last.description = last.description.trim();
        }
        continue;
      }

      if (datePart) {
        lastDate = parseDate(datePart) || datePart;
      }

      if (!lastDate && numbers.length === 0) continue;

      const description = descParts.join(" ").trim();

      let debit = 0;
      let credit = 0;
      let balance = 0;

      if (numbers.length >= 3) {
        debit = numbers[0];
        credit = numbers[1];
        balance = numbers[2];
      } else if (numbers.length === 2) {
        balance = numbers[numbers.length - 1];
        const amt = numbers[0];
        if (transactions.length > 0) {
          const prevBal = parseFloat(transactions[transactions.length - 1].balance) || 0;
          if (Math.abs(prevBal + amt - balance) < 0.01) {
            credit = amt;
          } else if (Math.abs(prevBal - amt - balance) < 0.01) {
            debit = amt;
          } else {
            if (amt > balance) {
              debit = amt;
            } else {
              credit = amt;
            }
          }
        } else {
          credit = amt;
        }
      } else if (numbers.length === 1) {
        balance = numbers[0];
        continue;
      } else {
        continue;
      }

      if (!lastDate) continue;

      transactions.push({
        statementDate: lastDate,
        description: description || "-",
        debitAmount: String(Math.round(debit * 100) / 100),
        creditAmount: String(Math.round(credit * 100) / 100),
        balance: String(Math.round(balance * 100) / 100),
        reference: "",
      });
    }
  }

  return {
    bankName,
    accountNumber,
    transactions,
    rawText: rawText.substring(0, 5000),
  };
}
