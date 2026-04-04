const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function cmd(...args: number[]): Uint8Array {
  return new Uint8Array(args);
}

const INIT = cmd(ESC, 0x40);
const FEED_CUT = cmd(LF, LF, LF, GS, 0x56, 0x42, 0x03);
const FEED3 = cmd(LF, LF, LF);
const LINE_FEED = cmd(LF);

type PaperWidth = 58 | 80;

function getPixelWidth(paper: PaperWidth): number {
  return paper === 58 ? 384 : 576;
}

function formatMoney(val: number): string {
  return val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface ReceiptData {
  companyName: string;
  companyNameEn?: string;
  companyAddress?: string;
  companyTaxId?: string;
  companyPhone?: string;
  companyLogoUrl?: string;
  companyBranch?: string;
  companyBranchId?: string;
  headerText?: string;
  footerText?: string;
  fontSize?: "small" | "medium" | "large" | "xlarge";
  docNo: string;
  docDate: string;
  docTime: string;
  paymentMethod?: string;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  vatAmount: number;
  totalAmount: number;
}

const THERMAL_FONT: Record<string, { body: number; heading: number; title: number; gap: number }> = {
  small:  { body: 13, heading: 15, title: 17, gap: 3 },
  medium: { body: 14, heading: 16, title: 18, gap: 3 },
  large:  { body: 16, heading: 18, title: 20, gap: 4 },
  xlarge: { body: 18, heading: 20, title: 24, gap: 4 },
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let fit = remaining.length;
    while (fit > 0 && ctx.measureText(remaining.substring(0, fit)).width > maxWidth) {
      fit--;
    }
    if (fit === 0) fit = 1;
    lines.push(remaining.substring(0, fit));
    remaining = remaining.substring(fit);
  }
  return lines;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn("[thermal-printer] logo load error:", url);
      resolve(null);
    };
    setTimeout(() => { console.warn("[thermal-printer] logo load timeout:", url); resolve(null); }, 5000);
    img.src = url;
  });
}

async function renderReceiptToCanvas(data: ReceiptData, paper: PaperWidth): Promise<HTMLCanvasElement> {
  const pw = getPixelWidth(paper);
  const margin = 8;
  const contentW = pw - margin * 2;
  const ft = THERMAL_FONT[data.fontSize || "medium"] || THERMAL_FONT.medium;

  let logoImg: HTMLImageElement | null = null;
  if (data.companyLogoUrl) {
    logoImg = await loadImage(data.companyLogoUrl);
  }

  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = pw;
  tmpCanvas.height = 3000;
  const tmpCtx = tmpCanvas.getContext("2d")!;
  tmpCtx.font = `${ft.body}px "Sarabun", "Noto Sans Thai", sans-serif`;

  let y = 20;
  const draws: Array<() => void> = [];

  const drawCenterBold = (text: string, fontSize: number) => {
    tmpCtx.font = `bold ${fontSize}px "Sarabun", "Noto Sans Thai", sans-serif`;
    const wrapped = wrapText(tmpCtx, text, contentW);
    for (const line of wrapped) {
      const currentY = y;
      draws.push(() => {
        ctx.font = `bold ${fontSize}px "Sarabun", "Noto Sans Thai", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(line, pw / 2, currentY);
      });
      y += fontSize + ft.gap;
    }
  };

  const drawCenter = (text: string, fontSize: number) => {
    tmpCtx.font = `${fontSize}px "Sarabun", "Noto Sans Thai", sans-serif`;
    const wrapped = wrapText(tmpCtx, text, contentW);
    for (const line of wrapped) {
      const currentY = y;
      draws.push(() => {
        ctx.font = `${fontSize}px "Sarabun", "Noto Sans Thai", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(line, pw / 2, currentY);
      });
      y += fontSize + ft.gap;
    }
  };

  const drawLeft = (text: string, fontSize: number) => {
    tmpCtx.font = `${fontSize}px "Sarabun", "Noto Sans Thai", sans-serif`;
    const wrapped = wrapText(tmpCtx, text, contentW);
    for (const line of wrapped) {
      const currentY = y;
      draws.push(() => {
        ctx.font = `${fontSize}px "Sarabun", "Noto Sans Thai", sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(line, margin, currentY);
      });
      y += fontSize + ft.gap;
    }
  };

  const drawRow = (left: string, right: string, bold: boolean = false, fontSize: number = ft.body) => {
    const currentY = y;
    draws.push(() => {
      const fw = bold ? `bold ${fontSize}px` : `${fontSize}px`;
      ctx.font = `${fw} "Sarabun", "Noto Sans Thai", sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(left, margin, currentY);
      ctx.textAlign = "right";
      ctx.fillText(right, pw - margin, currentY);
    });
    y += fontSize + ft.gap;
  };

  const drawDash = () => {
    const currentY = y;
    draws.push(() => {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(margin, currentY - 2);
      ctx.lineTo(pw - margin, currentY - 2);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    y += 4;
  };

  if (logoImg) {
    const logoSize = paper === 58 ? 60 : 80;
    const aspect = logoImg.naturalWidth / logoImg.naturalHeight;
    const logoW = aspect >= 1 ? logoSize : Math.round(logoSize * aspect);
    const logoH = aspect >= 1 ? Math.round(logoSize / aspect) : logoSize;
    const logoX = (pw - logoW) / 2;
    const currentY = y;
    draws.push(() => {
      ctx.drawImage(logoImg!, logoX, currentY, logoW, logoH);
    });
    y += logoH + 6;
  }

  drawCenterBold(data.companyName, ft.title);
  if (data.companyNameEn) drawCenter(data.companyNameEn, ft.body);
  if (data.companyBranch && data.companyBranch !== "สำนักงานใหญ่" && data.companyBranchId && data.companyBranchId !== "00000") {
    drawCenter(`สาขา: ${data.companyBranch} (${data.companyBranchId})`, ft.body);
  } else {
    drawCenter("สำนักงานใหญ่", ft.body);
  }
  if (data.companyAddress) drawCenter(data.companyAddress, ft.body);
  if (data.companyTaxId) drawCenter(`เลขประจำตัวผู้เสียภาษี: ${data.companyTaxId}`, ft.body);
  if (data.companyPhone) drawCenter(`โทร: ${data.companyPhone}`, ft.body);
  if (data.headerText) {
    for (const line of data.headerText.split("\n")) {
      if (line.trim()) drawCenter(line.trim(), ft.body);
    }
  }

  y += 4;
  drawCenterBold("ใบกำกับภาษีอย่างย่อ", ft.heading);
  drawCenter("ABB. TAX INVOICE", ft.body);

  drawDash();
  drawRow("เลขที่:", data.docNo, false, ft.body);
  drawRow("วันที่:", data.docDate, false, ft.body);
  drawRow("เวลา:", data.docTime, false, ft.body);
  if (data.paymentMethod) drawRow("ชำระ:", data.paymentMethod, false, ft.body);

  drawDash();
  drawRow("รายการ", "จำนวนเงิน", true, ft.body);
  drawDash();

  for (const item of data.items) {
    drawLeft(item.name, ft.body);
    const detail = `  ${item.qty} x ${formatMoney(item.unitPrice)}`;
    drawRow(detail, formatMoney(item.total), false, ft.body);
  }

  drawDash();

  if (data.items.length > 1) {
    drawRow(`รวม (${data.items.length} รายการ)`, formatMoney(data.subtotal + data.discount), false, ft.body);
  }
  if (data.discount > 0) {
    drawRow("ส่วนลด", `-${formatMoney(data.discount)}`, false, ft.body);
  }
  drawRow("ราคาก่อน VAT", formatMoney(data.subtotal), false, ft.body);
  drawRow("ภาษีมูลค่าเพิ่ม 7%", formatMoney(data.vatAmount), false, ft.body);

  drawDash();
  drawRow("รวมทั้งสิ้น", formatMoney(data.totalAmount), true, ft.heading);
  drawDash();

  y += 4;
  drawCenter("ราคารวมภาษีมูลค่าเพิ่มแล้ว", ft.body);
  if (data.footerText) {
    for (const line of data.footerText.split("\n")) {
      if (line.trim()) drawCenter(line.trim(), ft.body);
    }
  } else {
    drawCenter("ขอบคุณที่ใช้บริการ", ft.body);
    drawCenter("Thank you", ft.body);
  }
  y += 10;

  const totalHeight = y;
  const canvas = document.createElement("canvas");
  canvas.width = pw;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, pw, totalHeight);
  ctx.fillStyle = "#000";

  for (const draw of draws) {
    draw();
  }

  return canvas;
}

function canvasToRasterBytes(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imgData.data;
  const w = canvas.width;
  const h = canvas.height;

  const bytesPerRow = Math.ceil(w / 8);
  const allRowData = new Uint8Array(h * bytesPerRow);

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const idx = (row * w + col) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      if (gray < 128) {
        const byteIdx = row * bytesPerRow + Math.floor(col / 8);
        allRowData[byteIdx] |= (0x80 >> (col % 8));
      }
    }
  }

  const BLOCK_HEIGHT = 24;
  const parts: Uint8Array[] = [INIT];

  for (let startRow = 0; startRow < h; startRow += BLOCK_HEIGHT) {
    const blockH = Math.min(BLOCK_HEIGHT, h - startRow);
    const dataLen = blockH * bytesPerRow;

    const header = new Uint8Array(8);
    header[0] = GS;
    header[1] = 0x76;
    header[2] = 0x30;
    header[3] = 0x00;
    header[4] = bytesPerRow & 0xff;
    header[5] = (bytesPerRow >> 8) & 0xff;
    header[6] = blockH & 0xff;
    header[7] = (blockH >> 8) & 0xff;
    parts.push(header);
    parts.push(allRowData.slice(startRow * bytesPerRow, startRow * bytesPerRow + dataLen));
  }

  parts.push(FEED_CUT);

  let totalLen = 0;
  parts.forEach(p => totalLen += p.length);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  parts.forEach(p => { result.set(p, offset); offset += p.length; });
  return result;
}

export async function buildReceiptBytes(data: ReceiptData, paper: PaperWidth = 58): Promise<Uint8Array> {
  const canvas = await renderReceiptToCanvas(data, paper);
  return canvasToRasterBytes(canvas);
}

export async function renderReceiptPreview(data: ReceiptData, paper: PaperWidth = 58): Promise<string> {
  const canvas = await renderReceiptToCanvas(data, paper);
  return canvas.toDataURL("image/png");
}

const PRINTER_STORAGE_KEY = "pos_printer_config";
const BT_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const BT_CHAR_UUID = "00002af1-0000-1000-8000-00805f9b34fb";
const BT_SERVICE_UUID_ALT = "e7810a71-73ae-499d-8c15-faa9aef0c3f2";
const BT_CHAR_UUID_ALT = "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f";

export interface PrinterConfig {
  name: string;
  paperWidth: PaperWidth;
  lastConnected?: string;
}

export function getSavedPrinterConfig(): PrinterConfig | null {
  try {
    const raw = localStorage.getItem(PRINTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePrinterConfig(config: PrinterConfig) {
  localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(config));
}

export function clearPrinterConfig() {
  localStorage.removeItem(PRINTER_STORAGE_KEY);
}

export function isWebBluetoothSupported(): boolean {
  return !!(navigator as any).bluetooth?.requestDevice;
}

export function getPlatform(): "android" | "ios" | "windows" | "mac" | "other" {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/win/.test(ua)) return "windows";
  if (/mac/.test(ua)) return "mac";
  return "other";
}

let btDevice: BluetoothDevice | null = null;
let btCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

export async function connectBluetoothPrinter(): Promise<{ name: string } | null> {
  if (!isWebBluetoothSupported()) {
    throw new Error("เบราว์เซอร์นี้ไม่รองรับ Bluetooth (ใช้ Chrome บน Android/Windows)");
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { services: [BT_SERVICE_UUID] },
        { services: [BT_CHAR_UUID_ALT] },
        { namePrefix: "POS" },
        { namePrefix: "Printer" },
        { namePrefix: "BlueTooth" },
        { namePrefix: "BT" },
        { namePrefix: "MPT" },
        { namePrefix: "MTP" },
        { namePrefix: "RPP" },
      ],
      optionalServices: [BT_SERVICE_UUID, BT_SERVICE_UUID_ALT, "battery_service"],
    });

    if (!device) return null;

    const server = await device.gatt?.connect();
    if (!server) throw new Error("ไม่สามารถเชื่อมต่อ GATT server");

    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

    const tryService = async (svcUuid: string, charUuid: string) => {
      try {
        const svc = await server.getPrimaryService(svcUuid);
        return await svc.getCharacteristic(charUuid);
      } catch { return null; }
    };

    characteristic = await tryService(BT_SERVICE_UUID, BT_CHAR_UUID);
    if (!characteristic) {
      characteristic = await tryService(BT_SERVICE_UUID_ALT, BT_CHAR_UUID_ALT);
    }

    if (!characteristic) {
      throw new Error("ไม่พบ Printer Service — ลองปิด/เปิด Bluetooth แล้วเชื่อมต่อใหม่");
    }

    btDevice = device;
    btCharacteristic = characteristic;

    device.addEventListener("gattserverdisconnected", () => {
      btDevice = null;
      btCharacteristic = null;
    });

    const config: PrinterConfig = {
      name: device.name || "Bluetooth Printer",
      paperWidth: 58,
      lastConnected: new Date().toISOString(),
    };
    savePrinterConfig(config);

    return { name: config.name };
  } catch (err: any) {
    if (err.name === "NotFoundError") return null;
    throw err;
  }
}

export function isConnected(): boolean {
  return !!(btDevice?.gatt?.connected && btCharacteristic);
}

export function getConnectedPrinterName(): string | null {
  if (!isConnected()) return null;
  return btDevice?.name || "Bluetooth Printer";
}

export async function disconnectPrinter() {
  if (btDevice?.gatt?.connected) {
    btDevice.gatt.disconnect();
  }
  btDevice = null;
  btCharacteristic = null;
}

export async function printBytes(data: Uint8Array): Promise<void> {
  if (!btCharacteristic) {
    throw new Error("ยังไม่ได้เชื่อมต่อเครื่องปริ้นท์");
  }

  const CHUNK_SIZE = 100;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    try {
      await btCharacteristic.writeValueWithoutResponse(chunk);
    } catch {
      await btCharacteristic.writeValue(chunk);
    }
    if (data.length > CHUNK_SIZE) {
      await new Promise(r => setTimeout(r, 30));
    }
  }
}

export async function printReceipt(receipt: ReceiptData, paperWidth: PaperWidth = 58): Promise<void> {
  const bytes = await buildReceiptBytes(receipt, paperWidth);
  await printBytes(bytes);
}

export async function printTestPage(paperWidth: PaperWidth = 58): Promise<void> {
  const receipt: ReceiptData = {
    companyName: "ทดสอบเครื่องปริ้นท์",
    docNo: "TEST-001",
    docDate: new Date().toLocaleDateString("th-TH"),
    docTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    items: [
      { name: "สินค้าทดสอบ", qty: 1, unitPrice: 100, total: 100 },
      { name: "Test Item 2", qty: 2, unitPrice: 50, total: 100 },
    ],
    subtotal: 200,
    discount: 0,
    vatAmount: 14,
    totalAmount: 200,
  };
  await printReceipt(receipt, paperWidth);
}
