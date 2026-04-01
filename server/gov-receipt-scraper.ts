import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

function findChromiumPath(): string {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
  ];
  try {
    const nixPath = execSync("ls /nix/store/*-chromium-*/bin/chromium 2>/dev/null | head -1", { encoding: "utf8" }).trim();
    if (nixPath) candidates.unshift(nixPath);
  } catch {}
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const which = execSync("which chromium || which chromium-browser || which google-chrome 2>/dev/null", { encoding: "utf8" }).trim();
    if (which) return which.split("\n")[0];
  } catch {}
  return candidates[0];
}

const CHROMIUM_PATH = findChromiumPath();

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    protocolTimeout: 120000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });
}

export interface ReceiptFile {
  name: string;
  url: string;
  formCode: string;
  taxMonthYear: string;
  refNo: string;
  docType: string;
  data?: string;
}

export interface ScrapeResult {
  success: boolean;
  message: string;
  files?: ReceiptFile[];
}

export async function scrapeRdReceipts(
  taxId: string,
  password: string,
  monthFrom: number,
  monthTo: number,
  year: number
): Promise<ScrapeResult> {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    console.log(`[RD Scraper] Login for taxId: ${taxId.substring(0, 4)}****`);
    await page.goto("https://efiling.rd.go.th/rd-efiling-web/login", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await page.waitForSelector("#username", { timeout: 10000 });
    await page.type("#username", taxId, { delay: 30 });
    await page.type("#passwordField", password, { delay: 30 });
    await page.click("button.btn-login");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    if (page.url().includes("login")) {
      const errorMsg = await page.evaluate(() => {
        const el = document.querySelector(".alert-danger, .text-danger, .error-message, .invalid-feedback");
        return el ? (el as HTMLElement).innerText.trim() : "";
      });
      await browser.close();
      return {
        success: false,
        message: errorMsg ? `ล็อกอินไม่สำเร็จ: ${errorMsg}` : "ล็อกอินไม่สำเร็จ — กรุณาตรวจสอบเลขผู้เสียภาษีและรหัสผ่าน",
      };
    }

    console.log("[RD Scraper] Login OK, navigating to form-status page...");

    const apiResponses: any[] = [];
    let capturedEndpoint = "";
    let capturedPostBody = "";

    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("taxform") && url.includes("search")) {
        try {
          const req = response.request();
          const method = req.method();
          const postData = req.postData() || "";
          console.log(`[RD Scraper] Intercepted ${method} ${url.substring(0, 120)} postBody=${postData.substring(0, 200)}`);
          capturedEndpoint = url.split("?")[0];
          capturedPostBody = postData;
          const text = await response.text();
          if (text && text.trim().length > 0) {
            const json = JSON.parse(text);
            if (json?.data) {
              apiResponses.push(json);
              console.log(`[RD Scraper] Captured ${json.data.length} records from API`);
            } else {
              console.log(`[RD Scraper] API response (no data field): ${JSON.stringify(json).substring(0, 200)}`);
            }
          }
        } catch (e: any) {
          console.log(`[RD Scraper] Response parse error: ${e.message}`);
        }
      }
    });

    await page.goto("https://efiling.rd.go.th/rd-efiling-web/form-status", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise(r => setTimeout(r, 5000));

    const pageContent = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || "");
    console.log(`[RD Scraper] form-status page content: ${pageContent.substring(0, 300)}`);

    const yearBE = year + 543;
    const targetMonths: string[] = [];
    const thaiMonthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    for (let m = monthFrom; m <= monthTo; m++) {
      targetMonths.push(`${thaiMonthsShort[m]}${yearBE}`);
    }
    console.log(`[RD Scraper] Target months: ${targetMonths.join(", ")}`);

    let searchRes: any = null;
    const allRecords: any[] = [];
    const seenIds = new Set<number>();

    const addRecords = (records: any[]) => {
      for (const r of records) {
        if (r.taxFormId && !seenIds.has(r.taxFormId)) {
          seenIds.add(r.taxFormId);
          allRecords.push(r);
        }
      }
    };

    for (const resp of apiResponses) {
      if (resp?.data) addRecords(resp.data);
    }
    console.log(`[RD Scraper] Records from initial page load: ${allRecords.length}`);

    console.log(`[RD Scraper] Using UI pagination (clicking page buttons like RPA)`);
    
    const paginationInfo = await page.evaluate(() => {
      const allText = document.body?.innerText || "";
      const totalMatch = allText.match(/ทั้งหมด\s*(\d+)\s*รายการ/);
      const totalRecords = totalMatch ? parseInt(totalMatch[1]) : 0;
      
      const paginationArea = document.querySelector(".pagination, nav, .paginator, mat-paginator, .mat-paginator, .paging, [class*='pagina']");
      const paginationHtml = paginationArea ? paginationArea.outerHTML.substring(0, 500) : "NOT FOUND";
      
      const allBtns = Array.from(document.querySelectorAll("button, a, li"));
      const pageBtns: string[] = [];
      for (const btn of allBtns) {
        const text = btn.textContent?.trim() || "";
        const tag = btn.tagName;
        const cls = btn.className?.toString().substring(0, 60) || "";
        const aria = btn.getAttribute("aria-label") || "";
        if (text === ">" || text === "›" || text === "»" || text === "2" || 
            aria.toLowerCase().includes("next") || aria.toLowerCase().includes("page") ||
            cls.includes("page") || cls.includes("next") || cls.includes("pagination")) {
          pageBtns.push(`<${tag} class="${cls}" aria-label="${aria}">${text.substring(0, 20)}</${tag}>`);
        }
      }
      
      const selectDropdowns = Array.from(document.querySelectorAll("select, mat-select, .mat-select"));
      const dropdownInfo = selectDropdowns.map(s => {
        return `<${s.tagName} class="${(s.className?.toString() || '').substring(0, 60)}">${(s.textContent || '').substring(0, 30)}</${s.tagName}>`;
      });
      
      return { totalRecords, paginationHtml, pageBtns, dropdownInfo };
    });
    
    console.log(`[RD Scraper] Page total: ${paginationInfo.totalRecords} records`);
    console.log(`[RD Scraper] Pagination HTML: ${paginationInfo.paginationHtml}`);
    console.log(`[RD Scraper] Page buttons found: ${JSON.stringify(paginationInfo.pageBtns)}`);
    console.log(`[RD Scraper] Dropdowns: ${JSON.stringify(paginationInfo.dropdownInfo)}`);
    
    const totalPages = Math.ceil(paginationInfo.totalRecords / 10);
    console.log(`[RD Scraper] Total pages: ${totalPages} (${paginationInfo.totalRecords} records, 10/page)`);
    
    if (totalPages > 1) {
      for (let targetPage = 2; targetPage <= totalPages; targetPage++) {
        const beforeApiCount = apiResponses.length;
        const prevCount = allRecords.length;
        
        const clicked = await page.evaluate((pageNum: number) => {
          const pageItems = document.querySelectorAll("li.ant-pagination-item");
          for (const item of Array.from(pageItems)) {
            const text = item.textContent?.trim();
            if (text === String(pageNum)) {
              const link = item.querySelector("a") || item;
              (link as HTMLElement).click();
              return `clicked-page-${pageNum}`;
            }
          }
          
          const active = document.querySelector("li.ant-pagination-item-active");
          if (active) {
            const nextSibling = active.nextElementSibling;
            if (nextSibling && nextSibling.classList.contains("ant-pagination-item")) {
              const link = nextSibling.querySelector("a") || nextSibling;
              (link as HTMLElement).click();
              return `clicked-next-sibling`;
            }
          }
          
          const nextBtn = document.querySelector("li.ant-pagination-next:not(.ant-pagination-disabled)");
          if (nextBtn) {
            const link = nextBtn.querySelector("a") || nextBtn;
            (link as HTMLElement).click();
            return `clicked-ant-next`;
          }
          
          return "no-page-found";
        }, targetPage);
        
        if (clicked === "no-page-found") {
          console.log(`[RD Scraper] Page ${targetPage} not found — done`);
          break;
        }
        
        await new Promise(r => setTimeout(r, 3000));
        
        for (const resp of apiResponses.slice(beforeApiCount)) {
          if (resp?.data) addRecords(resp.data);
        }
        
        const newCount = allRecords.length - prevCount;
        console.log(`[RD Scraper] Page ${targetPage}: ${clicked}, ${newCount} new (total: ${allRecords.length})`);
      }
    } else {
      console.log(`[RD Scraper] Only 1 page, no pagination needed`);
    }
    
    console.log(`[RD Scraper] Total after UI pagination: ${allRecords.length} records`);
    
    const monthsFound = [...new Set(allRecords.map((f: any) => f.taxMonthYear || "N/A"))];
    console.log(`[RD Scraper] Months in data: ${monthsFound.join(", ")}`);

    console.log(`[RD Scraper] Total records fetched: ${allRecords.length}`);

    if (allRecords.length > 0) {
      searchRes = { data: allRecords };
    }

    if (!searchRes || searchRes?.error) {
      console.log(`[RD Scraper] All methods failed`);
      await browser.close();
      return { success: false, message: `ดึงรายการจากสรรพากรไม่สำเร็จ: ${searchRes?.error || "ไม่พบข้อมูล — เว็บสรรพากรอาจมีการเปลี่ยนแปลง"}` };
    }

    if (!searchRes?.data || searchRes.data.length === 0) {
      await browser.close();
      return { success: true, message: "ไม่พบรายการแบบที่ยื่น", files: [] };
    }

    console.log(`[RD Scraper] Found ${searchRes.data.length} total forms`);

    const matchingForms = searchRes.data.filter((f: any) => {
      if (!f.taxMonthYear) return false;
      const normalized = f.taxMonthYear.replace(/\s/g, "");
      return targetMonths.some(tm => normalized === tm);
    });

    console.log(`[RD Scraper] ${matchingForms.length} forms match target months`);
    if (matchingForms.length > 0) {
      const sample = matchingForms[0];
      console.log(`[RD Scraper] Sample record keys: ${Object.keys(sample).join(", ")}`);
      console.log(`[RD Scraper] Sample record: ${JSON.stringify(sample).substring(0, 500)}`);
      const statuses = matchingForms.map((f: any) => f.statusNameTh || f.taxFormStatus || "?");
      console.log(`[RD Scraper] Statuses: ${statuses.join(" | ")}`);
    }

    if (matchingForms.length === 0) {
      const allMonths = [...new Set(searchRes.data.map((f: any) => f.taxMonthYear))];
      await browser.close();
      return {
        success: true,
        message: `ไม่พบแบบสำหรับเดือนที่เลือก (มีเดือน: ${allMonths.join(", ")})`,
        files: [],
      };
    }

    const allFiles: ReceiptFile[] = [];

    const tmpDir = path.join(os.tmpdir(), "gov-receipts", taxId);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const pendingReceipt: string[] = [];
    const readyForms: any[] = [];

    const cancelledForms: string[] = [];
    for (const form of matchingForms) {
      const status = (form.statusNameTh || form.taxFormStatus || "").toString();
      const refNo = form.refNo || form.paymentRefNo || "";
      const formCode = form.formCodeTh || form.formCode || "";
      console.log(`[RD Scraper] Form: ${formCode} ref=${refNo} status="${status}" group=${form.formGroupCode}`);

      if (status.includes("ยกเลิก")) {
        cancelledForms.push(`${formCode} (${refNo})`);
      } else if (status.includes("รอออกใบเสร็จ")) {
        pendingReceipt.push(`${formCode} (${refNo})`);
      } else {
        readyForms.push(form);
      }
    }
    if (cancelledForms.length > 0) {
      console.log(`[RD Scraper] ${cancelledForms.length} cancelled forms skipped`);
    }

    if (pendingReceipt.length > 0) {
      console.log(`[RD Scraper] ${pendingReceipt.length} forms pending receipt: ${pendingReceipt.join(", ")}`);
    }

    if (readyForms.length > 0) {
      console.log(`[RD Scraper] ${readyForms.length} forms ready — downloading via UI clicks (like RPA)`);

      const cdp = await page.createCDPSession();
      await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: tmpDir });

      const downloadedResponses: { url: string; buffer: Buffer; refNo: string }[] = [];
      
      page.on("response", async (resp) => {
        const url = resp.url();
        const ct = resp.headers()["content-type"] || "";
        if (ct.includes("pdf") || ct.includes("octet-stream") || url.includes("download") || url.includes("print") || url.includes("pdf")) {
          console.log(`[RD Scraper] [NET] ${resp.status()} ${ct} ${url.substring(0, 120)}`);
          if (resp.status() === 200 && (ct.includes("pdf") || ct.includes("octet-stream"))) {
            try {
              const buf = await resp.buffer();
              if (buf.length > 1000) {
                downloadedResponses.push({ url, buffer: buf, refNo: "" });
                console.log(`[RD Scraper] Captured PDF response: ${buf.length} bytes`);
              }
            } catch (e: any) {
              console.log(`[RD Scraper] Could not capture response buffer: ${e.message}`);
            }
          }
        }
      });

      const readyRefNos = new Set(readyForms.map((f: any) => f.refNo));
      
      await page.evaluate(() => {
        const page1 = document.querySelector("li.ant-pagination-item[title='1']");
        if (page1) {
          const link = page1.querySelector("a") || page1;
          (link as HTMLElement).click();
        }
      });
      await new Promise(r => setTimeout(r, 3000));
      
      let downloadedCount = 0;
      
      for (let p = 1; p <= totalPages && downloadedCount < readyForms.length; p++) {
        if (p > 1) {
          await page.evaluate((pageNum: number) => {
            const items = document.querySelectorAll("li.ant-pagination-item");
            for (const item of Array.from(items)) {
              if (item.textContent?.trim() === String(pageNum)) {
                const link = item.querySelector("a") || item;
                (link as HTMLElement).click();
                return;
              }
            }
            const nextBtn = document.querySelector("li.ant-pagination-next:not(.ant-pagination-disabled)");
            if (nextBtn) {
              const link = nextBtn.querySelector("a") || nextBtn;
              (link as HTMLElement).click();
            }
          }, p);
          await new Promise(r => setTimeout(r, 3000));
        }
        
        const rowsOnPage = await page.evaluate((refNosArr: string[]) => {
          const rows = document.querySelectorAll("tr, nz-tr, [class*='ant-table-row']");
          const matches: { refNo: string; rowIndex: number }[] = [];
          let idx = 0;
          for (const row of Array.from(rows)) {
            const text = row.textContent || "";
            for (const refNo of refNosArr) {
              if (text.includes(refNo) && text.includes("ออกใบเสร็จ")) {
                matches.push({ refNo, rowIndex: idx });
              }
            }
            idx++;
          }
          return matches;
        }, [...readyRefNos]);
        
        if (rowsOnPage.length === 0) continue;
        console.log(`[RD Scraper] Page ${p}: found ${rowsOnPage.length} downloadable rows`);
        
        for (const { refNo, rowIndex } of rowsOnPage) {
          const form = readyForms.find((f: any) => f.refNo === refNo);
          if (!form) continue;
          const formCode = form.formCodeTh || form.formCode || "";
          console.log(`[RD Scraper] Clicking download for ${formCode} ref=${refNo}...`);
          
          const beforeDl = downloadedResponses.length;
          
          const dotBtnClicked = await page.evaluate((targetRefNo: string) => {
            const allRows = document.querySelectorAll("tr");
            for (const row of Array.from(allRows)) {
              if (!(row.textContent || "").includes(targetRefNo)) continue;
              const btn = row.querySelector("button.od-FieldRenderer-dot") as HTMLElement;
              if (btn) {
                btn.click();
                return "clicked";
              }
            }
            return "not-found";
          }, refNo);
          
          if (dotBtnClicked !== "clicked") {
            console.log(`[RD Scraper] No dot button found for ${refNo}`);
            continue;
          }
          
          console.log(`[RD Scraper] Clicked ⋮ button for ${refNo}`);
          await new Promise(r => setTimeout(r, 1500));
          
          const menuClicked = await page.evaluate(() => {
            const allDropdownItems = document.querySelectorAll(".dropdown-menu a, .dropdown-item, [class*='dropdown'] a, bs-dropdown-container a, .dropdown-menu li a");
            const texts: string[] = [];
            let clicked = false;
            for (const item of Array.from(allDropdownItems)) {
              const text = (item.textContent || "").trim();
              if (text.length > 0 && text.length < 60) texts.push(text);
              if (text.includes("พิมพ์ภาพแบบ") || text.includes("ภาพใบเสร็จ") || text.includes("พิมพ์") || text.includes("ใบเสร็จ")) {
                (item as HTMLElement).click();
                clicked = true;
              }
            }
            if (!clicked) {
              const allLinks = document.querySelectorAll("a, button, li");
              for (const el of Array.from(allLinks)) {
                const text = (el.textContent || "").trim();
                const style = window.getComputedStyle(el);
                if (style.display !== "none" && style.visibility !== "hidden" && 
                    (text.includes("พิมพ์ภาพแบบ") || text === "พิมพ์ภาพแบบ/ภาพใบเสร็จ")) {
                  (el as HTMLElement).click();
                  clicked = true;
                  texts.push(`fallback-clicked: ${text}`);
                  break;
                }
              }
            }
            return { texts, clicked };
          });
          console.log(`[RD Scraper] Dropdown: ${JSON.stringify(menuClicked)}`);
          
          await new Promise(r => setTimeout(r, 2000));
          
          const modalContent = await page.evaluate(() => {
            const modals = document.querySelectorAll(".modal, .modal-dialog, .modal-content, [class*='modal']");
            const texts: string[] = [];
            for (const modal of Array.from(modals)) {
              const style = window.getComputedStyle(modal);
              if (style.display === "none") continue;
              texts.push((modal.textContent || "").trim().substring(0, 200));
            }
            return texts;
          });
          console.log(`[RD Scraper] Modal content: ${JSON.stringify(modalContent)}`);
          
          const receiptDlClicked = await page.evaluate(() => {
            const buttons = document.querySelectorAll(".modal button, .modal a, .modal-content button, .modal-body button, .modal-body a");
            const btnTexts: string[] = [];
            for (const btn of Array.from(buttons)) {
              const text = (btn.textContent || "").trim();
              if (text.length > 0 && text.length < 50) btnTexts.push(text);
            }
            
            let clickedReceipt = false;
            const rows = document.querySelectorAll(".modal tr, .modal-body tr, .modal-content tr");
            for (const row of Array.from(rows)) {
              const rowText = (row.textContent || "").trim();
              if (rowText.includes("ใบเสร็จ") || rowText.includes("ใบรับ")) {
                const dlBtn = row.querySelector("button");
                if (dlBtn) {
                  (dlBtn as HTMLElement).click();
                  clickedReceipt = true;
                  break;
                }
                const dlLink = row.querySelector("a");
                if (dlLink) {
                  (dlLink as HTMLElement).click();
                  clickedReceipt = true;
                  break;
                }
              }
            }
            
            if (!clickedReceipt) {
              const allDlBtns = document.querySelectorAll(".modal button, .modal-content button");
              for (const btn of Array.from(allDlBtns)) {
                const text = (btn.textContent || "").trim();
                if (text === "ดาวน์โหลด") {
                  const parent = btn.closest("tr, div");
                  const parentText = (parent?.textContent || "").trim();
                  if (parentText.includes("ใบเสร็จ") || parentText.includes("ใบรับ")) {
                    (btn as HTMLElement).click();
                    clickedReceipt = true;
                    break;
                  }
                }
              }
            }
            
            if (!clickedReceipt) {
              const lastResortBtns = document.querySelectorAll(".modal button");
              const dlBtns = Array.from(lastResortBtns).filter(b => (b.textContent || "").trim() === "ดาวน์โหลด");
              if (dlBtns.length >= 2) {
                (dlBtns[1] as HTMLElement).click();
                clickedReceipt = true;
              } else if (dlBtns.length === 1) {
                (dlBtns[0] as HTMLElement).click();
                clickedReceipt = true;
              }
            }
            
            return { btnTexts, clickedReceipt };
          });
          console.log(`[RD Scraper] Receipt download: ${JSON.stringify(receiptDlClicked)}`);
          
          await new Promise(r => setTimeout(r, 5000));
          
          const closeModal = await page.evaluate(() => {
            const closeBtn = document.querySelector(".modal button.close, .modal [aria-label='Close'], .modal button[data-dismiss='modal']");
            if (closeBtn) { (closeBtn as HTMLElement).click(); return "closed"; }
            const btns = document.querySelectorAll(".modal button, .modal-footer button");
            for (const btn of Array.from(btns)) {
              const text = (btn.textContent || "").trim();
              if (text === "ปิด" || text === "Close" || text === "OK") {
                (btn as HTMLElement).click();
                return `closed: ${text}`;
              }
            }
            return "no-close-btn";
          });
          console.log(`[RD Scraper] Close modal: ${closeModal}`);
          await new Promise(r => setTimeout(r, 1000));
          
          if (downloadedResponses.length > beforeDl) {
            const dlResp = downloadedResponses[downloadedResponses.length - 1];
            const fileName = `${formCode}_${refNo}_receipt.pdf`;
            const filePath = path.join(tmpDir, fileName);
            fs.writeFileSync(filePath, dlResp.buffer);
            allFiles.push({
              name: fileName, url: "", formCode,
              taxMonthYear: form.taxMonthYear || "", refNo,
              docType: "TAX_RECEIPT",
            });
            downloadedCount++;
            console.log(`[RD Scraper] Saved: ${fileName} (${dlResp.buffer.length} bytes)`);
          } else {
            const newFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith(".pdf"));
            if (newFiles.length > 0) {
              const newest = newFiles.sort().pop()!;
              const fileName = `${formCode}_${refNo}_receipt.pdf`;
              try {
                fs.renameSync(path.join(tmpDir, newest), path.join(tmpDir, fileName));
                allFiles.push({
                  name: fileName, url: "", formCode,
                  taxMonthYear: form.taxMonthYear || "", refNo,
                  docType: "TAX_RECEIPT",
                });
                downloadedCount++;
                console.log(`[RD Scraper] Renamed downloaded file: ${fileName}`);
              } catch {}
            } else {
              console.log(`[RD Scraper] No PDF captured for ${formCode} ${refNo}`);
            }
          }
          
          await page.evaluate(() => {
            document.body.click();
          });
          await new Promise(r => setTimeout(r, 500));
          
          readyRefNos.delete(refNo);
        }
      }
      
      console.log(`[RD Scraper] UI download complete: ${downloadedCount}/${readyForms.length} files`);
    }

    const pendingMsg = pendingReceipt.length > 0
      ? ` (${pendingReceipt.length} แบบยังรอออกใบเสร็จจากสรรพากร)`
      : "";
    console.log(`[RD Scraper] Found ${allFiles.length} downloadable files${pendingMsg}`);

    const receiptFiles = allFiles.filter(f => f.docType === "TAX_RECEIPT" || f.docType === "RECEIPT" || f.name.includes("RECEIPT"));
    const formFiles = allFiles.filter(f => f.docType === "TAX_FORM" || f.name.includes("TAX_FORM"));

    const downloadedFiles: ReceiptFile[] = [];
    for (const file of allFiles) {
      if (!file.url) continue;
      try {
        const pdfResp = await page.evaluate(async (url: string) => {
          const resp = await fetch(url, { credentials: "include" });
          if (!resp.ok) return null;
          const blob = await resp.blob();
          const reader = new FileReader();
          return new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }, file.url);

        if (pdfResp) {
          const base64Data = pdfResp.split(",")[1] || pdfResp;
          const filePath = path.join(tmpDir, file.name);
          fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
          downloadedFiles.push({ ...file, data: filePath });
          console.log(`[RD Scraper] Downloaded: ${file.name} (${file.docType})`);
        }
      } catch (err: any) {
        console.log(`[RD Scraper] Failed to download ${file.name}:`, err.message);
      }
    }

    await browser.close();

    const receiptCount = downloadedFiles.filter(f => f.docType === "TAX_RECEIPT" || f.docType === "RECEIPT" || f.name.includes("RECEIPT")).length;
    const formCount = downloadedFiles.filter(f => f.docType === "TAX_FORM" || f.name.includes("TAX_FORM")).length;

    const cancelledMsg = cancelledForms.length > 0 ? `, ${cancelledForms.length} ยกเลิก` : "";
    return {
      success: true,
      message: `ดาวน์โหลดสำเร็จ ${downloadedFiles.length} ไฟล์ (ใบเสร็จ ${receiptCount}, แบบ ${formCount}) จาก ${matchingForms.length} รายการ เดือนภาษี ${targetMonths.join(", ")}${pendingMsg}${cancelledMsg}`,
      files: downloadedFiles,
    };
  } catch (err: any) {
    if (browser) await browser.close().catch(() => {});
    return { success: false, message: `เกิดข้อผิดพลาด: ${err.message}` };
  }
}

export async function scrapeSsoReceipts(
  ssoUsername: string,
  ssoPassword: string,
  monthFrom: number,
  monthTo: number,
  year: number
): Promise<ScrapeResult> {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    console.log(`[SSO Scraper] Login for user: ${ssoUsername.substring(0, 4)}****`);

    await page.goto("https://www.sso.go.th/eservices/esv/login.do", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await page.waitForSelector("#tx_userName", { timeout: 10000 });
    await page.waitForSelector("#tx_password", { timeout: 5000 });

    await page.type("#tx_userName", ssoUsername, { delay: 30 });
    await page.type("#tx_password", ssoPassword, { delay: 30 });

    console.log("[SSO Scraper] Clicking login...");

    const beforeUrl = page.url();
    await page.evaluate(() => {
      const btn = document.querySelector('input.btn.btn-primary[type="button"]') as HTMLInputElement;
      if (btn) btn.click();
      else if (typeof (window as any).doCmd === 'function') (window as any).doCmd();
    });

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));

    const afterLoginUrl = page.url();
    console.log("[SSO Scraper] After login URL:", afterLoginUrl);

    const isLoggedIn = await page.evaluate(() => {
      const bodyText = document.body?.innerText || "";
      return bodyText.includes("ออกจากระบบ") || bodyText.includes("Logout") || bodyText.includes("ยินดีต้อนรับ");
    });

    if (!isLoggedIn) {
      const errorMsg = await page.evaluate(() => {
        const el = document.querySelector(".error, .alert-danger, .text-danger, .alert, [style*='color:red'], [style*='color: red'], .errorMessage, #errorMessage");
        return el ? (el as HTMLElement).innerText.trim() : "";
      });
      console.log("[SSO Scraper] Login failed, error:", errorMsg);
      await browser.close();
      return {
        success: false,
        message: errorMsg
          ? `ล็อกอินไม่สำเร็จ: ${errorMsg}`
          : "ล็อกอินประกันสังคมไม่สำเร็จ — กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน",
      };
    }

    console.log("[SSO Scraper] Login OK! Navigating to e-Receipt system...");

    await page.goto("https://www.sso.go.th/erc/erc/login.do", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise(r => setTimeout(r, 2000));

    const ercUrl = page.url();
    console.log("[SSO Scraper] e-Receipt URL:", ercUrl);

    if (ercUrl.includes("login.do")) {
      const hasErcLoginForm = await page.evaluate(() => {
        return !!(document.querySelector("input[name='username'], input[name='userName'], #username, #tx_userName"));
      });

      if (hasErcLoginForm) {
        console.log("[SSO Scraper] e-Receipt needs separate login, using same credentials...");
        const usernameField = await page.$("input[name='username'], input[name='userName'], #username, #tx_userName");
        const passwordField = await page.$("input[name='password'], input[name='userPassword'], #password, #tx_password");

        if (usernameField && passwordField) {
          await usernameField.click({ clickCount: 3 });
          await usernameField.type(ssoUsername, { delay: 30 });
          await passwordField.click({ clickCount: 3 });
          await passwordField.type(ssoPassword, { delay: 30 });

          await page.evaluate(() => {
            const btn = document.querySelector("input[type='submit'], button[type='submit'], input.btn, button.btn") as HTMLElement;
            if (btn) btn.click();
          });

          await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 3000));
          console.log("[SSO Scraper] After e-Receipt login URL:", page.url());
        }
      }
    }

    await page.goto("https://www.sso.go.th/erc/erc/repNoM33Info.do", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log("[SSO Scraper] Receipt page URL:", page.url());

    const tmpDir = path.join(os.tmpdir(), "gov-receipts", "sso");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const screenshot = await page.screenshot({ encoding: "base64" }) as string;
    fs.writeFileSync(path.join(tmpDir, "sso_receipt_page.png"), Buffer.from(screenshot, "base64"));
    console.log("[SSO Scraper] Screenshot saved");

    const pageContent = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || "");
    console.log("[SSO Scraper] Receipt page content:", pageContent.substring(0, 500));

    const downloadLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href*='.pdf'], a[href*='download'], a[href*='print'], a[href*='receipt'], a[href*='report'], a[href*='repNo'], button[onclick*='print'], button[onclick*='download'], input[type='button'][onclick*='print']")).map(el => ({
        text: (el.textContent || (el as HTMLInputElement).value || "").trim().substring(0, 60),
        href: (el as HTMLAnchorElement).href || (el as HTMLElement).getAttribute("onclick") || "",
      }));
    });
    console.log("[SSO Scraper] Found links/buttons:", JSON.stringify(downloadLinks).substring(0, 500));

    const tableData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      return rows.slice(0, 20).map(r => (r as HTMLElement).innerText.trim().substring(0, 200));
    });
    console.log("[SSO Scraper] Table data:", JSON.stringify(tableData).substring(0, 500));

    await browser.close();

    return {
      success: true,
      message: `เข้าสู่ระบบประกันสังคมสำเร็จ! อยู่หน้าใบเสร็จแล้ว พบ ${downloadLinks.length} ลิงก์`,
      files: downloadLinks.filter(l => l.href).map(l => ({
        name: l.text || "ใบเสร็จ SSO",
        url: l.href,
        formCode: "SSO",
        taxMonthYear: "",
        refNo: "",
        docType: "SSO_RECEIPT",
      })),
    };
  } catch (err: any) {
    if (browser) await browser.close().catch(() => {});
    return { success: false, message: `เกิดข้อผิดพลาด: ${err.message}` };
  }
}
