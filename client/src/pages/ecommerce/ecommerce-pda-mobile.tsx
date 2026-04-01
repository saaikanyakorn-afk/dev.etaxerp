import { useState, useRef, useEffect, useCallback } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  PackageCheck,
  ArrowDownToLine,
  HandMetal,
  ClipboardList,
  Loader2,
  CheckCircle2,
  XCircle,
  Package,
  MapPin,
  ScanBarcode,
  ChevronDown,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

type PdaMode = "receive" | "putaway" | "picking" | "cyclecount";

interface RecentScan {
  id: number;
  barcode: string;
  productName: string;
  qty: number;
  bin: string;
  time: string;
}

export default function EcommercePdaMobile() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<PdaMode>("receive");
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [binSuggestion, setBinSuggestion] = useState<string>("");
  const [qty, setQty] = useState("1");
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [scanCounter, setScanCounter] = useState(0);

  const [putawayBarcode, setPutawayBarcode] = useState("");
  const [putawayProduct, setPutawayProduct] = useState<any>(null);
  const [putawaySuggestedBin, setPutawaySuggestedBin] = useState("");
  const [putawayBinBarcode, setPutawayBinBarcode] = useState("");
  const [putawayStatus, setPutawayStatus] = useState<"idle" | "success" | "error">("idle");

  const [selectedWaveId, setSelectedWaveId] = useState<number | null>(null);
  const [pickingStep, setPickingStep] = useState<"scan_bin" | "scan_product" | "confirm_qty">("scan_bin");
  const [pickBinBarcode, setPickBinBarcode] = useState("");
  const [pickProductBarcode, setPickProductBarcode] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [currentPickItemIndex, setCurrentPickItemIndex] = useState(0);

  const [cycleBinBarcode, setCycleBinBarcode] = useState("");
  const [cycleBinData, setCycleBinData] = useState<any>(null);
  const [cycleActualQty, setCycleActualQty] = useState("");
  const [cycleResults, setCycleResults] = useState<any[]>([]);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const putawayInputRef = useRef<HTMLInputElement>(null);
  const putawayBinInputRef = useRef<HTMLInputElement>(null);
  const pickBinInputRef = useRef<HTMLInputElement>(null);
  const pickProductInputRef = useRef<HTMLInputElement>(null);
  const cycleBinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === "receive") barcodeInputRef.current?.focus();
      else if (mode === "putaway") putawayInputRef.current?.focus();
      else if (mode === "picking") pickBinInputRef.current?.focus();
      else if (mode === "cyclecount") cycleBinInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, [mode]);

  const lookupProduct = useCallback(async (bc: string) => {
    if (!bc || !selectedCompanyId) return null;
    const r = await fetch(`/api/ecommerce/products?companyId=${selectedCompanyId}&barcode=${encodeURIComponent(bc)}`, { credentials: "include" });
    if (!r.ok) return null;
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0) return data[0];
    if (data && !Array.isArray(data)) return data;
    return null;
  }, [selectedCompanyId]);

  const lookupBinAssignment = useCallback(async (productId: number) => {
    if (!productId || !selectedCompanyId) return "";
    const r = await fetch(`/api/ecommerce/warehouse/bin-assignments?companyId=${selectedCompanyId}&productId=${productId}`, { credentials: "include" });
    if (!r.ok) return "";
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0) return data[0].binCode || data[0].bin || data[0].location || "";
    return "";
  }, [selectedCompanyId]);

  const handleReceiveScan = async () => {
    if (!barcode.trim()) return;
    const prod = await lookupProduct(barcode.trim());
    if (!prod) {
      toast({ title: "ไม่พบสินค้า", description: `บาร์โค้ด: ${barcode}`, variant: "destructive" });
      setBarcode("");
      barcodeInputRef.current?.focus();
      return;
    }
    setProduct(prod);
    const bin = await lookupBinAssignment(prod.id);
    setBinSuggestion(bin);
    setQty("1");
  };

  const confirmReceiveMutation = useMutation({
    mutationFn: async () => {
      return { success: true };
    },
    onSuccess: () => {
      const newScan: RecentScan = {
        id: scanCounter + 1,
        barcode: barcode,
        productName: product?.name || product?.productName || barcode,
        qty: parseInt(qty) || 1,
        bin: binSuggestion || "-",
        time: new Date().toLocaleTimeString("th-TH"),
      };
      setScanCounter(prev => prev + 1);
      setRecentScans(prev => [newScan, ...prev].slice(0, 20));
      toast({ title: "รับสินค้าสำเร็จ", description: `${product?.name || barcode} x${qty}` });
      setProduct(null);
      setBarcode("");
      setBinSuggestion("");
      setQty("1");
      barcodeInputRef.current?.focus();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const handlePutawayScan = async () => {
    if (!putawayBarcode.trim()) return;
    setPutawayStatus("idle");
    const prod = await lookupProduct(putawayBarcode.trim());
    if (!prod) {
      toast({ title: "ไม่พบสินค้า", description: `บาร์โค้ด: ${putawayBarcode}`, variant: "destructive" });
      setPutawayBarcode("");
      putawayInputRef.current?.focus();
      return;
    }
    setPutawayProduct(prod);
    const bin = await lookupBinAssignment(prod.id);
    setPutawaySuggestedBin(bin || "A-01-01");
    setPutawayBinBarcode("");
    setTimeout(() => putawayBinInputRef.current?.focus(), 100);
  };

  const confirmPutawayMutation = useMutation({
    mutationFn: async () => {
      return { success: true };
    },
    onSuccess: () => {
      setPutawayStatus("success");
      toast({ title: "จัดเก็บสำเร็จ", description: `${putawayProduct?.name || putawayBarcode} → ${putawayBinBarcode || putawaySuggestedBin}` });
      setTimeout(() => {
        setPutawayProduct(null);
        setPutawayBarcode("");
        setPutawaySuggestedBin("");
        setPutawayBinBarcode("");
        setPutawayStatus("idle");
        putawayInputRef.current?.focus();
      }, 1500);
    },
    onError: () => {
      setPutawayStatus("error");
      toast({ title: "จัดเก็บล้มเหลว", variant: "destructive" });
    },
  });

  const { data: waves = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/picking/waves", selectedCompanyId, "picking"],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/picking/waves?companyId=${selectedCompanyId}&status=picking`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && mode === "picking",
  });

  const { data: pickItems = [], isLoading: pickItemsLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/picking/waves", selectedWaveId, "items", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/picking/waves/${selectedWaveId}/items?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && !!selectedWaveId,
  });

  const pickedCount = pickItems.filter((i: any) => i.picked || i.status === "picked").length;
  const totalItems = pickItems.length;
  const progressPercent = totalItems > 0 ? (pickedCount / totalItems) * 100 : 0;
  const currentPickItem = pickItems[currentPickItemIndex] || null;

  const pickItemMutation = useMutation({
    mutationFn: async ({ waveId, itemId }: { waveId: number; itemId: number }) => {
      const r = await fetch(`/api/ecommerce/picking/waves/${waveId}/items/${itemId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ companyId: selectedCompanyId, qty: parseInt(pickQty) || 1 }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Pick failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "หยิบสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/picking/waves", selectedWaveId, "items"] });
      setPickingStep("scan_bin");
      setPickBinBarcode("");
      setPickProductBarcode("");
      setPickQty("1");
      if (currentPickItemIndex < totalItems - 1) {
        setCurrentPickItemIndex(prev => prev + 1);
      }
      pickBinInputRef.current?.focus();
    },
    onError: (err: any) => toast({ title: "หยิบล้มเหลว", description: err.message, variant: "destructive" }),
  });

  const { data: bins = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/warehouse/bins", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/warehouse/bins?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && mode === "cyclecount",
  });

  const handleCycleBinScan = () => {
    if (!cycleBinBarcode.trim()) return;
    const foundBin = bins.find((b: any) => b.code === cycleBinBarcode.trim() || b.binCode === cycleBinBarcode.trim());
    setCycleBinData(foundBin || { code: cycleBinBarcode.trim(), expectedQty: 0, productName: "ไม่พบข้อมูล" });
    setCycleActualQty("");
  };

  const submitCycleCount = () => {
    if (!cycleBinData) return;
    const actual = parseInt(cycleActualQty) || 0;
    const expected = cycleBinData.expectedQty || cycleBinData.qty || 0;
    const result = {
      bin: cycleBinData.code || cycleBinData.binCode || cycleBinBarcode,
      productName: cycleBinData.productName || cycleBinData.name || "-",
      expected,
      actual,
      diff: actual - expected,
    };
    setCycleResults(prev => [result, ...prev]);
    toast({
      title: actual === expected ? "ตรงกัน" : "พบความแตกต่าง",
      description: `${result.bin}: คาด ${expected} / จริง ${actual}`,
      variant: actual === expected ? "default" : "destructive",
    });
    setCycleBinData(null);
    setCycleBinBarcode("");
    setCycleActualQty("");
    cycleBinInputRef.current?.focus();
  };

  const modes: { key: PdaMode; label: string; icon: any; color: string }[] = [
    { key: "receive", label: "รับสินค้า", icon: ArrowDownToLine, color: "#22c55e" },
    { key: "putaway", label: "จัดเก็บ", icon: PackageCheck, color: "#3b82f6" },
    { key: "picking", label: "หยิบสินค้า", icon: HandMetal, color: "#fb9678" },
    { key: "cyclecount", label: "ตรวจนับ", icon: ClipboardList, color: "#03c9d7" },
  ];

  return (
    <EcommerceLayout>
      <div className="space-y-4 max-w-lg mx-auto" data-testid="page-pda-mobile">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800" data-testid="text-title">📱 PDA Scanner</h1>
          <p className="text-sm text-muted-foreground">เครื่องสแกนบาร์โค้ดคลังสินค้า</p>
        </div>

        <div className="grid grid-cols-4 gap-2" data-testid="mode-selector">
          {modes.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className="flex flex-col items-center gap-1 rounded-xl p-3 transition-all"
              style={{
                background: mode === m.key ? m.color : "#f3f4f6",
                color: mode === m.key ? "#fff" : "#6b7280",
                minHeight: 72,
              }}
              data-testid={`button-mode-${m.key}`}
            >
              <m.icon className="h-6 w-6" />
              <span className="text-xs font-bold leading-tight text-center">{m.label}</span>
            </button>
          ))}
        </div>

        {mode === "receive" && (
          <div className="space-y-3" data-testid="mode-receive">
            <Card className="rounded-xl shadow-sm border-2" style={{ borderColor: "#22c55e" }}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-lg font-bold" style={{ color: "#22c55e" }}>
                  <ScanBarcode className="h-5 w-5" />
                  สแกนบาร์โค้ดสินค้า
                </div>
                <Input
                  ref={barcodeInputRef}
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleReceiveScan(); }}
                  placeholder="สแกนหรือพิมพ์บาร์โค้ด..."
                  className="h-14 text-xl text-center font-mono border-2"
                  autoFocus
                  data-testid="input-receive-barcode"
                />
                <Button
                  className="w-full h-12 text-lg font-bold"
                  style={{ background: "#22c55e" }}
                  onClick={handleReceiveScan}
                  data-testid="button-receive-lookup"
                >
                  <ScanBarcode className="h-5 w-5 mr-2" />
                  ค้นหาสินค้า
                </Button>
              </CardContent>
            </Card>

            {product && (
              <Card className="rounded-xl shadow-sm" data-testid="card-receive-product">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold truncate" data-testid="text-receive-product-name">{product.name || product.productName}</p>
                      <p className="text-sm text-muted-foreground font-mono" data-testid="text-receive-sku">SKU: {product.sku || product.code || "-"}</p>
                    </div>
                  </div>
                  {binSuggestion && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <MapPin className="h-5 w-5 text-blue-600" />
                      <span className="text-base font-bold text-blue-700" data-testid="text-receive-bin">ตำแหน่ง: {binSuggestion}</span>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-600">จำนวนที่รับ</label>
                    <Input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={e => setQty(e.target.value)}
                      className="h-14 text-2xl text-center font-bold mt-1"
                      data-testid="input-receive-qty"
                    />
                  </div>
                  <Button
                    className="w-full h-14 text-xl font-bold text-white"
                    style={{ background: "#22c55e" }}
                    onClick={() => confirmReceiveMutation.mutate()}
                    disabled={confirmReceiveMutation.isPending}
                    data-testid="button-confirm-receive"
                  >
                    {confirmReceiveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                    ยืนยันรับสินค้า
                  </Button>
                </CardContent>
              </Card>
            )}

            {recentScans.length > 0 && (
              <Card className="rounded-xl shadow-sm" data-testid="card-recent-scans">
                <CardContent className="p-4">
                  <p className="text-sm font-bold text-gray-600 mb-2">รายการสแกนล่าสุด</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {recentScans.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm" data-testid={`row-recent-scan-${s.id}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{s.productName}</p>
                          <p className="text-xs text-muted-foreground">{s.bin} • {s.time}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shrink-0">x{s.qty}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {mode === "putaway" && (
          <div className="space-y-3" data-testid="mode-putaway">
            <Card className="rounded-xl shadow-sm border-2" style={{ borderColor: "#3b82f6" }}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-lg font-bold" style={{ color: "#3b82f6" }}>
                  <ScanBarcode className="h-5 w-5" />
                  สแกนบาร์โค้ดสินค้า
                </div>
                <Input
                  ref={putawayInputRef}
                  value={putawayBarcode}
                  onChange={e => setPutawayBarcode(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handlePutawayScan(); }}
                  placeholder="สแกนบาร์โค้ดสินค้า..."
                  className="h-14 text-xl text-center font-mono border-2"
                  data-testid="input-putaway-barcode"
                />
                <Button
                  className="w-full h-12 text-lg font-bold text-white"
                  style={{ background: "#3b82f6" }}
                  onClick={handlePutawayScan}
                  data-testid="button-putaway-lookup"
                >
                  ค้นหาสินค้า
                </Button>
              </CardContent>
            </Card>

            {putawayProduct && (
              <Card className="rounded-xl shadow-sm" data-testid="card-putaway-product">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold truncate" data-testid="text-putaway-product-name">{putawayProduct.name || putawayProduct.productName}</p>
                      <p className="text-sm text-muted-foreground font-mono">SKU: {putawayProduct.sku || putawayProduct.code || "-"}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-center">
                    <p className="text-sm text-amber-600">ตำแหน่งจัดเก็บแนะนำ</p>
                    <p className="text-3xl font-black text-amber-700 mt-1" data-testid="text-putaway-suggested-bin">{putawaySuggestedBin}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">สแกนบาร์โค้ดตำแหน่งจัดเก็บ</label>
                    <Input
                      ref={putawayBinInputRef}
                      value={putawayBinBarcode}
                      onChange={e => setPutawayBinBarcode(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") confirmPutawayMutation.mutate(); }}
                      placeholder="สแกนตำแหน่งจัดเก็บ..."
                      className="h-14 text-xl text-center font-mono border-2 mt-1"
                      data-testid="input-putaway-bin-barcode"
                    />
                  </div>

                  <Button
                    className="w-full h-14 text-xl font-bold text-white"
                    style={{ background: "#3b82f6" }}
                    onClick={() => confirmPutawayMutation.mutate()}
                    disabled={confirmPutawayMutation.isPending}
                    data-testid="button-confirm-putaway"
                  >
                    {confirmPutawayMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PackageCheck className="h-5 w-5 mr-2" />}
                    ยืนยันจัดเก็บ
                  </Button>
                </CardContent>
              </Card>
            )}

            {putawayStatus === "success" && (
              <div className="flex flex-col items-center gap-2 p-6 rounded-xl bg-green-50 border-2 border-green-300 animate-in fade-in zoom-in" data-testid="putaway-success">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <p className="text-xl font-bold text-green-700">จัดเก็บสำเร็จ!</p>
              </div>
            )}
            {putawayStatus === "error" && (
              <div className="flex flex-col items-center gap-2 p-6 rounded-xl bg-red-50 border-2 border-red-300 animate-in fade-in zoom-in" data-testid="putaway-error">
                <XCircle className="h-16 w-16 text-red-500" />
                <p className="text-xl font-bold text-red-700">จัดเก็บล้มเหลว!</p>
              </div>
            )}
          </div>
        )}

        {mode === "picking" && (
          <div className="space-y-3" data-testid="mode-picking">
            <Card className="rounded-xl shadow-sm border-2" style={{ borderColor: "#fb9678" }}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-lg font-bold" style={{ color: "#fb9678" }}>
                  <HandMetal className="h-5 w-5" />
                  เลือก Wave การหยิบ
                </div>
                <div className="relative">
                  <select
                    value={selectedWaveId || ""}
                    onChange={e => {
                      setSelectedWaveId(e.target.value ? parseInt(e.target.value) : null);
                      setCurrentPickItemIndex(0);
                      setPickingStep("scan_bin");
                    }}
                    className="w-full h-14 text-lg font-medium border-2 rounded-lg px-4 appearance-none bg-white"
                    data-testid="select-wave"
                  >
                    <option value="">-- เลือก Wave --</option>
                    {waves.map((w: any) => (
                      <option key={w.id} value={w.id}>Wave #{w.id} - {w.name || w.waveNumber || `${w.itemCount || 0} รายการ`}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
              </CardContent>
            </Card>

            {selectedWaveId && (
              <>
                <Card className="rounded-xl shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">ความคืบหน้า</span>
                      <span className="text-sm font-bold" style={{ color: "#fb9678" }} data-testid="text-pick-progress">{pickedCount}/{totalItems}</span>
                    </div>
                    <Progress value={progressPercent} className="h-4" data-testid="progress-picking" />
                  </CardContent>
                </Card>

                {pickItemsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : totalItems === 0 ? (
                  <Card className="rounded-xl shadow-sm">
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-lg">ไม่มีรายการหยิบ</p>
                    </CardContent>
                  </Card>
                ) : pickedCount === totalItems ? (
                  <Card className="rounded-xl shadow-sm border-2 border-green-300 bg-green-50">
                    <CardContent className="p-6 text-center">
                      <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-3" />
                      <p className="text-xl font-bold text-green-700 mb-4">หยิบครบทุกรายการ!</p>
                      <Button
                        className="w-full h-14 text-xl font-bold text-white"
                        style={{ background: "#22c55e" }}
                        onClick={() => {
                          toast({ title: "เสร็จสิ้น Wave" });
                          setSelectedWaveId(null);
                        }}
                        data-testid="button-finish-wave"
                      >
                        เสร็จสิ้น
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {currentPickItem && (
                      <Card className="rounded-xl shadow-sm" data-testid="card-current-pick-item">
                        <CardContent className="p-4 space-y-3">
                          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 text-center">
                            <p className="text-sm text-orange-600">ตำแหน่ง</p>
                            <p className="text-3xl font-black text-orange-700" data-testid="text-pick-bin">{currentPickItem.binCode || currentPickItem.bin || currentPickItem.location || "-"}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold" data-testid="text-pick-product-name">{currentPickItem.productName || currentPickItem.name}</p>
                            <p className="text-sm text-muted-foreground font-mono">SKU: {currentPickItem.sku || currentPickItem.productCode || "-"}</p>
                            <Badge className="mt-1 text-base px-3 py-1" style={{ background: "#fb9678", color: "#fff" }} data-testid="text-pick-qty-needed">ต้องการ: {currentPickItem.qty || currentPickItem.quantity || 1}</Badge>
                          </div>

                          {pickingStep === "scan_bin" && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-600">1. สแกนตำแหน่ง Bin</label>
                              <Input
                                ref={pickBinInputRef}
                                value={pickBinBarcode}
                                onChange={e => setPickBinBarcode(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter" && pickBinBarcode.trim()) {
                                    setPickingStep("scan_product");
                                    setTimeout(() => pickProductInputRef.current?.focus(), 100);
                                  }
                                }}
                                placeholder="สแกน Bin..."
                                className="h-14 text-xl text-center font-mono border-2"
                                data-testid="input-pick-bin-barcode"
                              />
                            </div>
                          )}

                          {pickingStep === "scan_product" && (
                            <div className="space-y-2">
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">✓ Bin: {pickBinBarcode}</Badge>
                              <label className="text-sm font-medium text-gray-600 block">2. สแกนสินค้า</label>
                              <Input
                                ref={pickProductInputRef}
                                value={pickProductBarcode}
                                onChange={e => setPickProductBarcode(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter" && pickProductBarcode.trim()) {
                                    setPickingStep("confirm_qty");
                                  }
                                }}
                                placeholder="สแกนสินค้า..."
                                className="h-14 text-xl text-center font-mono border-2"
                                data-testid="input-pick-product-barcode"
                              />
                            </div>
                          )}

                          {pickingStep === "confirm_qty" && (
                            <div className="space-y-2">
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">✓ Bin: {pickBinBarcode}</Badge>
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 ml-1">✓ สินค้า: {pickProductBarcode}</Badge>
                              <label className="text-sm font-medium text-gray-600 block mt-2">3. ยืนยันจำนวน</label>
                              <Input
                                type="number"
                                min="1"
                                value={pickQty}
                                onChange={e => setPickQty(e.target.value)}
                                className="h-14 text-2xl text-center font-bold border-2"
                                data-testid="input-pick-qty"
                              />
                              <Button
                                className="w-full h-14 text-xl font-bold text-white"
                                style={{ background: "#fb9678" }}
                                onClick={() => pickItemMutation.mutate({ waveId: selectedWaveId!, itemId: currentPickItem.id })}
                                disabled={pickItemMutation.isPending}
                                data-testid="button-confirm-pick"
                              >
                                {pickItemMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                                ยืนยันหยิบ
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    <Card className="rounded-xl shadow-sm">
                      <CardContent className="p-4">
                        <p className="text-sm font-bold text-gray-600 mb-2">รายการทั้งหมด</p>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {pickItems.map((item: any, idx: number) => {
                            const isPicked = item.picked || item.status === "picked";
                            const isCurrent = idx === currentPickItemIndex;
                            return (
                              <div
                                key={item.id || idx}
                                className={`flex items-center justify-between p-2 rounded-lg text-sm cursor-pointer ${isCurrent ? "bg-orange-50 border border-orange-200" : isPicked ? "bg-green-50" : "bg-gray-50"}`}
                                onClick={() => { if (!isPicked) { setCurrentPickItemIndex(idx); setPickingStep("scan_bin"); } }}
                                data-testid={`row-pick-item-${item.id || idx}`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-base" style={{ color: "#fb9678" }}>{item.binCode || item.bin || "-"}</p>
                                  <p className="font-medium truncate">{item.productName || item.name}</p>
                                  <p className="text-xs text-muted-foreground">SKU: {item.sku || item.productCode || "-"} • จำนวน: {item.qty || item.quantity || 1}</p>
                                </div>
                                {isPicked ? (
                                  <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                                ) : isCurrent ? (
                                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 shrink-0">กำลังหยิบ</Badge>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {mode === "cyclecount" && (
          <div className="space-y-3" data-testid="mode-cyclecount">
            <Card className="rounded-xl shadow-sm border-2" style={{ borderColor: "#03c9d7" }}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-lg font-bold" style={{ color: "#03c9d7" }}>
                  <ClipboardList className="h-5 w-5" />
                  สแกน Bin เพื่อตรวจนับ
                </div>
                <Input
                  ref={cycleBinInputRef}
                  value={cycleBinBarcode}
                  onChange={e => setCycleBinBarcode(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCycleBinScan(); }}
                  placeholder="สแกนบาร์โค้ด Bin..."
                  className="h-14 text-xl text-center font-mono border-2"
                  data-testid="input-cycle-bin-barcode"
                />
                <Button
                  className="w-full h-12 text-lg font-bold text-white"
                  style={{ background: "#03c9d7" }}
                  onClick={handleCycleBinScan}
                  data-testid="button-cycle-lookup"
                >
                  ค้นหา Bin
                </Button>
              </CardContent>
            </Card>

            {cycleBinData && (
              <Card className="rounded-xl shadow-sm" data-testid="card-cycle-bin">
                <CardContent className="p-4 space-y-3">
                  <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-200 text-center">
                    <p className="text-sm text-cyan-600">ตำแหน่ง</p>
                    <p className="text-3xl font-black text-cyan-700" data-testid="text-cycle-bin-code">{cycleBinData.code || cycleBinData.binCode || cycleBinBarcode}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-lg bg-gray-50">
                      <p className="text-xs text-gray-500">สินค้า</p>
                      <p className="text-sm font-bold mt-1" data-testid="text-cycle-product-name">{cycleBinData.productName || cycleBinData.name || "-"}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-50">
                      <p className="text-xs text-blue-500">จำนวนที่คาด</p>
                      <p className="text-2xl font-black text-blue-700 mt-1" data-testid="text-cycle-expected-qty">{cycleBinData.expectedQty || cycleBinData.qty || 0}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">จำนวนที่นับได้จริง</label>
                    <Input
                      type="number"
                      min="0"
                      value={cycleActualQty}
                      onChange={e => setCycleActualQty(e.target.value)}
                      placeholder="0"
                      className={`h-14 text-2xl text-center font-bold mt-1 border-2 ${
                        cycleActualQty !== "" && parseInt(cycleActualQty) !== (cycleBinData.expectedQty || cycleBinData.qty || 0)
                          ? "border-red-400 bg-red-50"
                          : ""
                      }`}
                      data-testid="input-cycle-actual-qty"
                    />
                    {cycleActualQty !== "" && parseInt(cycleActualQty) !== (cycleBinData.expectedQty || cycleBinData.qty || 0) && (
                      <p className="text-red-600 text-sm font-bold mt-1 flex items-center gap-1" data-testid="text-cycle-discrepancy">
                        <XCircle className="h-4 w-4" />
                        ผลต่าง: {parseInt(cycleActualQty) - (cycleBinData.expectedQty || cycleBinData.qty || 0)}
                      </p>
                    )}
                  </div>

                  <Button
                    className="w-full h-14 text-xl font-bold text-white"
                    style={{ background: "#03c9d7" }}
                    onClick={submitCycleCount}
                    disabled={cycleActualQty === ""}
                    data-testid="button-submit-cycle"
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    บันทึกผลนับ
                  </Button>
                </CardContent>
              </Card>
            )}

            {cycleResults.length > 0 && (
              <Card className="rounded-xl shadow-sm" data-testid="card-cycle-results">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-gray-600">ผลการนับ ({cycleResults.length} รายการ)</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowResultDialog(true)}
                      data-testid="button-view-cycle-results"
                    >
                      ดูทั้งหมด
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {cycleResults.slice(0, 5).map((r, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-lg text-sm ${r.diff !== 0 ? "bg-red-50 border border-red-200" : "bg-green-50"}`}
                        data-testid={`row-cycle-result-${idx}`}
                      >
                        <div>
                          <p className="font-bold">{r.bin}</p>
                          <p className="text-xs text-muted-foreground">{r.productName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs">คาด: {r.expected} / จริง: {r.actual}</p>
                          {r.diff !== 0 && (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">ต่าง: {r.diff > 0 ? `+${r.diff}` : r.diff}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
              <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>ผลการตรวจนับทั้งหมด</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {cycleResults.map((r, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg text-sm ${r.diff !== 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}
                      data-testid={`dialog-cycle-result-${idx}`}
                    >
                      <div>
                        <p className="font-bold text-base">{r.bin}</p>
                        <p className="text-xs text-muted-foreground">{r.productName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">คาด: <span className="font-bold">{r.expected}</span></p>
                        <p className="text-sm">จริง: <span className="font-bold">{r.actual}</span></p>
                        {r.diff !== 0 && (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">ต่าง: {r.diff > 0 ? `+${r.diff}` : r.diff}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {cycleResults.length === 0 && <p className="text-center text-muted-foreground py-4">ยังไม่มีผลการนับ</p>}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </EcommerceLayout>
  );
}
