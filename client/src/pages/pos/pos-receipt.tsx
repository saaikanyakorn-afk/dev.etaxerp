import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Printer, ArrowLeft, Bluetooth, BluetoothConnected, Settings, Wifi, WifiOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { objectPathToUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  isWebBluetoothSupported,
  connectBluetoothPrinter,
  disconnectPrinter,
  isConnected,
  getConnectedPrinterName,
  printReceipt,
  printTestPage,
  getSavedPrinterConfig,
  savePrinterConfig,
  clearPrinterConfig,
  getPlatform,
  type ReceiptData,
  type PrinterConfig,
} from "@/lib/thermal-printer";

function toBuddhistDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function formatTime(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatMoney(val: string | number | null | undefined) {
  return parseFloat(String(val || "0")).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PosReceipt() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [docSettings, setDocSettings] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [btPrinting, setBtPrinting] = useState(false);
  const [btConnected, setBtConnected] = useState(false);
  const [btName, setBtName] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [paperWidth, setPaperWidth] = useState<"58" | "80">("58");
  const [connecting, setConnecting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const platform = getPlatform();
  const btSupported = isWebBluetoothSupported();

  useEffect(() => {
    const config = getSavedPrinterConfig();
    if (config) {
      setPaperWidth(String(config.paperWidth) as "58" | "80");
    }
    setBtConnected(isConnected());
    setBtName(getConnectedPrinterName());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pos/receipt/${id}`, { credentials: "include" });
        if (res.ok) {
          const result = await res.json();
          setData(result.doc);
          setCompany(result.company);
          setDocSettings(result.docSettings);
          setSession(result.session);
          setLoading(false);

          const logoUrl = result.docSettings?.logoUrl || result.company?.logoUrl;
          if (logoUrl) {
            const resolvedUrl = objectPathToUrl(logoUrl) || logoUrl;
            fetch(resolvedUrl, { credentials: "include" })
              .then(imgRes => imgRes.ok ? imgRes.blob() : null)
              .then(blob => {
                if (!blob) return;
                const reader = new FileReader();
                reader.onloadend = () => setLogoBase64(reader.result as string);
                reader.readAsDataURL(blob);
              })
              .catch(() => {});
          }
          return;
        }
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  const handleBtConnect = async () => {
    setConnecting(true);
    try {
      const result = await connectBluetoothPrinter();
      if (result) {
        setBtConnected(true);
        setBtName(result.name);
        toast({ title: `เชื่อมต่อ ${result.name} สำเร็จ`, variant: "success" as any });
      }
    } catch (err: any) {
      toast({ title: "เชื่อมต่อไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleBtDisconnect = async () => {
    await disconnectPrinter();
    setBtConnected(false);
    setBtName(null);
    toast({ title: "ตัดการเชื่อมต่อแล้ว" });
  };

  const handleBtPrint = async () => {
    if (!data || !isConnected()) return;
    setBtPrinting(true);
    try {
      const items = (data.items || []).map((item: any) => ({
        name: item.productName || "",
        qty: parseFloat(String(item.qty || "0")),
        unitPrice: parseFloat(String(item.unitPrice || "0")),
        total: parseFloat(String(item.totalPrice || String(parseFloat(String(item.qty || "0")) * parseFloat(String(item.unitPrice || "0"))))),
      }));
      const receipt: ReceiptData = {
        companyName: company?.name || "",
        companyNameEn: company?.nameEn || undefined,
        companyAddress: company?.address || undefined,
        companyTaxId: company?.taxId || undefined,
        companyPhone: company?.phone || undefined,
        companyLogoUrl: (() => {
          const showLogo = docSettings ? docSettings.posReceiptShowLogo !== false : company?.showLogo !== false;
          return showLogo && logoBase64 ? logoBase64 : undefined;
        })(),
        companyBranch: company?.branch || session?.branchName || "สำนักงานใหญ่",
        companyBranchId: company?.sellerBranchId || "00000",
        headerText: docSettings?.posReceiptHeaderText || undefined,
        fontSize: docSettings?.posReceiptFontSize || "large",
        docNo: data.taxInvoiceNo || "",
        docDate: toBuddhistDate(data.taxInvoiceDate),
        docTime: formatTime(data.createdAt),
        paymentMethod: data.paymentMethod || undefined,
        items,
        subtotal: parseFloat(String(data.subtotal || "0")),
        discount: parseFloat(String(data.discountAmount || "0")),
        vatAmount: parseFloat(String(data.vatAmount || "0")),
        totalAmount: parseFloat(String(data.totalAmount || "0")),
      };
      await printReceipt(receipt, Number(paperWidth) as 58 | 80);
      toast({ title: "พิมพ์สำเร็จ", variant: "success" as any });
    } catch (err: any) {
      toast({ title: "พิมพ์ไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setBtPrinting(false);
    }
  };

  const handleTestPrint = async () => {
    setBtPrinting(true);
    try {
      await printTestPage(Number(paperWidth) as 58 | 80);
      toast({ title: "ทดสอบพิมพ์สำเร็จ", variant: "success" as any });
    } catch (err: any) {
      toast({ title: "ทดสอบพิมพ์ไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setBtPrinting(false);
    }
  };

  const handleSaveSettings = () => {
    const config: PrinterConfig = {
      name: btName || "Bluetooth Printer",
      paperWidth: Number(paperWidth) as 58 | 80,
      lastConnected: new Date().toISOString(),
    };
    savePrinterConfig(config);
    setShowSettings(false);
    toast({ title: "บันทึกการตั้งค่าแล้ว", variant: "success" as any });
  };

  const receiptWidth = paperWidth === "58" ? "58mm" : "80mm";
  const receiptInnerWidth = paperWidth === "58" ? "54mm" : "76mm";

  const FONT_MAP: Record<string, { base: string; total: string }> = {
    small: { base: "11px", total: "14px" },
    medium: { base: "12px", total: "16px" },
    large: { base: "14px", total: "18px" },
    xlarge: { base: "16px", total: "20px" },
  };
  const fontConf = FONT_MAP[docSettings?.posReceiptFontSize || "large"] || FONT_MAP.large;
  const baseFontSize = fontConf.base;
  const totalFontSize = fontConf.total;

  if (loading) return <div style={{ width: receiptWidth, margin: "0 auto", padding: "8mm", fontFamily: "monospace", fontSize: "12px", textAlign: "center" }}>กำลังโหลด...</div>;
  if (!data) return <div style={{ width: receiptWidth, margin: "0 auto", padding: "8mm", fontFamily: "monospace", fontSize: "12px", textAlign: "center", color: "red" }}>ไม่พบเอกสาร</div>;

  const items = data.items || [];
  const subtotal = parseFloat(String(data.subtotal || "0"));
  const vatAmount = parseFloat(String(data.vatAmount || "0"));
  const totalAmount = parseFloat(String(data.totalAmount || "0"));
  const discountAmount = parseFloat(String(data.discountAmount || "0"));

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${receiptWidth} auto;
            margin: 2mm;
          }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .receipt-container { 
            width: ${receiptInnerWidth} !important; 
            margin: 0 !important; 
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
        @media screen {
          body { background: #e5e7eb; }
        }
      `}</style>
      
      <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <Button onClick={() => window.history.back()} variant="outline" className="gap-1.5" data-testid="btn-back-receipt">
            <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
          </Button>

          {btSupported && !btConnected && (
            <Button
              onClick={handleBtConnect}
              variant="outline"
              className="gap-1.5 border-blue-400 text-blue-600 hover:bg-blue-50"
              disabled={connecting}
              data-testid="btn-bt-connect"
            >
              <Bluetooth className="h-4 w-4" />
              {connecting ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ Bluetooth"}
            </Button>
          )}

          {btConnected && (
            <>
              <Badge variant="outline" className="gap-1.5 border-green-400 text-green-600 py-1.5 px-3" data-testid="badge-bt-connected">
                <BluetoothConnected className="h-3.5 w-3.5" />
                {btName}
              </Badge>
              <Button
                onClick={handleBtPrint}
                variant="default"
                className="gap-1.5 bg-blue-500 hover:bg-blue-600"
                disabled={btPrinting}
                data-testid="btn-bt-print"
              >
                <Bluetooth className="h-4 w-4" />
                {btPrinting ? "กำลังพิมพ์..." : "พิมพ์ Bluetooth"}
              </Button>
            </>
          )}

          <Button onClick={() => window.print()} variant="default" className="gap-1.5 bg-[#fb9678] hover:bg-[#fb9678]/90" data-testid="btn-print-thermal">
            <Printer className="h-4 w-4" /> สั่งพิมพ์ (เบราว์เซอร์)
          </Button>

          <Button onClick={() => setShowSettings(true)} variant="outline" className="gap-1.5" data-testid="btn-printer-settings">
            <Settings className="h-4 w-4" /> ตั้งค่า
          </Button>
        </div>

        {!btSupported && (
          <div className="text-center text-xs text-amber-600 bg-amber-50 rounded px-3 py-1.5">
            <Smartphone className="inline h-3.5 w-3.5 mr-1" />
            {platform === "ios"
              ? "iOS ไม่รองรับ Web Bluetooth — ใช้ปุ่ม \"สั่งพิมพ์ (เบราว์เซอร์)\" แทน"
              : "เบราว์เซอร์นี้ไม่รองรับ Bluetooth — ใช้ Chrome เพื่อเชื่อมต่อ Bluetooth"}
          </div>
        )}
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> ตั้งค่าเครื่องปริ้นท์
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">ขนาดกระดาษ</label>
              <Select value={paperWidth} onValueChange={(v) => setPaperWidth(v as "58" | "80")}>
                <SelectTrigger data-testid="select-paper-width">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58mm (เล็ก)</SelectItem>
                  <SelectItem value="80">80mm (ใหญ่)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">สถานะเชื่อมต่อ</label>
              <div className="flex items-center gap-2 text-sm">
                {btConnected ? (
                  <>
                    <Badge variant="outline" className="border-green-400 text-green-600 gap-1">
                      <BluetoothConnected className="h-3 w-3" /> {btName}
                    </Badge>
                    <Button size="sm" variant="outline" className="text-red-500 border-red-300" onClick={handleBtDisconnect} data-testid="btn-bt-disconnect">
                      ตัดการเชื่อมต่อ
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground">ยังไม่ได้เชื่อมต่อ</span>
                )}
              </div>
            </div>

            {btSupported && !btConnected && (
              <Button onClick={handleBtConnect} variant="outline" className="w-full gap-1.5 border-blue-400 text-blue-600" disabled={connecting} data-testid="btn-settings-bt-connect">
                <Bluetooth className="h-4 w-4" />
                {connecting ? "กำลังค้นหา..." : "เชื่อมต่อ Bluetooth"}
              </Button>
            )}

            {btConnected && (
              <Button onClick={handleTestPrint} variant="outline" className="w-full gap-1.5" disabled={btPrinting} data-testid="btn-test-print">
                <Printer className="h-4 w-4" />
                {btPrinting ? "กำลังพิมพ์..." : "ทดสอบพิมพ์"}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveSettings} className="bg-[#fb9678] hover:bg-[#fb9678]/90" data-testid="btn-save-printer-settings">
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div 
        ref={receiptRef}
        className="receipt-container"
        style={{
          width: receiptWidth,
          margin: "16px auto",
          padding: "4mm",
          fontFamily: "'Courier New', monospace",
          fontSize: baseFontSize,
          lineHeight: "1.4",
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          border: "1px solid #ddd",
          color: "#000",
        }}
        data-testid="thermal-receipt"
      >
        <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
          {(() => {
            const showLogo = docSettings ? docSettings.posReceiptShowLogo !== false : company?.showLogo !== false;
            return showLogo && logoBase64 ? (
              <div style={{ marginBottom: "6px" }}>
                <img
                  src={logoBase64}
                  alt="logo"
                  style={{
                    maxWidth: paperWidth === "58" ? "48px" : "64px",
                    maxHeight: paperWidth === "58" ? "48px" : "64px",
                    objectFit: "contain",
                    margin: "0 auto",
                    display: "block",
                  }}
                  data-testid="receipt-logo"
                />
              </div>
            ) : null;
          })()}
          <div style={{ fontSize: totalFontSize, fontWeight: "bold" }}>{company?.name || ""}</div>
          {company?.nameEn && <div style={{ fontSize: baseFontSize }}>{company.nameEn}</div>}
          {(company?.branch && company.branch !== "สำนักงานใหญ่") || (company?.sellerBranchId && company.sellerBranchId !== "00000") ? (
            <div style={{ fontSize: baseFontSize, fontWeight: "bold" }}>
              สาขา: {company.branch || session?.branchName || "สำนักงานใหญ่"}
              {company.sellerBranchId && company.sellerBranchId !== "00000" && ` (${company.sellerBranchId})`}
            </div>
          ) : (
            <div style={{ fontSize: baseFontSize }}>สำนักงานใหญ่</div>
          )}
          <div style={{ fontSize: baseFontSize, marginTop: "2px" }}>{company?.address || ""}</div>
          {company?.taxId && <div style={{ fontSize: baseFontSize }}>เลขประจำตัวผู้เสียภาษี: {company.taxId}</div>}
          {company?.phone && <div style={{ fontSize: baseFontSize }}>โทร: {company.phone}</div>}
          {docSettings?.posReceiptHeaderText && (
            <div style={{ fontSize: baseFontSize, marginTop: "3px", whiteSpace: "pre-line", lineHeight: "1.4" }}>{docSettings.posReceiptHeaderText}</div>
          )}
          <div style={{ fontSize: totalFontSize, fontWeight: "bold", marginTop: "4px" }}>ใบกำกับภาษีอย่างย่อ</div>
          <div style={{ fontSize: baseFontSize }}>ABB. TAX INVOICE</div>
        </div>

        <div style={{ fontSize: baseFontSize, marginBottom: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>เลขที่:</span>
            <span style={{ fontWeight: "bold" }}>{data.taxInvoiceNo}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>วันที่:</span>
            <span>{toBuddhistDate(data.taxInvoiceDate)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>เวลา:</span>
            <span>{formatTime(data.createdAt)}</span>
          </div>
          {session?.branchName && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>สาขา:</span>
              <span>{session.branchName}</span>
            </div>
          )}
          {session?.terminalName && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>เครื่อง:</span>
              <span>{session.terminalName}</span>
            </div>
          )}
          {data.paymentMethod && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>ชำระ:</span>
              <span>{data.paymentMethod}</span>
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "6px 0", marginBottom: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: baseFontSize, fontWeight: "bold", marginBottom: "4px" }}>
            <span>รายการ</span>
            <span>จำนวนเงิน</span>
          </div>
          {items.map((item: any, idx: number) => {
            const qty = parseFloat(String(item.qty || "0"));
            const price = parseFloat(String(item.unitPrice || "0"));
            const lineTotal = parseFloat(String(item.totalPrice || String(qty * price)));
            return (
              <div key={idx} style={{ marginBottom: "3px" }}>
                <div style={{ fontSize: baseFontSize }}>{item.productName}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: baseFontSize, paddingLeft: "8px" }}>
                  <span>{qty} x {formatMoney(price)}</span>
                  <span>{formatMoney(lineTotal)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: baseFontSize, marginBottom: "6px" }}>
          {items.length > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>รวม ({items.length} รายการ)</span>
              <span>{formatMoney(subtotal + discountAmount)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>ส่วนลด</span>
              <span>-{formatMoney(discountAmount)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>ราคาสินค้า (ก่อน VAT)</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>ภาษีมูลค่าเพิ่ม 7%</span>
            <span>{formatMoney(vatAmount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: totalFontSize, borderTop: "1px dashed #000", paddingTop: "4px", marginTop: "4px" }}>
            <span>รวมทั้งสิ้น</span>
            <span>{formatMoney(totalAmount)}</span>
          </div>
        </div>

        <div style={{ textAlign: "center", borderTop: "1px dashed #000", paddingTop: "6px", fontSize: baseFontSize }}>
          <div>ราคารวมภาษีมูลค่าเพิ่มแล้ว</div>
          {docSettings?.posReceiptFooterText ? (
            <div style={{ marginTop: "4px", whiteSpace: "pre-line", lineHeight: "1.4" }}>{docSettings.posReceiptFooterText}</div>
          ) : (
            <>
              <div style={{ marginTop: "4px" }}>ขอบคุณที่ใช้บริการ</div>
              <div>Thank you</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
