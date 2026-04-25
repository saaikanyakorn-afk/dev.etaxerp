import puppeteer, { type Browser, type Page } from "puppeteer-core";
import path from "path";
import fs from "fs";

const CHROMIUM_PATH = "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium";
const MAX_CONCURRENT = 3;
const MAX_QUEUE_LENGTH = 50;
const IDLE_TIMEOUT_MS = 30_000;
const LAUNCH_TIMEOUT_MS = 30_000;

interface QueueItem {
  html: string;
  options: PdfOptions;
  resolve: (buf: Buffer) => void;
  reject: (err: Error) => void;
}

export interface PdfOptions {
  format?: "A4" | "A5";
  landscape?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  width?: string;
  height?: string;
  printBackground?: boolean;
}

let cachedFontFacesCSS: string | null = null;
function getFontFacesCSS(): string {
  if (cachedFontFacesCSS) return cachedFontFacesCSS;
  const fontsDir = path.join(process.cwd(), "server/fonts");
  const regular = fs.readFileSync(path.join(fontsDir, "Sarabun-Regular.ttf")).toString("base64");
  const bold = fs.readFileSync(path.join(fontsDir, "Sarabun-Bold.ttf")).toString("base64");
  const semiBold = fs.readFileSync(path.join(fontsDir, "Sarabun-SemiBold.ttf")).toString("base64");
  cachedFontFacesCSS = `
    @font-face { font-family:'Sarabun'; src:url(data:font/ttf;base64,${regular}) format('truetype'); font-weight:400; font-style:normal; }
    @font-face { font-family:'Sarabun'; src:url(data:font/ttf;base64,${bold}) format('truetype'); font-weight:700; font-style:normal; }
    @font-face { font-family:'Sarabun'; src:url(data:font/ttf;base64,${semiBold}) format('truetype'); font-weight:600; font-style:normal; }
  `;
  return cachedFontFacesCSS;
}

class PuppeteerPdfService {
  private browser: Browser | null = null;
  private launching = false;
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private totalGenerated = 0;
  private errors = 0;

  private resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.closeBrowser(), IDLE_TIMEOUT_MS);
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser?.connected) {
      this.resetIdleTimer();
      return this.browser;
    }

    if (this.launching) {
      return new Promise((resolve, reject) => {
        const check = setInterval(() => {
          if (this.browser?.connected) {
            clearInterval(check);
            resolve(this.browser!);
          }
          if (!this.launching && !this.browser) {
            clearInterval(check);
            reject(new Error("Browser launch failed"));
          }
        }, 100);
        setTimeout(() => { clearInterval(check); reject(new Error("Browser launch timeout")); }, LAUNCH_TIMEOUT_MS);
      });
    }

    this.launching = true;
    try {
      console.log("[PDF Service] Launching Chromium...");
      const t0 = Date.now();
      this.browser = await puppeteer.launch({
        executablePath: CHROMIUM_PATH,
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-software-rasterizer",
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-sync",
          "--disable-translate",
          "--no-first-run",
          "--single-process",
          "--font-render-hinting=none",
        ],
      });

      this.browser.on("disconnected", () => {
        console.log("[PDF Service] Browser disconnected");
        this.browser = null;
      });

      const elapsed = Date.now() - t0;
      console.log(`[PDF Service] Chromium ready in ${elapsed}ms`);
      this.resetIdleTimer();
      return this.browser;
    } catch (err) {
      console.error("[PDF Service] Failed to launch Chromium:", err);
      throw err;
    } finally {
      this.launching = false;
    }
  }

  private async closeBrowser() {
    if (this.activeCount > 0) {
      this.resetIdleTimer();
      return;
    }
    if (this.browser) {
      console.log("[PDF Service] Closing idle Chromium (freeing RAM)");
      try {
        await this.browser.close();
      } catch {}
      this.browser = null;
    }
  }

  async generatePdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
    if (this.queue.length >= MAX_QUEUE_LENGTH) {
      throw new Error("PDF queue full — please try again later");
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ html, options, resolve, reject });
      this.processQueue();
    });
  }

  async generatePdfFromUrl(url: string, cookies: Array<{name: string; value: string; domain: string}>, options: PdfOptions = {}): Promise<Buffer> {
    const browser = await this.ensureBrowser();
    let page: Page | null = null;
    try {
      page = await browser.newPage();
      if (cookies.length > 0) {
        await page.setCookie(...cookies);
      }
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.evaluateHandle("document.fonts.ready");

      const pdfOptions: any = {
        printBackground: options.printBackground !== false,
        preferCSSPageSize: false,
      };
      if (options.width && options.height) {
        pdfOptions.width = options.width;
        pdfOptions.height = options.height;
      } else {
        pdfOptions.format = options.format || "A4";
      }
      if (options.landscape) pdfOptions.landscape = true;
      pdfOptions.margin = options.margin || { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" };

      const pdfBuffer = await page.pdf(pdfOptions);
      this.totalGenerated++;
      this.resetIdleTimer();
      return Buffer.from(pdfBuffer);
    } catch (err: any) {
      this.errors++;
      console.error("[PDF Service] URL generation error:", err.message);
      throw err;
    } finally {
      if (page) {
        try { await page.close(); } catch {}
      }
    }
  }

  private async processQueue() {
    while (this.queue.length > 0 && this.activeCount < MAX_CONCURRENT) {
      const item = this.queue.shift()!;
      this.activeCount++;

      this.doGenerate(item)
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.activeCount--;
          this.processQueue();
        });
    }
  }

  private async doGenerate(item: QueueItem): Promise<Buffer> {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let page: Page | null = null;
      try {
        if (attempt > 0) {
          await this.closeBrowser();
          await new Promise(r => setTimeout(r, 500));
        }
        const browser = await this.ensureBrowser();
        if (this.idleTimer) clearTimeout(this.idleTimer);
        page = await browser.newPage();

        await page.setContent(item.html, { waitUntil: "domcontentloaded", timeout: 10_000 });

        if (!item.html.includes("@font-face")) {
          await page.addStyleTag({ content: getFontFacesCSS() });
        }
        await page.evaluateHandle("document.fonts.ready");

        const pdfOptions: any = {
          printBackground: item.options.printBackground !== false,
          preferCSSPageSize: false,
        };

        if (item.options.width && item.options.height) {
          pdfOptions.width = item.options.width;
          pdfOptions.height = item.options.height;
        } else {
          pdfOptions.format = item.options.format || "A4";
        }

        if (item.options.landscape) {
          pdfOptions.landscape = true;
        }

        pdfOptions.margin = item.options.margin || {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        };

        const pdfBuffer = await page.pdf(pdfOptions);
        this.totalGenerated++;
        this.resetIdleTimer();
        return Buffer.from(pdfBuffer);
      } catch (err: any) {
        if (page) { try { await page.close(); } catch {} page = null; }
        const isRetryable = err.message?.includes("detached") || err.message?.includes("disconnected") || err.message?.includes("closed") || err.message?.includes("Target closed");
        if (isRetryable && attempt < maxRetries) {
          console.log(`[PDF Service] Retrying (attempt ${attempt + 1}/${maxRetries}): ${err.message}`);
          continue;
        }
        this.errors++;
        console.error("[PDF Service] Generation error:", err.message);
        throw err;
      } finally {
        if (page) {
          try { await page.close(); } catch {}
        }
      }
    }
    throw new Error("PDF generation failed after retries");
  }

  getStats() {
    return {
      browserConnected: !!this.browser?.connected,
      activeJobs: this.activeCount,
      queueLength: this.queue.length,
      totalGenerated: this.totalGenerated,
      errors: this.errors,
      maxConcurrent: MAX_CONCURRENT,
      idleTimeoutMs: IDLE_TIMEOUT_MS,
    };
  }

  async warmup() {
    try {
      console.log("[PDF Service] Pre-warming Chromium...");
      await this.ensureBrowser();
      console.log("[PDF Service] Chromium pre-warmed and ready");
    } catch (err: any) {
      console.log("[PDF Service] Warmup failed (will retry on first request):", err.message);
    }
  }

  async shutdown() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.queue.forEach(item => item.reject(new Error("Service shutting down")));
    this.queue = [];
    await this.closeBrowser();
    console.log("[PDF Service] Shutdown complete");
  }
}

export const pdfService = new PuppeteerPdfService();

