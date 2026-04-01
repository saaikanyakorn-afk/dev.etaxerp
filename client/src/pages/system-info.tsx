import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ChevronDown, ChevronUp, Monitor, Database, ShoppingCart, Users, Package, FileText, CreditCard, Building2, BarChart3, Calculator, Landmark, Boxes, Receipt, Truck, Store } from "lucide-react";

const SUBSYSTEMS = [
  {
    id: "sales",
    name: "ระบบขาย/ลูกหนี้ (Sales & Accounts Receivable)",
    icon: Receipt,
    color: "#05b187",
    docs: ["ใบเสนอราคา (QO)", "ใบสั่งขาย (SO)", "ใบแจ้งหนี้ (IV)", "ใบกำกับภาษี (TIV)", "ใบเสร็จรับเงิน (RE)", "ใบรับเงินมัดจำ (DP)", "ใบลดหนี้ (CN)"],
    description: "จัดการเอกสารขายครบวงจรตั้งแต่ใบเสนอราคาจนถึงใบเสร็จรับเงิน รองรับหลายสกุลเงิน (12 สกุลเงิน) พร้อมระบบ e-Tax อัตโนมัติ สร้างรายการบัญชีอัตโนมัติเมื่ออนุมัติเอกสาร",
    connections: ["gl", "vat", "inventory", "finance", "wht"],
  },
  {
    id: "purchases",
    name: "ระบบซื้อ/เจ้าหนี้ (Purchases & Accounts Payable)",
    icon: ShoppingCart,
    color: "#539BFF",
    docs: ["ใบขอซื้อ (PR)", "เปรียบเทียบราคา (BID)", "ใบสั่งซื้อ (PO)", "บันทึกซื้อ (AP)", "ค่าใช้จ่ายอื่น (EXP)", "ใบเพิ่มหนี้ (DN)", "เงินมัดจำจ่าย (PDP)"],
    description: "จัดการเอกสารซื้อครบวงจรตั้งแต่ใบขอซื้อจนถึงการจ่ายเงิน รองรับการเปรียบเทียบราคาผู้ขาย คำนวณ VAT และภาษีหัก ณ ที่จ่ายอัตโนมัติ",
    connections: ["gl", "vat", "inventory", "finance", "wht"],
  },
  {
    id: "inventory",
    name: "ระบบสินค้าคงคลัง (Inventory Management)",
    icon: Package,
    color: "#fec90f",
    docs: ["รายการสินค้า", "สูตรการผลิต (BOM)", "สินค้าชุด (Bundle)", "Stock Card", "รายงานตีราคาสินค้า", "เบิกจ่ายสินค้า", "เคลื่อนไหวสินค้า"],
    description: "จัดการสินค้าคงคลังแบบหลายคลัง (Multi-Warehouse) รองรับ Barcode EAN-13 ระบบ Bin Location, Wave/Batch Picking, PDA Mobile Interface และ Real-time Stock Sync กับแพลตฟอร์ม E-Commerce",
    connections: ["gl", "sales", "purchases", "ecommerce", "pos"],
  },
  {
    id: "gl",
    name: "ระบบบัญชีแยกประเภท (General Ledger)",
    icon: Database,
    color: "#fb9678",
    docs: ["สมุดรายวัน 5 เล่ม (ทั่วไป/รับ/จ่าย/ขาย/ซื้อ)", "ผังบัญชี (TFRS)", "บัญชีแยกประเภท (GL)", "งบทดลอง (Trial Balance)"],
    description: "ศูนย์กลางระบบบัญชี รับข้อมูลอัตโนมัติจากทุกระบบ ผังบัญชีตามมาตรฐาน TFRS (3 หลัก=บัญชีคุม / 7 หลัก=บัญชีย่อย) รองรับสมุดรายวัน 5 เล่มตามหลักบัญชี สร้างรายการบัญชีอัตโนมัติจากเอกสารทุกประเภท",
    connections: ["sales", "purchases", "finance", "assets", "hr", "pos", "ecommerce", "vat", "wht", "statements"],
  },
  {
    id: "vat",
    name: "ระบบรายงานภาษีมูลค่าเพิ่ม (VAT Reports)",
    icon: Calculator,
    color: "#03c9d7",
    docs: ["รายงานภาษีขาย", "รายงานภาษีซื้อ", "สรุป ภ.พ.30", "กระทบยอด VAT"],
    description: "จัดทำรายงานภาษีมูลค่าเพิ่มตามรูปแบบกรมสรรพากร คำนวณ ภ.พ.30 อัตโนมัติ รองรับ VAT 7% และ 0% รวมถึงระบบ VAT Product Dictionary (AI) สำหรับจำแนกประเภทภาษีสินค้า ระบบเตือนเมื่อบันทึกเอกสารในรอบ VAT ที่ปิดแล้ว",
    connections: ["gl", "sales", "purchases", "ecommerce"],
  },
  {
    id: "wht",
    name: "ระบบภาษีหัก ณ ที่จ่าย (Withholding Tax)",
    icon: FileText,
    color: "#f94d4d",
    docs: ["หนังสือรับรองภาษีหัก ณ ที่จ่าย (50 ทวิ)", "ภ.ง.ด.1 / ภ.ง.ด.1ก", "นำเข้า Excel 50 ทวิ"],
    description: "จัดการภาษีหัก ณ ที่จ่ายครบวงจร ออกหนังสือรับรอง 50 ทวิ จัดทำ ภ.ง.ด.1 (รายเดือน) และ ภ.ง.ด.1ก (สรุปรายปี) รองรับการนำเข้าข้อมูลจาก Excel คำนวณจากเอกสารซื้อ/จ่ายอัตโนมัติ",
    connections: ["gl", "sales", "purchases", "hr"],
  },
  {
    id: "finance",
    name: "ระบบการเงิน (Finance)",
    icon: CreditCard,
    color: "#9b59b6",
    docs: ["ปฏิทินครบกำหนด", "รับชำระเงิน", "จ่ายชำระเงิน", "เช็ค/เช็คคืน", "กระทบยอดธนาคาร"],
    description: "จัดการรับ-จ่ายเงิน ระบบเช็ค ปฏิทินครบกำหนดชำระ Bank Reconciliation นำเข้า Statement อัตโนมัติ รองรับหลายช่องทางชำระเงิน",
    connections: ["gl", "sales", "purchases"],
  },
  {
    id: "assets",
    name: "ระบบสินทรัพย์ถาวร (Fixed Assets)",
    icon: Building2,
    color: "#e67e22",
    docs: ["ทะเบียนสินทรัพย์", "รายงานค่าเสื่อมราคา", "รายงานขายสินทรัพย์", "สินทรัพย์ครบกำหนด", "สรุปสินทรัพย์"],
    description: "จัดการทะเบียนสินทรัพย์ถาวร คำนวณค่าเสื่อมราคาอัตโนมัติ ติดตามสถานะสินทรัพย์ สร้างรายการบัญชีค่าเสื่อมราคาอัตโนมัติ",
    connections: ["gl"],
  },
  {
    id: "hr",
    name: "ระบบบุคลากร/เงินเดือน (HR & Payroll)",
    icon: Users,
    color: "#1abc9c",
    docs: ["ทะเบียนพนักงาน", "บันทึกเวลาเข้า-ออก", "รายงานการมาทำงาน", "จัดการลา/OT", "คำนวณเงินเดือน", "ใบรับรอง ภ.ง.ด.1/1ก/50ทวิ"],
    description: "จัดการ HR ครบวงจร ลงเวลาทำงาน ระบบลา/OT อนุมัติผ่าน LINE คำนวณเงินเดือน-ภาษี สร้าง ภ.ง.ด.1/1ก อัตโนมัติ พร้อม Employee Self-Service Portal",
    connections: ["gl", "wht"],
  },
  {
    id: "ecommerce",
    name: "ระบบ E-Commerce",
    icon: Store,
    color: "#e74c3c",
    docs: ["นำเข้าออเดอร์ (Shopee/Lazada/TikTok)", "จัดการออเดอร์", "คืน/คืนเงิน", "Settlement/Wallet", "กระทบยอดภาษี", "วิเคราะห์ยอดขาย"],
    description: "เชื่อมต่อ Shopee, Lazada, TikTok Shop ดึงออเดอร์อัตโนมัติ (Auto Sync) จัดการ Fulfillment, Settlement, พิมพ์ใบปะหน้าพัสดุ กระทบยอดภาษี สร้างใบกำกับภาษีอัตโนมัติ (Auto-TIV) รองรับ Real-time Stock Sync",
    connections: ["gl", "inventory", "vat", "sales"],
  },
  {
    id: "pos",
    name: "ระบบ POS (Point of Sale)",
    icon: Monitor,
    color: "#2ecc71",
    docs: ["เปิดกะขาย", "รายการขาย", "รายงานสรุปกะ", "POS ร้านอาหาร"],
    description: "ระบบขายหน้าร้านครบวงจร รองรับ Barcode Scanner หลายช่องทางชำระเงิน พักบิล ลดราคา สร้างรายการบัญชีอัตโนมัติ รวมถึง POS ร้านอาหาร (จัดการโต๊ะ, ครัว, แยกบิล)",
    connections: ["gl", "inventory"],
  },
  {
    id: "statements",
    name: "ระบบงบการเงิน (Financial Statements)",
    icon: BarChart3,
    color: "#8e44ad",
    docs: ["งบกำไรขาดทุน", "งบแสดงฐานะการเงิน", "งบกระแสเงินสด", "งบเปรียบเทียบ", "รายงานทั่วไป"],
    description: "จัดทำงบการเงินอัตโนมัติจากข้อมูลบัญชีแยกประเภท งบกำไรขาดทุน งบดุล งบกระแสเงินสด รองรับงบเปรียบเทียบ Cache 5 นาทีเพื่อประสิทธิภาพ",
    connections: ["gl"],
  },
  {
    id: "crm",
    name: "ระบบผู้ติดต่อ/CRM (Contacts & CRM)",
    icon: Boxes,
    color: "#34495e",
    docs: ["รายชื่อผู้ติดต่อ", "ลูกค้า/ผู้ขาย", "ประวัติการติดต่อ", "ติดตามโฆษณา/ROAS"],
    description: "จัดการข้อมูลลูกค้า ผู้ขาย ผู้ติดต่อ ติดตามประวัติธุรกรรม วิเคราะห์ค่าโฆษณาและ ROAS",
    connections: ["sales", "purchases"],
  },
  {
    id: "delivery",
    name: "ระบบจัดส่ง/คลังสินค้า (Fulfillment & Warehouse)",
    icon: Truck,
    color: "#16a085",
    docs: ["พิมพ์ใบปะหน้าพัสดุ", "ติดตามพัสดุ", "แจ้ง LINE Tracking", "Wave/Batch Picking", "PDA Mobile"],
    description: "จัดการ Pick-Pack-Ship พิมพ์ใบปะหน้าพัสดุ ส่ง LINE แจ้งเลข Tracking ระบบ Bin Location, Wave Picking, PDA Scanner Interface รองรับหลายคลังสินค้า",
    connections: ["inventory", "ecommerce"],
  },
  {
    id: "firm",
    name: "ระบบบริหารสำนักงานบัญชี (Firm Management)",
    icon: Landmark,
    color: "#2c3e50",
    docs: ["มอบหมายงาน", "ติดตามสถานะงาน", "สัญญาจ้างทำบัญชี", "สรุปค่าบริการ", "คลังเอกสาร"],
    description: "สำหรับสำนักงานบัญชี จัดการลูกค้าหลายบริษัท (Multi-tenant) มอบหมายงาน ติดตามสถานะ สัญญาจ้าง สรุปค่าบริการ เซ็นสัญญาออนไลน์ Work Board แบบ Monday.com",
    connections: ["gl"],
  },
];

const FLOWCHART_NODES: { id: string; x: number; y: number; w: number; h: number }[] = [
  { id: "gl", x: 400, y: 260, w: 200, h: 80 },
  { id: "sales", x: 80, y: 40, w: 180, h: 60 },
  { id: "purchases", x: 80, y: 160, w: 180, h: 60 },
  { id: "finance", x: 80, y: 280, w: 180, h: 60 },
  { id: "wht", x: 80, y: 400, w: 180, h: 60 },
  { id: "hr", x: 80, y: 500, w: 180, h: 60 },
  { id: "vat", x: 400, y: 40, w: 200, h: 60 },
  { id: "statements", x: 400, y: 140, w: 200, h: 60 },
  { id: "inventory", x: 400, y: 420, w: 200, h: 60 },
  { id: "ecommerce", x: 700, y: 40, w: 180, h: 60 },
  { id: "pos", x: 700, y: 160, w: 180, h: 60 },
  { id: "assets", x: 700, y: 280, w: 180, h: 60 },
  { id: "crm", x: 700, y: 400, w: 180, h: 60 },
  { id: "delivery", x: 700, y: 500, w: 180, h: 60 },
  { id: "firm", x: 400, y: 540, w: 200, h: 60 },
];

const NODE_LABELS: Record<string, string> = {
  gl: "บัญชีแยกประเภท (GL)",
  sales: "ขาย/ลูกหนี้",
  purchases: "ซื้อ/เจ้าหนี้",
  inventory: "สินค้าคงคลัง",
  vat: "รายงาน VAT/ภ.พ.30",
  wht: "ภาษีหัก ณ ที่จ่าย",
  finance: "การเงิน/ธนาคาร",
  assets: "สินทรัพย์ถาวร",
  hr: "HR/เงินเดือน",
  ecommerce: "E-Commerce",
  pos: "POS ขายหน้าร้าน",
  statements: "งบการเงิน",
  crm: "ผู้ติดต่อ/CRM",
  delivery: "จัดส่ง/คลังสินค้า",
  firm: "บริหารสำนักงาน",
};

const CONNECTION_LABELS: Record<string, string> = {
  gl: "บัญชีแยกประเภท",
  sales: "ขาย",
  purchases: "ซื้อ",
  inventory: "สินค้า",
  vat: "VAT",
  wht: "WHT",
  finance: "การเงิน",
  assets: "สินทรัพย์",
  hr: "HR",
  ecommerce: "E-Commerce",
  pos: "POS",
  statements: "งบการเงิน",
  crm: "CRM",
  delivery: "จัดส่ง",
  firm: "สำนักงาน",
};

function getNode(id: string) {
  return FLOWCHART_NODES.find((n) => n.id === id);
}
function getSub(id: string) {
  return SUBSYSTEMS.find((s) => s.id === id);
}

function edgePoint(from: { x: number; y: number; w: number; h: number }, to: { x: number; y: number; w: number; h: number }) {
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  const tx = to.x + to.w / 2;
  const ty = to.y + to.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const hw = from.w / 2;
  const hh = from.h / 2;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : 1e6;
  const sy = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : 1e6;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function FlowchartSVG({ onSelect }: { onSelect: (id: string) => void }) {
  const connections: [string, string][] = [];
  for (const sub of SUBSYSTEMS) {
    for (const c of sub.connections) {
      const key = [sub.id, c].sort().join("-");
      if (!connections.find(([a, b]) => [a, b].sort().join("-") === key)) {
        connections.push([sub.id, c]);
      }
    }
  }

  return (
    <svg viewBox="0 0 960 620" className="w-full h-auto" style={{ maxHeight: 600 }}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
        </marker>
      </defs>
      {connections.map(([fromId, toId], i) => {
        const from = getNode(fromId);
        const to = getNode(toId);
        if (!from || !to) return null;
        const p1 = edgePoint(from, to);
        const p2 = edgePoint(to, from);
        return (
          <line
            key={i}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#cbd5e1"
            strokeWidth={1.5}
            className="dark:stroke-slate-600"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
      {FLOWCHART_NODES.map((node) => {
        const sub = getSub(node.id);
        if (!sub) return null;
        const isCenter = node.id === "gl";
        return (
          <g
            key={node.id}
            onClick={() => onSelect(node.id)}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
          >
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx={isCenter ? 16 : 10}
              fill={sub.color}
              fillOpacity={isCenter ? 1 : 0.15}
              stroke={sub.color}
              strokeWidth={isCenter ? 3 : 2}
            />
            <text
              x={node.x + node.w / 2}
              y={node.y + node.h / 2 + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isCenter ? "#fff" : sub.color}
              fontWeight="600"
              fontSize={isCenter ? 14 : 12}
              fontFamily="system-ui, sans-serif"
            >
              {NODE_LABELS[node.id] || sub.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function SystemInfoPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print-system-info">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-system-info, .print-system-info * { visibility: visible !important; }
          .print-system-info { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          .print-system-info .subsystem-card { break-inside: avoid; margin-bottom: 12px; }
        }
      `}</style>

      <div className="space-y-6">
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-system-info-title">
              ผังการทำงานรวมของระบบ (System Flowchart)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              เอกสารประกอบการยื่นขอเลขประจำตัวซอฟต์แวร์เฮ้าส์ ตามคำสั่งกรมสรรพากร ที่ ท.643/2556
            </p>
          </div>
          <Button onClick={handlePrint} variant="outline" className="gap-2" data-testid="btn-print-system-info">
            <Printer size={16} />
            พิมพ์ / PDF
          </Button>
        </div>

        <div className="hidden print:block text-center mb-4">
          <h1 className="text-xl font-bold">ผังการทำงานรวมของระบบ E-Tax Center</h1>
          <p className="text-sm">(System Flowchart)</p>
          <p className="text-xs mt-1">ตามข้อ 2.1 คำสั่งกรมสรรพากร ที่ ท.643/2556</p>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <div className="mb-4 text-center">
              <h2 className="text-lg font-bold text-foreground">
                E-Tax Center — Digital Accounting Platform
              </h2>
              <p className="text-sm text-muted-foreground">
                ระบบบัญชีดิจิทัลครบวงจร (Multi-tenant SaaS)
              </p>
            </div>
            <div className="border border-border rounded-xl p-2 md:p-4 bg-muted/30">
              <FlowchartSVG onSelect={(id) => { setSelectedId(id); setExpandedIds((prev) => new Set(prev).add(id)); }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 justify-center text-xs text-muted-foreground no-print">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full" style={{ background: "#fb9678" }} /> ศูนย์กลาง (GL)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-8 h-0.5 bg-slate-400" /> เชื่อมโยงข้อมูล
              </span>
              <span>คลิกที่กล่องเพื่อดูรายละเอียด</span>
            </div>
          </CardContent>
        </Card>

        <div className="print-break" />

        <div>
          <h2 className="text-xl font-bold text-foreground mb-4" data-testid="text-subsystem-detail-title">
            ข้อ 2.2 — รายละเอียดระบบย่อย (Subsystem Details)
          </h2>
          <div className="grid gap-3" data-testid="subsystem-list">
            {SUBSYSTEMS.map((sub, idx) => {
              const isExpanded = expandedIds.has(sub.id);
              const isSelected = selectedId === sub.id;
              const Icon = sub.icon;
              return (
                <Card
                  key={sub.id}
                  className={`subsystem-card transition-all ${isSelected ? "ring-2" : ""}`}
                  style={isSelected ? { borderColor: sub.color, boxShadow: `0 0 0 2px ${sub.color}33` } : {}}
                  id={`sub-${sub.id}`}
                  data-testid={`card-subsystem-${sub.id}`}
                >
                  <CardContent className="p-4">
                    <button
                      className="w-full flex items-center gap-3 text-left"
                      onClick={() => toggleExpand(sub.id)}
                      data-testid={`btn-expand-${sub.id}`}
                    >
                      <div
                        className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
                        style={{ background: `${sub.color}20`, color: sub.color }}
                      >
                        <Icon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm leading-tight">
                          {idx + 1}. {sub.name}
                        </h3>
                      </div>
                      <div className="text-muted-foreground no-print">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>

                    <div className={`mt-3 space-y-3 ${isExpanded ? "block" : "hidden print:block"}`}>
                      <p className="text-sm text-muted-foreground leading-relaxed">{sub.description}</p>

                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1.5">เอกสาร/ฟังก์ชันหลัก:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {sub.docs.map((doc, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: `${sub.color}15`, color: sub.color, border: `1px solid ${sub.color}30` }}
                            >
                              {doc}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">เชื่อมโยงกับระบบ:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {sub.connections.map((cid) => {
                            const csub = getSub(cid);
                            if (!csub) return null;
                            return (
                              <button
                                key={cid}
                                className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:opacity-80 no-print"
                                onClick={() => {
                                  setSelectedId(cid);
                                  setExpandedIds((prev) => new Set(prev).add(cid));
                                  document.getElementById(`sub-${cid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                                }}
                              >
                                → {CONNECTION_LABELS[cid] || cid}
                              </button>
                            );
                          })}
                          <span className="hidden print:inline text-xs text-muted-foreground">
                            {sub.connections.map((cid) => CONNECTION_LABELS[cid] || cid).join(", ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="print-break">
          <CardContent className="p-4 md:p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">ข้อมูลซอฟต์แวร์ (Software Information)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <Row label="ชื่อซอฟต์แวร์" value="E-Tax Center" />
                <Row label="ประเภท" value="ระบบบัญชีดิจิทัลครบวงจร (Digital Accounting Platform)" />
                <Row label="รูปแบบ" value="Web Application (Cloud-based SaaS)" />
                <Row label="มาตรฐาน" value="Software Type A — รายงานภาษีขาย, ภาษีซื้อ, ภ.พ.30" />
                <Row label="รองรับ VAT" value="VAT 7%, VAT 0%, Non-VAT, Mixed" />
              </div>
              <div className="space-y-2">
                <Row label="เทคโนโลยี" value="React, TypeScript, Express.js, PostgreSQL" />
                <Row label="ฐานข้อมูล" value="PostgreSQL (Drizzle ORM)" />
                <Row label="ผังบัญชี" value="TFRS — 3 หลัก (คุม) / 7 หลัก (ย่อย)" />
                <Row label="Multi-tenant" value="รองรับหลายบริษัท/สำนักงานบัญชี" />
                <Row label="ภาษา" value="ไทย, English, 简体中文, 繁體中文" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pb-8 no-print">
          เอกสารนี้สร้างจากระบบ E-Tax Center — ใช้ปุ่ม "พิมพ์ / PDF" เพื่อบันทึกเป็น PDF
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-medium text-muted-foreground min-w-[120px] shrink-0">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
