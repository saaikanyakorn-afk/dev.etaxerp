import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Calculator,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Store,
  Search,
  Minus,
  DollarSign,
  BarChart3,
  Megaphone,
  Sparkles,
  Leaf,
  Target,
  Users,
  Zap,
  Printer,
} from "lucide-react";

const PLATFORM_LABELS: Record<string, string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  tiktok: "TikTok Shop",
  grab_food: "Grab Food",
  line_man: "LINE MAN",
  robinhood: "Robinhood",
  amazon: "Amazon",
};

const PLATFORM_COLORS: Record<string, string> = {
  shopee: "#EE4D2D",
  lazada: "#0F146D",
  tiktok: "#000000",
  grab_food: "#00B14F",
  line_man: "#00C300",
  robinhood: "#7B2FF2",
  amazon: "#FF9900",
};

interface FeePreset {
  label: string;
  platform: string;
  profileName: string;
  commissionRate: string;
  serviceFeeRate: string;
  paymentFeeRate: string;
  otherFeeRate: string;
  notes: string;
}

const FEE_PRESETS_2026: FeePreset[] = [
  { label: "Shopee Non-Mall — มือถือ/แท็บเล็ต", platform: "shopee", profileName: "Shopee Non-Mall มือถือ", commissionRate: "5.89", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 | Commission 5.89% | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },
  { label: "Shopee Non-Mall — เครื่องใช้ไฟฟ้า", platform: "shopee", profileName: "Shopee Non-Mall เครื่องใช้ไฟฟ้า", commissionRate: "8.56", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 | Commission 8.56-11.24% (ใช้ค่าต่ำ) | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },
  { label: "Shopee Non-Mall — แฟชั่น/เสื้อผ้า", platform: "shopee", profileName: "Shopee Non-Mall แฟชั่น", commissionRate: "11.77", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 | Commission 11.77% (สูงสุด Non-Mall) | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },
  { label: "Shopee Non-Mall — สุขภาพ/ความงาม", platform: "shopee", profileName: "Shopee Non-Mall สุขภาพ", commissionRate: "11.77", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 | Commission 11.77% | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },
  { label: "Shopee Non-Mall — ของใช้ในบ้าน", platform: "shopee", profileName: "Shopee Non-Mall ของใช้ในบ้าน", commissionRate: "11.77", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 | Commission 11.77% | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },
  { label: "Shopee Mall — มือถือ/แท็บเล็ต", platform: "shopee", profileName: "Shopee Mall มือถือ", commissionRate: "5.89", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 Mall | Commission 5.89% (ต่ำสุด Mall) | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },
  { label: "Shopee Mall — แฟชั่น/เสื้อผ้า", platform: "shopee", profileName: "Shopee Mall แฟชั่น", commissionRate: "15.52", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 Mall | Commission 15.52% (สูงสุด Mall) | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },

  { label: "Lazada — มือถือ/แท็บเล็ต", platform: "lazada", profileName: "Lazada มือถือ", commissionRate: "6.42", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 | Commission 6.42% | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },
  { label: "Lazada — เครื่องใช้ไฟฟ้า", platform: "lazada", profileName: "Lazada เครื่องใช้ไฟฟ้า", commissionRate: "8.56", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 | Commission 8.56-10.70% (ใช้ค่าต่ำ) | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },
  { label: "Lazada — แฟชั่น/เสื้อผ้า", platform: "lazada", profileName: "Lazada แฟชั่น", commissionRate: "13.00", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 | Commission 13.00% | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },
  { label: "Lazada — สุขภาพ/ความงาม", platform: "lazada", profileName: "Lazada สุขภาพ", commissionRate: "11.77", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 | Commission 11.77% | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },
  { label: "Lazada — ของใช้ในบ้าน", platform: "lazada", profileName: "Lazada ของใช้ในบ้าน", commissionRate: "10.70", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.35", notes: "อัตรา 2026 | Commission 10.70% | ชำระเงิน 3.21% | ส่งฟรีพิเศษ 5.35%" },

  { label: "TikTok Shop — มือถือ/แท็บเล็ต", platform: "tiktok", profileName: "TikTok มือถือ", commissionRate: "5.35", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.89", notes: "อัตรา 2026 | Commission 5.35% | ชำระเงิน 3.21% | Commerce Growth Fee 5.89%" },
  { label: "TikTok Shop — เครื่องใช้ไฟฟ้า", platform: "tiktok", profileName: "TikTok เครื่องใช้ไฟฟ้า", commissionRate: "8.56", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.89", notes: "อัตรา 2026 | Commission 8.56% | ชำระเงิน 3.21% | Commerce Growth Fee 5.89%" },
  { label: "TikTok Shop — แฟชั่น/เสื้อผ้า", platform: "tiktok", profileName: "TikTok แฟชั่น", commissionRate: "10.70", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "6.96", notes: "อัตรา 2026 | Commission 10.70% | ชำระเงิน 3.21% | Commerce Growth Fee 6.96% (สูงสุด)" },
  { label: "TikTok Shop — สุขภาพ/ความงาม", platform: "tiktok", profileName: "TikTok สุขภาพ", commissionRate: "8.56", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.89", notes: "อัตรา 2026 | Commission 8.56% | ชำระเงิน 3.21% | Commerce Growth Fee 5.89%" },
  { label: "TikTok Shop — ของใช้ในบ้าน", platform: "tiktok", profileName: "TikTok ของใช้ในบ้าน", commissionRate: "8.56", serviceFeeRate: "0", paymentFeeRate: "3.21", otherFeeRate: "5.89", notes: "อัตรา 2026 | Commission 8.56% | ชำระเงิน 3.21% | Commerce Growth Fee 5.89%" },
];

function formatNumber(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface FeeConfig {
  id: number;
  companyId: number;
  connectionId: number | null;
  platform: string;
  profileName: string;
  commissionRate: string;
  serviceFeeRate: string;
  paymentFeeRate: string;
  otherFeeRate: string;
  shippingFeePerOrder: string;
  vatOnFees: boolean;
  notes: string | null;
  active: boolean;
}

function FeeConfigForm({
  config,
  onSave,
  onClose,
}: {
  config?: FeeConfig;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    platform: config?.platform || "shopee",
    profileName: config?.profileName || "",
    commissionRate: config?.commissionRate || "0",
    serviceFeeRate: config?.serviceFeeRate || "0",
    paymentFeeRate: config?.paymentFeeRate || "0",
    otherFeeRate: config?.otherFeeRate || "0",
    shippingFeePerOrder: config?.shippingFeePerOrder || "0",
    vatOnFees: config?.vatOnFees ?? true,
    notes: config?.notes || "",
  });

  const totalRate =
    (Number(form.commissionRate) || 0) +
    (Number(form.serviceFeeRate) || 0) +
    (Number(form.paymentFeeRate) || 0) +
    (Number(form.otherFeeRate) || 0);

  const handleSubmit = () => {
    if (!form.profileName.trim()) return;
    onSave(form);
  };

  const applyPreset = (preset: FeePreset) => {
    setForm({
      ...form,
      platform: preset.platform,
      profileName: preset.profileName,
      commissionRate: preset.commissionRate,
      serviceFeeRate: preset.serviceFeeRate,
      paymentFeeRate: preset.paymentFeeRate,
      otherFeeRate: preset.otherFeeRate,
      notes: preset.notes,
    });
  };

  const platformPresets = FEE_PRESETS_2026.filter(p => p.platform === form.platform);

  return (
    <div className="space-y-3">
      {!config && (
        <div className="p-3 rounded-lg border-2 border-dashed" style={{ borderColor: "#fb9678", backgroundColor: "#fff8f5" }}>
          <Label className="text-xs font-semibold" style={{ color: "#fb9678" }}>
            โปรไฟล์สำเร็จรูป 2026 (Priceza)
          </Label>
          <p className="text-[11px] text-gray-500 mb-1.5">เลือกแพลตฟอร์มแล้วกดหมวดสินค้า — ค่าธรรมเนียมจะกรอกให้อัตโนมัติ</p>
          <div className="flex gap-2 mb-2">
            {["shopee", "lazada", "tiktok"].map(p => (
              <button
                key={p}
                data-testid={`preset-platform-${p}`}
                className="px-3 py-1 rounded-full text-xs font-bold text-white transition-all"
                style={{
                  backgroundColor: form.platform === p ? PLATFORM_COLORS[p] : "#d1d5db",
                  opacity: form.platform === p ? 1 : 0.6,
                }}
                onClick={() => setForm({ ...form, platform: p })}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {platformPresets.map((preset, idx) => {
              const shortLabel = preset.label.split("— ")[1] || preset.label;
              const rate = (Number(preset.commissionRate) + Number(preset.paymentFeeRate) + Number(preset.otherFeeRate)).toFixed(2);
              return (
                <button
                  key={idx}
                  data-testid={`preset-btn-${idx}`}
                  className="px-2.5 py-1.5 rounded-md text-xs border hover:shadow-md transition-all"
                  style={{ borderColor: PLATFORM_COLORS[preset.platform] + "40" }}
                  onClick={() => applyPreset(preset)}
                >
                  <span className="font-medium">{shortLabel}</span>
                  <span className="ml-1 opacity-60">({rate}%)</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">แพลตฟอร์ม</Label>
          <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
            <SelectTrigger data-testid="select-platform" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">ชื่อโปรไฟล์</Label>
          <Input
            data-testid="input-profile-name"
            placeholder="เช่น Shopee ทั่วไป, Lazada LazMall"
            value={form.profileName}
            onChange={(e) => setForm({ ...form, profileName: e.target.value })}
            className="h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">Commission (%)</Label>
          <Input
            data-testid="input-commission-rate"
            type="number"
            step="0.001"
            value={form.commissionRate}
            onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Service Fee (%)</Label>
          <Input
            data-testid="input-service-fee-rate"
            type="number"
            step="0.001"
            value={form.serviceFeeRate}
            onChange={(e) => setForm({ ...form, serviceFeeRate: e.target.value })}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Payment Fee (%)</Label>
          <Input
            data-testid="input-payment-fee-rate"
            type="number"
            step="0.001"
            value={form.paymentFeeRate}
            onChange={(e) => setForm({ ...form, paymentFeeRate: e.target.value })}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">อื่นๆ (%)</Label>
          <Input
            data-testid="input-other-fee-rate"
            type="number"
            step="0.001"
            value={form.otherFeeRate}
            onChange={(e) => setForm({ ...form, otherFeeRate: e.target.value })}
            className="h-9"
          />
        </div>
      </div>

      <div className="p-2 rounded-lg bg-slate-50 border text-center">
        <span className="text-xs font-medium">รวมค่าธรรมเนียม: </span>
        <span className="text-base font-bold" style={{ color: "#fb9678" }}>
          {totalRate.toFixed(3)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">ค่าส่งต่อออเดอร์ (บาท)</Label>
          <Input
            data-testid="input-shipping-fee"
            type="number"
            step="0.01"
            value={form.shippingFeePerOrder}
            onChange={(e) => setForm({ ...form, shippingFeePerOrder: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="flex items-center gap-3 pt-5">
          <Switch
            data-testid="switch-vat-on-fees"
            checked={form.vatOnFees}
            onCheckedChange={(c) => setForm({ ...form, vatOnFees: c })}
          />
          <Label className="text-xs">คิด VAT 7% บนค่าธรรมเนียม</Label>
        </div>
      </div>

      <div>
        <Label className="text-xs">หมายเหตุ</Label>
        <Textarea
          data-testid="input-notes"
          placeholder="บันทึกเพิ่มเติม..."
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel">ยกเลิก</Button>
        <Button
          onClick={handleSubmit}
          disabled={!form.profileName.trim()}
          data-testid="button-save-config"
          style={{ backgroundColor: "#fb9678" }}
        >
          {config ? "บันทึก" : "เพิ่มโปรไฟล์"}
        </Button>
      </div>
    </div>
  );
}

interface PlatformFeeTemplate {
  platform: string;
  label: string;
  fees: { key: string; label: string; rate: number; color: string }[];
  campaigns: { key: string; label: string; rate: number; color: string; badgeColor: string }[];
  mallCombo?: { label: string; rate: number };
}

const PLATFORM_FEE_TEMPLATES: PlatformFeeTemplate[] = [
  {
    platform: "tiktok",
    label: "TikTok Shop",
    fees: [
      { key: "commission", label: "ค่าคอมมิชชั่น", rate: 10.70, color: "#f94d4d" },
      { key: "growthFee", label: "ค่าธรรมเนียมการเติบโต", rate: 6.96, color: "#fb9678" },
      { key: "orderFee", label: "ค่าธรรมเนียมคำสั่งซื้อ", rate: 3.21, color: "#fb9678" },
      { key: "infraFee", label: "ค่าธรรมเนียมโครงสร้างพื้นฐาน", rate: 0.27, color: "#888" },
      { key: "vat", label: "VAT 7% (คิดจากราคาขาย)", rate: 0, color: "#539BFF" },
    ],
    campaigns: [
      { key: "bcd", label: "Brand Crazy Deals", rate: 3.21, color: "#f94d4d", badgeColor: "#f94d4d" },
      { key: "liveSpecial", label: "Live Special", rate: 4.28, color: "#05b187", badgeColor: "#05b187" },
      { key: "preOrder", label: "Pre-Order", rate: 2.14, color: "#539BFF", badgeColor: "#539BFF" },
    ],
    mallCombo: { label: "ส่วนลด Mall Combo", rate: 3.21 },
  },
  {
    platform: "shopee",
    label: "Shopee",
    fees: [
      { key: "commission", label: "ค่าคอมมิชชั่น", rate: 11.77, color: "#EE4D2D" },
      { key: "serviceFee", label: "ค่าบริการ", rate: 3.21, color: "#fb9678" },
      { key: "paymentFee", label: "ค่าธรรมเนียมชำระเงิน", rate: 3.21, color: "#fb9678" },
      { key: "freeShipping", label: "ส่งฟรีพิเศษ", rate: 5.35, color: "#05b187" },
      { key: "vat", label: "VAT 7% (คิดจากราคาขาย)", rate: 0, color: "#539BFF" },
    ],
    campaigns: [
      { key: "brandDay", label: "Super Brand Day", rate: 4.00, color: "#EE4D2D", badgeColor: "#EE4D2D" },
      { key: "payday", label: "Payday Sale", rate: 3.00, color: "#fec90f", badgeColor: "#d4a800" },
      { key: "flashSale", label: "Flash Sale", rate: 5.00, color: "#f94d4d", badgeColor: "#f94d4d" },
    ],
    mallCombo: { label: "ส่วนลด Shopee Mall", rate: 3.00 },
  },
  {
    platform: "lazada",
    label: "Lazada",
    fees: [
      { key: "commission", label: "ค่าคอมมิชชั่น", rate: 13.00, color: "#0F146D" },
      { key: "paymentFee", label: "ค่าธรรมเนียมชำระเงิน", rate: 3.21, color: "#fb9678" },
      { key: "freeShipping", label: "ส่งฟรีพิเศษ", rate: 5.35, color: "#05b187" },
      { key: "vat", label: "VAT 7% (คิดจากราคาขาย)", rate: 0, color: "#539BFF" },
    ],
    campaigns: [
      { key: "megaSale", label: "Mega Sale", rate: 4.00, color: "#0F146D", badgeColor: "#0F146D" },
      { key: "brandMega", label: "Brand Mega Offer", rate: 3.50, color: "#fec90f", badgeColor: "#d4a800" },
      { key: "surprise", label: "Surprise Sale", rate: 3.00, color: "#f94d4d", badgeColor: "#f94d4d" },
    ],
    mallCombo: { label: "ส่วนลด LazMall", rate: 2.50 },
  },
];

function ProfitCalculatorTab({ feeConfigs = [] }: { feeConfigs?: FeeConfig[] }) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const [selectedPlatform, setSelectedPlatform] = useState("tiktok");
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [sellingPrice, setSellingPrice] = useState("390");
  const [costPrice, setCostPrice] = useState("100");
  const [shippingCost, setShippingCost] = useState("40");
  const [packagingCost, setPackagingCost] = useState("10");
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data: productsData } = useQuery<any[]>({
    queryKey: ["/api/products", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/products?companyId=${companyId}&pageSize=200`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId,
  });

  const productList = Array.isArray(productsData) ? productsData : (productsData as any)?.data || [];

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return productList.slice(0, 20);
    const term = productSearch.toLowerCase();
    return productList.filter((p: any) =>
      p.name?.toLowerCase().includes(term) || p.code?.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [productList, productSearch]);

  const selectProduct = (product: any) => {
    setSelectedProduct(product);
    setSellingPrice(String(Number(product.price) || 0));
    setCostPrice(String(Number(product.cost) || 0));
    setProductSearch("");
    setShowProductDropdown(false);
  };
  const [roi, setRoi] = useState(7.5);
  const [activeCampaigns, setActiveCampaigns] = useState<string[]>([]);
  const [includeMallCombo, setIncludeMallCombo] = useState(false);
  const [includeVat, setIncludeVat] = useState(true);
  const [customFees, setCustomFees] = useState<Record<string, number>>({});

  const platformConfigs = feeConfigs.filter(c => c.active && c.platform === selectedPlatform);

  const applyFeeConfig = (config: FeeConfig) => {
    setSelectedConfigId(config.id);
    const fees: Record<string, number> = {};
    if (Number(config.commissionRate) > 0) fees["commission"] = Number(config.commissionRate);
    if (Number(config.serviceFeeRate) > 0) {
      const template = PLATFORM_FEE_TEMPLATES.find(t => t.platform === config.platform);
      const svcKey = template?.fees.find(f => f.key === "serviceFee" || f.key === "growthFee")?.key;
      if (svcKey) fees[svcKey] = Number(config.serviceFeeRate);
    }
    if (Number(config.paymentFeeRate) > 0) {
      const template = PLATFORM_FEE_TEMPLATES.find(t => t.platform === config.platform);
      const payKey = template?.fees.find(f => f.key === "paymentFee" || f.key === "orderFee")?.key;
      if (payKey) fees[payKey] = Number(config.paymentFeeRate);
    }
    if (Number(config.otherFeeRate) > 0) {
      const template = PLATFORM_FEE_TEMPLATES.find(t => t.platform === config.platform);
      const otherKey = template?.fees.find(f => !["commission", "vat"].includes(f.key) && !fees[f.key])?.key;
      if (otherKey && !fees[otherKey]) fees[otherKey] = Number(config.otherFeeRate);
    }
    if (Number(config.shippingFeePerOrder) > 0) {
      setShippingCost(config.shippingFeePerOrder);
    }
    setCustomFees(fees);
  };

  const template = PLATFORM_FEE_TEMPLATES.find(t => t.platform === selectedPlatform)!;
  const price = Number(sellingPrice) || 0;
  const cost = Number(costPrice) || 0;
  const shipping = Number(shippingCost) || 0;
  const packaging = Number(packagingCost) || 0;

  const calc = useMemo(() => {
    if (price <= 0) return null;

    const feeBreakdown: { label: string; amount: number; rate: number; color: string }[] = [];
    let totalFeeRate = 0;

    template.fees.forEach(fee => {
      if (fee.key === "vat") {
        if (includeVat) {
          const vatAmount = Math.round(price * 7 / 107 * 100) / 100;
          feeBreakdown.push({ label: fee.label, amount: vatAmount, rate: 0, color: fee.color });
        }
        return;
      }
      const rate = customFees[fee.key] ?? fee.rate;
      const amount = Math.round(price * rate / 100 * 100) / 100;
      totalFeeRate += rate;
      feeBreakdown.push({ label: `${fee.label} (${rate.toFixed(2)}%)`, amount, rate, color: fee.color });
    });

    const campaignBreakdown: { label: string; amount: number; rate: number; color: string }[] = [];
    let campaignTotal = 0;
    activeCampaigns.forEach(key => {
      const camp = template.campaigns.find(c => c.key === key);
      if (camp) {
        const amount = Math.round(price * camp.rate / 100 * 100) / 100;
        campaignTotal += amount;
        campaignBreakdown.push({ label: `${camp.label} (${camp.rate}%)`, amount, rate: camp.rate, color: camp.color });
      }
    });

    const totalPlatformFees = feeBreakdown.reduce((s, f) => s + f.amount, 0) + campaignTotal;
    const adCost = roi > 0 ? Math.round(price / roi * 100) / 100 : 0;
    const mallComboAmount = includeMallCombo && template.mallCombo
      ? Math.round(price * template.mallCombo.rate / 100 * 100) / 100
      : 0;

    const totalCost = cost + shipping + packaging;
    const baseProfit = price - totalCost - totalPlatformFees + mallComboAmount;
    const affiliateRate = template.platform === "tiktok" ? 10 : 8;
    const affiliateAmount = Math.round(price * affiliateRate / 100 * 100) / 100;

    const r = (v: number) => Math.round(v * 100) / 100;

    const organicClip = r(baseProfit);
    const organicLive = r(baseProfit);
    const adsClip = r(baseProfit - adCost);
    const adsLive = r(baseProfit - adCost);
    const affiliateOrgClip = r(baseProfit - affiliateAmount);
    const affiliateOrgLive = r(baseProfit - affiliateAmount);
    const affiliateAdsClip = r(baseProfit - affiliateAmount - adCost);

    return {
      feeBreakdown,
      campaignBreakdown,
      campaignTotal,
      totalPlatformFees,
      adCost,
      mallComboAmount,
      totalCost,
      organicClip,
      organicLive,
      adsClip,
      adsLive,
      affiliateOrgClip,
      affiliateOrgLive,
      affiliateAdsClip,
      affiliateRate,
      affiliateAmount,
    };
  }, [price, cost, shipping, packaging, roi, activeCampaigns, includeMallCombo, includeVat, customFees, template]);

  const toggleCampaign = (key: string) => {
    setActiveCampaigns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" style={{ color: "#fb9678" }} />
                ข้อมูลสินค้า
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Label className="text-xs">เลือกสินค้า</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    data-testid="profit-product-search"
                    placeholder={selectedProduct ? selectedProduct.name : "ค้นหาสินค้า..."}
                    value={productSearch}
                    onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                    onFocus={() => setShowProductDropdown(true)}
                    className="pl-8 h-9"
                  />
                  {selectedProduct && (
                    <button
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                      onClick={() => {
                        setSelectedProduct(null);
                        setSellingPrice("0");
                        setCostPrice("0");
                        setProductSearch("");
                      }}
                      data-testid="profit-clear-product"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.map((p: any) => (
                      <button
                        key={p.id}
                        data-testid={`profit-product-${p.id}`}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between border-b last:border-b-0"
                        onClick={() => selectProduct(p)}
                      >
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-gray-400">{p.code}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold" style={{ color: "#fb9678" }}>฿{formatNumber(Number(p.price) || 0)}</div>
                          <div className="text-xs text-gray-400">ทุน ฿{formatNumber(Number(p.cost) || 0)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedProduct && (
                  <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs font-medium text-blue-700">{selectedProduct.name}</span>
                        <span className="text-[10px] text-blue-400 ml-2">{selectedProduct.code}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: "#539BFF", color: "#539BFF" }}>
                        {selectedProduct.category || "สินค้า"}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs">แพลตฟอร์ม</Label>
                <div className="flex gap-2 mt-1">
                  {PLATFORM_FEE_TEMPLATES.map(t => (
                    <button
                      key={t.platform}
                      data-testid={`profit-platform-${t.platform}`}
                      className="px-3 py-1.5 rounded-full text-xs font-bold text-white transition-all"
                      style={{
                        backgroundColor: selectedPlatform === t.platform ? PLATFORM_COLORS[t.platform] : "#d1d5db",
                        opacity: selectedPlatform === t.platform ? 1 : 0.6,
                      }}
                      onClick={() => {
                        setSelectedPlatform(t.platform);
                        setSelectedConfigId(null);
                        setActiveCampaigns([]);
                        setCustomFees({});
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {platformConfigs.length > 0 && (
                <div className="p-2.5 rounded-lg border-2 border-dashed" style={{ borderColor: "#03c9d7", backgroundColor: "#f0fdfa" }}>
                  <Label className="text-xs font-semibold" style={{ color: "#03c9d7" }}>
                    โปรไฟล์ที่บันทึกไว้
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {platformConfigs.map(config => {
                      const totalRate = (Number(config.commissionRate) || 0) + (Number(config.serviceFeeRate) || 0) + (Number(config.paymentFeeRate) || 0) + (Number(config.otherFeeRate) || 0);
                      return (
                        <button
                          key={config.id}
                          data-testid={`profit-config-${config.id}`}
                          className={`px-2.5 py-1.5 rounded-md text-xs border transition-all ${
                            selectedConfigId === config.id ? "text-white font-bold" : "bg-white hover:shadow-md"
                          }`}
                          style={{
                            borderColor: selectedConfigId === config.id ? "#03c9d7" : "#03c9d740",
                            backgroundColor: selectedConfigId === config.id ? "#03c9d7" : "white",
                          }}
                          onClick={() => applyFeeConfig(config)}
                        >
                          {config.profileName}
                          <span className="ml-1 opacity-70">({totalRate.toFixed(1)}%)</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">กดเลือก → อัตราค่าธรรมเนียมจะเติมให้อัตโนมัติ</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">ราคาขาย (฿)</Label>
                  <Input
                    data-testid="profit-selling-price"
                    type="number"
                    value={sellingPrice}
                    onChange={e => setSellingPrice(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">ต้นทุนสินค้า (฿)</Label>
                  <Input
                    data-testid="profit-cost-price"
                    type="number"
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">ค่าส่ง (฿)</Label>
                  <Input
                    data-testid="profit-shipping-cost"
                    type="number"
                    value={shippingCost}
                    onChange={e => setShippingCost(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">ค่าแพ็ค (฿)</Label>
                  <Input
                    data-testid="profit-packaging-cost"
                    type="number"
                    value={packagingCost}
                    onChange={e => setPackagingCost(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  data-testid="profit-include-vat"
                  checked={includeVat}
                  onCheckedChange={setIncludeVat}
                />
                <Label className="text-xs">รวม VAT 7% (ภายในราคาขาย)</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: "#fec90f" }} />
                แคมเปญพิเศษ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {template.campaigns.map(camp => (
                  <button
                    key={camp.key}
                    data-testid={`profit-campaign-${camp.key}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                      activeCampaigns.includes(camp.key) ? "text-white" : "bg-white"
                    }`}
                    style={{
                      borderColor: camp.badgeColor,
                      backgroundColor: activeCampaigns.includes(camp.key) ? camp.badgeColor : "white",
                      color: activeCampaigns.includes(camp.key) ? "white" : camp.badgeColor,
                    }}
                    onClick={() => toggleCampaign(camp.key)}
                  >
                    {camp.label}
                  </button>
                ))}
              </div>
              {template.mallCombo && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Switch
                    data-testid="profit-mall-combo"
                    checked={includeMallCombo}
                    onCheckedChange={setIncludeMallCombo}
                  />
                  <Label className="text-xs">
                    {template.mallCombo.label} ({template.mallCombo.rate}%)
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-red-500" />
                ค่าโฆษณา (จำลองจาก ROI)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <button
                  data-testid="profit-roi-minus"
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: "#f94d4d", color: "#f94d4d" }}
                  onClick={() => setRoi(prev => Math.max(0.5, prev - 0.5))}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex-1 text-center">
                  <div className="text-xs text-gray-500 mb-1">ROI</div>
                  <div className="text-2xl font-bold">{roi.toFixed(1)}</div>
                </div>
                <button
                  data-testid="profit-roi-plus"
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: "#05b187", color: "#05b187" }}
                  onClick={() => setRoi(prev => prev + 0.5)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {calc && (
                <div className="mt-2 p-2 rounded-lg bg-red-50 text-center">
                  <span className="text-xs text-gray-500">ค่าโฆษณา/ออเดอร์: </span>
                  <span className="text-sm font-bold text-red-500">- ฿{formatNumber(calc.adCost)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {calc ? (
            <>
              <div className="flex justify-end print:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="profit-print-btn"
                  onClick={() => {
                    const printArea = document.getElementById("profit-print-area");
                    if (!printArea) return;
                    const win = window.open("", "_blank");
                    if (!win) return;
                    const platformLabel = template.label;
                    const productName = selectedProduct?.name || "สินค้าทั่วไป";
                    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>คำนวณกำไร - ${productName}</title>
<style>
body{font-family:'Sarabun','Segoe UI',sans-serif;padding:24px;color:#333;font-size:13px}
h2{margin:0 0 4px;font-size:18px;color:#fb9678}
.subtitle{color:#888;font-size:12px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:12px}
th{background:#f8f9fa;font-weight:600}
td.right{text-align:right}
td.center{text-align:center}
.section{margin:16px 0 8px;font-weight:700;font-size:14px;color:#333;border-bottom:2px solid #03c9d7;padding-bottom:4px}
.fee-row{display:flex;justify-content:space-between;padding:3px 0}
.fee-label{color:#555}
.fee-amount{font-weight:600}
.neg{color:#f94d4d}
.pos{color:#05b187}
.summary-box{display:inline-block;border:2px solid #e5e7eb;border-radius:8px;padding:12px 24px;text-align:center;margin:8px 16px 8px 0}
.summary-box .val{font-size:22px;font-weight:700}
.summary-box .lbl{font-size:11px;color:#888}
.footer{margin-top:20px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:8px}
@media print{body{padding:12px}@page{margin:15mm}}
</style></head><body>`);
                    win.document.write(`<h2>คำนวณกำไร — ${platformLabel}</h2>`);
                    win.document.write(`<div class="subtitle">${productName} | ราคาขาย ฿${formatNumber(price)} | ต้นทุน ฿${formatNumber(cost)} | ค่าส่ง ฿${formatNumber(shipping)} | ค่าแพ็ค ฿${formatNumber(packaging)}</div>`);
                    win.document.write(`<div class="section">แจกแจงค่าใช้จ่าย</div>`);
                    calc.feeBreakdown.forEach(f => {
                      win.document.write(`<div class="fee-row"><span class="fee-label">${f.label}</span><span class="fee-amount neg">- ฿${formatNumber(f.amount)}</span></div>`);
                    });
                    if (calc.campaignBreakdown.length > 0) {
                      win.document.write(`<div style="margin-top:8px;font-size:11px;color:#888;font-weight:600">แคมเปญพิเศษ</div>`);
                      calc.campaignBreakdown.forEach(c => {
                        win.document.write(`<div class="fee-row"><span class="fee-label">${c.label}</span><span class="fee-amount neg">- ฿${formatNumber(c.amount)}</span></div>`);
                      });
                    }
                    win.document.write(`<div class="fee-row" style="border-top:1px solid #ddd;padding-top:6px;margin-top:6px"><span class="fee-label" style="font-weight:700">ค่าโฆษณา (ROI ${roi.toFixed(1)})</span><span class="fee-amount neg">- ฿${formatNumber(calc.adCost)}</span></div>`);
                    if (calc.mallComboAmount > 0) {
                      win.document.write(`<div class="fee-row"><span class="fee-label" style="color:#05b187">✨ ${template.mallCombo?.label} (${template.mallCombo?.rate}%)</span><span class="fee-amount pos">+ ฿${formatNumber(calc.mallComboAmount)}</span></div>`);
                    }
                    win.document.write(`<div class="section">กำไรสุทธิ</div>`);
                    win.document.write(`<div class="summary-box"><div class="val" style="color:${calc.organicClip >= 0 ? '#05b187' : '#f94d4d'}">฿${formatNumber(calc.organicClip)}</div><div class="lbl">คลิป/การ์ด (ออแกนิค)</div></div>`);
                    win.document.write(`<div class="summary-box"><div class="val" style="color:${calc.adsLive >= 0 ? '#05b187' : '#f94d4d'}">฿${formatNumber(calc.adsLive)}</div><div class="lbl">Live (ยิงแอด)</div></div>`);
                    win.document.write(`<div class="section">ตารางสรุปกำไรทั้ง 4 รูปแบบ (บาท/ออเดอร์)</div>`);
                    win.document.write(`<table><thead><tr><th>รูปแบบการขาย</th><th style="text-align:center">กำไรจากคลิป/การ์ด</th><th style="text-align:center">กำไรจาก Live</th></tr></thead><tbody>`);
                    const rows = [
                      { label: "🌿 ออแกนิค (ตัวเอง)", clip: calc.organicClip, live: calc.organicLive },
                      { label: "🎯 ยิงแอด (ตัวเอง)", clip: calc.adsClip, live: calc.adsLive },
                      { label: "👥 นายหน้า (ออแกนิค)", clip: calc.affiliateOrgClip, live: calc.affiliateOrgLive },
                      { label: "⚡ นายหน้า (ยิงแอดให้)", clip: calc.affiliateAdsClip, live: null as number | null },
                    ];
                    rows.forEach(r => {
                      const clipColor = r.clip >= 0 ? "#05b187" : "#f94d4d";
                      const liveStr = r.live !== null ? `<span style="color:${r.live >= 0 ? '#05b187' : '#f94d4d'};font-weight:700">฿${formatNumber(r.live)}</span>` : "-";
                      win.document.write(`<tr><td>${r.label}</td><td class="center"><span style="color:${clipColor};font-weight:700">฿${formatNumber(r.clip)}</span></td><td class="center">${liveStr}</td></tr>`);
                    });
                    win.document.write(`</tbody></table>`);
                    win.document.write(`<div class="footer">* นายหน้า = หัก Affiliate ${calc.affiliateRate}% (฿${formatNumber(calc.affiliateAmount)}/ออเดอร์) | พิมพ์จาก E-Tax Center — ${new Date().toLocaleDateString("th-TH")} ${new Date().toLocaleTimeString("th-TH")}</div>`);
                    win.document.write(`</body></html>`);
                    win.document.close();
                    setTimeout(() => win.print(), 300);
                  }}
                  className="gap-1"
                >
                  <Printer className="h-4 w-4" />
                  พิมพ์ผลคำนวณ
                </Button>
              </div>
              <div id="profit-print-area">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" style={{ color: "#03c9d7" }} />
                    แจกแจงค่าใช้จ่าย (อิงรูปแบบที่เลือก)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
                    {calc.feeBreakdown.map((fee, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1">
                        <span className="text-sm text-gray-700">{fee.label}</span>
                        <span className="text-sm font-medium" style={{ color: fee.color }}>
                          - ฿{formatNumber(fee.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {calc.campaignBreakdown.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed">
                      <div className="text-xs font-semibold text-gray-500 mb-1.5">แคมเปญพิเศษ</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
                        {calc.campaignBreakdown.map((camp, idx) => (
                          <div key={idx} className="flex justify-between items-center py-1">
                            <span className="text-sm text-gray-700">{camp.label}</span>
                            <span className="text-sm font-medium" style={{ color: camp.color }}>
                              - ฿{formatNumber(camp.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">ค่าโฆษณา (จำลองจาก ROI {roi.toFixed(1)})</span>
                    <span className="text-sm font-bold text-red-500">- ฿{formatNumber(calc.adCost)}</span>
                  </div>

                  {calc.mallComboAmount > 0 && (
                    <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: "#f0fdf4" }}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-green-500" />
                          {template.mallCombo?.label} ({template.mallCombo?.rate}%)
                        </span>
                        <span className="text-sm font-bold text-green-600">+ ฿{formatNumber(calc.mallComboAmount)}</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t-2 flex justify-between items-center" style={{ borderColor: "#03c9d7" }}>
                    <span className="font-bold" style={{ color: "#03c9d7" }}>รวม</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-red-500">
                        - ฿{formatNumber(calc.totalPlatformFees + calc.adCost - calc.mallComboAmount)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-2" style={{ borderColor: "#05b18740" }}>
                  <CardContent className="py-6 text-center">
                    <div className="text-sm text-gray-500 mb-1">กำไรสุทธิ คลิป/การ์ด</div>
                    <div className="text-3xl font-bold" style={{ color: calc.organicClip >= 0 ? "#05b187" : "#f94d4d" }} data-testid="profit-clip-card">
                      ฿{formatNumber(calc.organicClip)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">ออแกนิค ไม่รวมค่าโฆษณา</div>
                  </CardContent>
                </Card>
                <Card className="border-2" style={{ borderColor: "#fb967840" }}>
                  <CardContent className="py-6 text-center">
                    <div className="text-sm text-gray-500 mb-1">กำไรสุทธิ Live (ยิงแอด)</div>
                    <div className="text-3xl font-bold" style={{ color: calc.adsLive >= 0 ? "#05b187" : "#f94d4d" }} data-testid="profit-live">
                      ฿{formatNumber(calc.adsLive)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">หลังหักค่าโฆษณา (ROI {roi.toFixed(1)})</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" style={{ color: "#fb9678" }} />
                    ตารางสรุปกำไรทั้ง 4 รูปแบบ (บาท/ออเดอร์)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow style={{ backgroundColor: "#f8f9fa" }}>
                        <TableHead className="text-sm font-semibold">รูปแบบการขาย</TableHead>
                        <TableHead className="text-sm font-semibold text-center">กำไรจากคลิป/การ์ด</TableHead>
                        <TableHead className="text-sm font-semibold text-center">กำไรจาก Live</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow data-testid="row-profit-organic">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Leaf className="h-4 w-4 text-green-500" />
                            <span className="font-medium">ออแกนิค (ตัวเอง)</span>
                          </div>
                          <div className="text-[10px] text-gray-400 ml-6">ต้นทุน + ค่าธรรมเนียม</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg font-bold" style={{ color: calc.organicClip >= 0 ? "#05b187" : "#f94d4d" }}>
                            ฿{formatNumber(calc.organicClip)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg font-bold" style={{ color: calc.organicLive >= 0 ? "#05b187" : "#f94d4d" }}>
                            ฿{formatNumber(calc.organicLive)}
                          </span>
                        </TableCell>
                      </TableRow>
                      <TableRow data-testid="row-profit-ads">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-red-500" />
                            <span className="font-medium">ยิงแอด (ตัวเอง)</span>
                            <Badge variant="outline" className="text-[10px]" style={{ borderColor: "#f94d4d", color: "#f94d4d" }}>
                              หักแอดแล้ว
                            </Badge>
                          </div>
                          <div className="text-[10px] text-gray-400 ml-6">ต้นทุน + ค่าธรรมเนียม + ค่าโฆษณา</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg font-bold" style={{ color: calc.adsClip >= 0 ? "#05b187" : "#f94d4d" }}>
                            ฿{formatNumber(calc.adsClip)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg font-bold" style={{ color: calc.adsLive >= 0 ? "#05b187" : "#f94d4d" }}>
                            ฿{formatNumber(calc.adsLive)}
                          </span>
                        </TableCell>
                      </TableRow>
                      <TableRow data-testid="row-profit-affiliate-organic">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium">นายหน้า (ออแกนิค)</span>
                          </div>
                          <div className="text-[10px] text-gray-400 ml-6">ต้นทุน + ค่าธรรมเนียม + Affiliate {calc.affiliateRate}%</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg font-bold" style={{ color: calc.affiliateOrgClip >= 0 ? "#05b187" : "#f94d4d" }}>
                            ฿{formatNumber(calc.affiliateOrgClip)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg font-bold" style={{ color: calc.affiliateOrgLive >= 0 ? "#05b187" : "#f94d4d" }}>
                            ฿{formatNumber(calc.affiliateOrgLive)}
                          </span>
                        </TableCell>
                      </TableRow>
                      <TableRow data-testid="row-profit-affiliate-ads">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-purple-500" />
                            <span className="font-medium">นายหน้า (ยิงแอดให้)</span>
                            <Badge variant="outline" className="text-[10px]" style={{ borderColor: "#f94d4d", color: "#f94d4d" }}>
                              หักแอดแล้ว
                            </Badge>
                          </div>
                          <div className="text-[10px] text-gray-400 ml-6">ต้นทุน + ค่าธรรมเนียม + Affiliate + ค่าโฆษณา</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg font-bold" style={{ color: calc.affiliateAdsClip >= 0 ? "#05b187" : "#f94d4d" }}>
                            ฿{formatNumber(calc.affiliateAdsClip)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-gray-400">-</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t">
                    * นายหน้า = หักค่า Affiliate {calc.affiliateRate}% (฿{formatNumber(calc.affiliateAmount)}/ออเดอร์)
                  </div>
                </CardContent>
              </Card>

              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calculator className="h-4 w-4" style={{ color: "#539BFF" }} />
                    ปรับอัตราค่าธรรมเนียม
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {template.fees.filter(f => f.key !== "vat").map(fee => (
                      <div key={fee.key}>
                        <Label className="text-xs">{fee.label} (%)</Label>
                        <Input
                          data-testid={`profit-fee-${fee.key}`}
                          type="number"
                          step="0.01"
                          value={customFees[fee.key] ?? fee.rate}
                          onChange={e => setCustomFees(prev => ({ ...prev, [fee.key]: Number(e.target.value) }))}
                          className="h-9"
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    data-testid="profit-reset-fees"
                    onClick={() => setCustomFees({})}
                  >
                    รีเซ็ตค่าเริ่มต้น
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-gray-400">
                <Calculator className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-sm">กรอกราคาขายเพื่อเริ่มคำนวณกำไร</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PriceCalculator() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("calculator");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<FeeConfig | undefined>();
  const [selectedConfigs, setSelectedConfigs] = useState<number[]>([]);
  const [profitType, setProfitType] = useState<"fixed" | "percentage">("percentage");
  const [desiredProfit, setDesiredProfit] = useState("30");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: feeConfigs = [] } = useQuery<FeeConfig[]>({
    queryKey: ["/api/ecommerce/fee-configs", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/fee-configs?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: bulkResult, isFetching: calculating } = useQuery({
    queryKey: ["price-calc-bulk", companyId, selectedConfigs, profitType, desiredProfit],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/ecommerce/calculate-price-bulk", {
        companyId,
        feeConfigIds: selectedConfigs,
        profitType,
        desiredProfit: Number(desiredProfit),
      });
      return res.json();
    },
    enabled: !!companyId && selectedConfigs.length > 0 && Number(desiredProfit) > 0,
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ecommerce/fee-configs", { ...data, companyId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ecommerce/fee-configs"] });
      setDialogOpen(false);
      setEditConfig(undefined);
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/ecommerce/fee-configs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ecommerce/fee-configs"] });
      setDialogOpen(false);
      setEditConfig(undefined);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ecommerce/fee-configs/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ecommerce/fee-configs"] });
    },
  });

  const activeConfigs = feeConfigs.filter((c) => c.active);

  const filteredProducts = useMemo(() => {
    if (!bulkResult?.products) return [];
    if (!searchTerm.trim()) return bulkResult.products;
    const term = searchTerm.toLowerCase();
    return bulkResult.products.filter(
      (p: any) =>
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term)
    );
  }, [bulkResult?.products, searchTerm]);

  const summary = useMemo(() => {
    if (!bulkResult?.products?.length) return null;
    let needIncrease = 0;
    let needDecrease = 0;
    let noChange = 0;
    bulkResult.products.forEach((p: any) => {
      const minRecommended = Math.min(...p.platformPrices.map((pp: any) => pp.recommendedPrice));
      if (minRecommended > p.currentPrice) needIncrease++;
      else if (minRecommended < p.currentPrice) needDecrease++;
      else noChange++;
    });
    return { needIncrease, needDecrease, noChange, total: bulkResult.products.length };
  }, [bulkResult?.products]);

  const toggleConfigSelect = (id: number) => {
    setSelectedConfigs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <EcommerceLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2" data-testid="text-page-title">
              <Calculator className="h-6 w-6" style={{ color: "#fb9678" }} />
              คำนวณราคาขาย
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              คำนวณราคาขายที่เหมาะสมตามต้นทุนและค่าธรรมเนียมแต่ละแพลตฟอร์ม
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="calculator" data-testid="tab-calculator">
              <Calculator className="h-4 w-4 mr-1" /> คำนวณราคา
            </TabsTrigger>
            <TabsTrigger value="profit" data-testid="tab-profit">
              <BarChart3 className="h-4 w-4 mr-1" /> คำนวณกำไร
            </TabsTrigger>
            <TabsTrigger value="fee-configs" data-testid="tab-fee-configs">
              <Store className="h-4 w-4 mr-1" /> ตั้งค่าธรรมเนียม
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profit">
            <ProfitCalculatorTab feeConfigs={feeConfigs} />
          </TabsContent>

          <TabsContent value="fee-configs" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                ตั้งค่าอัตราค่าธรรมเนียมของแต่ละแพลตฟอร์ม เพื่อใช้ในการคำนวณราคาขาย
              </p>
              <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditConfig(undefined); }}>
                <DialogTrigger asChild>
                  <Button
                    data-testid="button-add-fee-config"
                    style={{ backgroundColor: "#fb9678" }}
                    onClick={() => { setEditConfig(undefined); setDialogOpen(true); }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> เพิ่มโปรไฟล์ค่าธรรมเนียม
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editConfig ? "แก้ไขโปรไฟล์ค่าธรรมเนียม" : "เพิ่มโปรไฟล์ค่าธรรมเนียม"}</DialogTitle>
                  </DialogHeader>
                  <FeeConfigForm
                    config={editConfig}
                    onSave={(data) => {
                      if (editConfig) {
                        updateMut.mutate({ id: editConfig.id, data });
                      } else {
                        createMut.mutate(data);
                      }
                    }}
                    onClose={() => { setDialogOpen(false); setEditConfig(undefined); }}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {feeConfigs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-400">
                  <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">ยังไม่มีโปรไฟล์ค่าธรรมเนียม</p>
                  <p className="text-xs mt-1">เพิ่มโปรไฟล์เพื่อเริ่มคำนวณราคาขาย</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feeConfigs.map((config) => {
                  const totalRate =
                    (Number(config.commissionRate) || 0) +
                    (Number(config.serviceFeeRate) || 0) +
                    (Number(config.paymentFeeRate) || 0) +
                    (Number(config.otherFeeRate) || 0);

                  return (
                    <Card key={config.id} data-testid={`card-fee-config-${config.id}`} className="relative">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: PLATFORM_COLORS[config.platform] || "#888" }}
                            />
                            <CardTitle className="text-sm">{config.profileName}</CardTitle>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {PLATFORM_LABELS[config.platform] || config.platform}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <span className="text-gray-500">Commission:</span>
                          <span className="text-right font-medium">{config.commissionRate}%</span>
                          <span className="text-gray-500">Service Fee:</span>
                          <span className="text-right font-medium">{config.serviceFeeRate}%</span>
                          <span className="text-gray-500">Payment Fee:</span>
                          <span className="text-right font-medium">{config.paymentFeeRate}%</span>
                          {Number(config.otherFeeRate) > 0 && (
                            <>
                              <span className="text-gray-500">อื่นๆ:</span>
                              <span className="text-right font-medium">{config.otherFeeRate}%</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm font-bold" style={{ color: "#fb9678" }}>
                            รวม {totalRate.toFixed(3)}%
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              data-testid={`button-edit-config-${config.id}`}
                              onClick={() => { setEditConfig(config); setDialogOpen(true); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              data-testid={`button-delete-config-${config.id}`}
                              onClick={() => {
                                if (confirm("ลบโปรไฟล์นี้?")) deleteMut.mutate(config.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {Number(config.shippingFeePerOrder) > 0 && (
                          <div className="text-xs text-gray-500">
                            ค่าส่ง: {formatNumber(Number(config.shippingFeePerOrder))} บาท/ออเดอร์
                          </div>
                        )}
                        {config.notes && (
                          <div className="text-xs text-gray-400 italic">{config.notes}</div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calculator" className="space-y-4">
            {activeConfigs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-400">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">กรุณาตั้งค่าโปรไฟล์ค่าธรรมเนียมก่อน</p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => setActiveTab("fee-configs")}
                    data-testid="button-go-to-fee-configs"
                  >
                    ไปตั้งค่าธรรมเนียม
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-wrap gap-4 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">เลือกแพลตฟอร์ม</Label>
                        <div className="flex flex-wrap gap-2">
                          {activeConfigs.map((c) => (
                            <button
                              key={c.id}
                              data-testid={`button-toggle-config-${c.id}`}
                              onClick={() => toggleConfigSelect(c.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                selectedConfigs.includes(c.id)
                                  ? "text-white border-transparent"
                                  : "text-gray-600 bg-white hover:bg-gray-50"
                              }`}
                              style={
                                selectedConfigs.includes(c.id)
                                  ? { backgroundColor: PLATFORM_COLORS[c.platform] || "#888" }
                                  : {}
                              }
                            >
                              {c.profileName}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5 w-36">
                        <Label className="text-xs font-medium">กำไรที่ต้องการ</Label>
                        <div className="flex gap-1">
                          <Input
                            data-testid="input-desired-profit"
                            type="number"
                            value={desiredProfit}
                            onChange={(e) => setDesiredProfit(e.target.value)}
                            className="h-9"
                          />
                          <Select value={profitType} onValueChange={(v: any) => setProfitType(v)}>
                            <SelectTrigger className="h-9 w-16" data-testid="select-profit-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">%</SelectItem>
                              <SelectItem value="fixed">฿</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <Label className="text-xs font-medium">ค้นหาสินค้า</Label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                          <Input
                            data-testid="input-search-product"
                            placeholder="ชื่อหรือรหัสสินค้า..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-9"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="py-3 px-4 text-center">
                        <div className="text-2xl font-bold text-gray-700" data-testid="text-total-products">{summary.total}</div>
                        <div className="text-xs text-gray-500">สินค้าทั้งหมด</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-3 px-4 text-center">
                        <div className="text-2xl font-bold text-red-500" data-testid="text-need-increase">{summary.needIncrease}</div>
                        <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                          <TrendingUp className="h-3 w-3 text-red-400" /> ควรขึ้นราคา
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-3 px-4 text-center">
                        <div className="text-2xl font-bold text-green-500" data-testid="text-need-decrease">{summary.needDecrease}</div>
                        <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                          <TrendingDown className="h-3 w-3 text-green-400" /> ลดราคาได้
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-3 px-4 text-center">
                        <div className="text-2xl font-bold text-blue-500" data-testid="text-no-change">{summary.noChange}</div>
                        <div className="text-xs text-gray-500">ราคาเหมาะสม</div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {selectedConfigs.length > 0 && (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs w-16">รหัส</TableHead>
                              <TableHead className="text-xs">สินค้า</TableHead>
                              <TableHead className="text-xs text-right w-24">ต้นทุน</TableHead>
                              <TableHead className="text-xs text-right w-24">ราคาปัจจุบัน</TableHead>
                              {selectedConfigs.map((configId) => {
                                const c = activeConfigs.find((x) => x.id === configId);
                                return (
                                  <TableHead key={configId} className="text-xs text-center w-32">
                                    <div className="flex items-center justify-center gap-1">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: PLATFORM_COLORS[c?.platform || ""] || "#888" }}
                                      />
                                      {c?.profileName}
                                    </div>
                                  </TableHead>
                                );
                              })}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {calculating ? (
                              <TableRow>
                                <TableCell colSpan={4 + selectedConfigs.length} className="text-center py-8 text-gray-400">
                                  กำลังคำนวณ...
                                </TableCell>
                              </TableRow>
                            ) : filteredProducts.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4 + selectedConfigs.length} className="text-center py-8 text-gray-400">
                                  {searchTerm ? "ไม่พบสินค้าที่ค้นหา" : "ไม่มีสินค้า"}
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredProducts.map((product: any) => (
                                <TableRow key={product.productId} data-testid={`row-product-${product.productId}`}>
                                  <TableCell className="text-xs font-mono text-gray-500">{product.code}</TableCell>
                                  <TableCell className="text-sm">{product.name}</TableCell>
                                  <TableCell className="text-xs text-right font-medium">
                                    {formatNumber(product.cost)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right">
                                    {formatNumber(product.currentPrice)}
                                  </TableCell>
                                  {selectedConfigs.map((configId) => {
                                    const pp = product.platformPrices?.find((x: any) => x.configId === configId);
                                    if (!pp) return <TableCell key={configId} className="text-center text-xs text-gray-300">-</TableCell>;

                                    const diff = pp.priceDiff;
                                    return (
                                      <TableCell key={configId} className="text-center">
                                        <div className="text-sm font-bold">{formatNumber(pp.recommendedPrice)}</div>
                                        <div className={`text-[10px] ${diff > 0 ? "text-red-500" : diff < 0 ? "text-green-500" : "text-gray-400"}`}>
                                          {diff > 0 ? (
                                            <span className="flex items-center justify-center gap-0.5">
                                              <TrendingUp className="h-3 w-3" /> +{formatNumber(diff)}
                                            </span>
                                          ) : diff < 0 ? (
                                            <span className="flex items-center justify-center gap-0.5">
                                              <TrendingDown className="h-3 w-3" /> {formatNumber(diff)}
                                            </span>
                                          ) : (
                                            "เหมาะสม"
                                          )}
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedConfigs.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center text-gray-400">
                      <ArrowUpDown className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">เลือกแพลตฟอร์มด้านบนเพื่อเริ่มคำนวณ</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </EcommerceLayout>
  );
}
