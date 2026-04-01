import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  ShoppingBag, User, Folder, Briefcase, Globe, Plus, Trash2, Save, 
  Calendar as CalendarIcon, ChevronDown, BookOpen, Calculator, FileText, Upload, Loader2
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import ThaiDateInput from "@/components/thai-date-input";
import JournalPreviewPanel, { type JournalLine } from "@/components/journal-preview-panel";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
interface ExpenseLine {
  id: number;
  accountId: string;
  description: string;
  expenseType: string;
  amount: number;
  vatRate: number;
  vatAmount: number;
  whtRate: number;
  whtAmount: number;
  netAmount: number;
}

const WHT_RATES = [
  { value: "0", label: "ไม่หัก ณ ที่จ่าย" },
  { value: "1", label: "1% - ขนส่ง" },
  { value: "2", label: "2% - โฆษณา" },
  { value: "3", label: "3% - บริการ" },
  { value: "5", label: "5% - ค่าเช่า" },
];

const VAT_RATES = [
  { value: "0", label: "ไม่มี VAT" },
  { value: "7", label: "VAT 7%" },
];

const createEmptyLine = (): ExpenseLine => ({
  id: Date.now() + Math.random(),
  accountId: "",
  description: "",
  expenseType: "none",
  amount: 0,
  vatRate: 7,
  vatAmount: 0,
  whtRate: 0,
  whtAmount: 0,
  netAmount: 0,
});

function calcLine(line: ExpenseLine): ExpenseLine {
  const vatAmount = line.amount * (line.vatRate / 100);
  const whtAmount = line.amount * (line.whtRate / 100);
  const netAmount = line.amount + vatAmount - whtAmount;
  return { ...line, vatAmount, whtAmount, netAmount };
}

function fmt(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ExpenseEntry() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const { acctName } = useLanguage();
  const queryClient = useQueryClient();

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });
  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ["/api/accounts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/accounts?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ["/api/contacts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/contacts?companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });
  const today = toLocalDateStr(new Date());
  const [date, setDate] = useState(today);
  const [journalOverrideLines, setJournalOverrideLines] = useState<JournalLine[] | null>(null);
  const [dueDate, setDueDate] = useState(today);
  const [vendorCode, setVendorCode] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorOrg, setVendorOrg] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [refNo, setRefNo] = useState("");
  const [branch, setBranch] = useState("");
  const [creditDays, setCreditDays] = useState(0);
  const [manualDueDate, setManualDueDate] = useState(false);
  const [showInTaxReport, setShowInTaxReport] = useState(true);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<ExpenseLine[]>([createEmptyLine()]);
  const [pdfParsing, setPdfParsing] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (manualDueDate) return;
    if (creditDays >= 0 && date) {
      const base = new Date(date + "T00:00:00");
      base.setDate(base.getDate() + creditDays);
      const iso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
      setDueDate(iso);
    }
  }, [creditDays, date]);

  const updateLine = useCallback((lineId: number, field: keyof ExpenseLine, value: any) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const updated = { ...l, [field]: value };
      return calcLine(updated);
    }));
  }, []);

  const addLine = useCallback(() => {
    setLines(prev => [...prev, createEmptyLine()]);
  }, []);

  const removeLine = useCallback((lineId: number) => {
    setLines(prev => prev.length <= 1 ? prev : prev.filter(l => l.id !== lineId));
  }, []);

  const totals = useMemo(() => {
    const subTotal = lines.reduce((s, l) => s + l.amount, 0);
    const totalVat = lines.reduce((s, l) => s + l.vatAmount, 0);
    const totalWht = lines.reduce((s, l) => s + l.whtAmount, 0);
    const grandTotal = subTotal + totalVat - totalWht;
    return { subTotal, totalVat, totalWht, grandTotal };
  }, [lines]);

  const handleSelectContact = useCallback((contactId: string) => {
    const contact = contacts.find((c: any) => String(c.id) === contactId);
    if (contact) {
      setVendorCode(contact.code || "");
      setVendorName(contact.name || "");
      setVendorOrg(contact.organization || "");
      setVendorAddress(contact.address || "");
      setVendorEmail(contact.email || "");
      setVendorPhone(contact.phone || "");
      setTaxId(contact.taxId || "");
    }
  }, [contacts]);

  const handleReset = useCallback(() => {
    setDate(today);
    setDueDate(today);
    setVendorCode("");
    setVendorName("");
    setVendorOrg("");
    setVendorAddress("");
    setVendorEmail("");
    setVendorPhone("");
    setTaxId("");
    setRefNo("");
    setBranch("");
    setCreditDays(0);
    setNote("");
    setShowInTaxReport(true);
    setLines([createEmptyLine()]);
    toast({ title: "รีเซตสำเร็จ" });
  }, [today, toast]);

  const expenseAccounts = useMemo(() =>
    accounts.filter((a: any) => a.type === "expense" || a.code?.startsWith("5")),
    [accounts]
  );

  async function handlePdfUpload(file: File) {
    setPdfParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/pdf-invoice-parse", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "ไม่สามารถอ่าน PDF" }));
        throw new Error(err.message);
      }
      const data = await res.json();

      const matchedVendor = contacts.find((c: any) =>
        (c.type === "vendor" || c.type === "both") &&
        data.vendorTaxId && c.taxId === data.vendorTaxId
      );

      if (matchedVendor) {
        setVendorCode(matchedVendor.code || "");
        setVendorName(matchedVendor.name || "");
        setVendorOrg(matchedVendor.organization || "");
        setVendorAddress(matchedVendor.address || "");
        setVendorEmail(matchedVendor.email || "");
        setVendorPhone(matchedVendor.phone || "");
        setTaxId(matchedVendor.taxId || "");
        setBranch(matchedVendor.branch || "");
        if (matchedVendor.creditDays) setCreditDays(matchedVendor.creditDays);
      } else {
        if (data.vendorName) setVendorName(data.vendorName);
        if (data.vendorTaxId) setTaxId(data.vendorTaxId);
        if (data.vendorAddress) setVendorAddress(data.vendorAddress);
        if (data.vendorBranch) setBranch(data.vendorBranch);
      }

      if (data.date) setDate(data.date);
      if (data.dueDate) { setDueDate(data.dueDate); setManualDueDate(true); }
      if (data.invoiceNo) setRefNo(data.invoiceNo);

      if (data.items && data.items.length > 0) {
        const newLines: ExpenseLine[] = data.items.map((it: any) => {
          const line: ExpenseLine = {
            id: Date.now() + Math.random(),
            accountId: "",
            description: it.description || "",
            expenseType: "none",
            amount: it.amount || 0,
            vatRate: it.vatType === "vat7" ? 7 : 0,
            vatAmount: 0,
            whtRate: 0,
            whtAmount: 0,
            netAmount: 0,
          };
          return calcLine(line);
        });
        setLines(newLines);
      }

      const foundFields = [
        data.invoiceNo && "เลขที่",
        data.date && "วันที่",
        data.vendorName && "ผู้ขาย",
        data.items?.length && `${data.items.length} รายการ`,
      ].filter(Boolean);

      toast({
        title: "อ่าน PDF สำเร็จ",
        description: foundFields.length > 0
          ? `พบข้อมูล: ${foundFields.join(", ")}`
          : "ไม่พบข้อมูลที่ชัดเจน กรุณาตรวจสอบและกรอกเพิ่มเติม",
        variant: foundFields.length > 0 ? ("success" as any) : "default",
      });
    } catch (err: any) {
      toast({ title: "อ่าน PDF ไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setPdfParsing(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[var(--theme-primary)]" />
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">เพิ่มค่าใช้จ่ายอื่นๆ</h1>
            <span className="text-sm text-muted-foreground">การซื้อ & รายจ่าย</span>
          </div>
          <div>
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              data-testid="input-pdf-upload-expense"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handlePdfUpload(file);
              }}
            />
            <Button
              data-testid="button-pdf-import-expense"
              variant="outline"
              size="sm"
              className="border-[var(--theme-primary)] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10"
              onClick={() => pdfInputRef.current?.click()}
              disabled={pdfParsing}
            >
              {pdfParsing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
              {pdfParsing ? "กำลังอ่าน PDF..." : "อ่าน PDF อัตโนมัติ"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-0">
            <TabsTrigger value="general" className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--theme-primary)] rounded-none px-4 py-2 bg-white border border-b-0 flex gap-2 text-sm" data-testid="tab-general">
              <User className="h-4 w-4" /> General
            </TabsTrigger>
            <TabsTrigger value="special" className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--theme-primary)] rounded-none px-4 py-2 bg-white border border-b-0 text-sm" data-testid="tab-special">
              Special Note
            </TabsTrigger>
            <TabsTrigger value="accountant" className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--theme-primary)] rounded-none px-4 py-2 bg-white border border-b-0 flex gap-2 text-sm" data-testid="tab-accountant">
              <BookOpen className="h-4 w-4" /> Accountant
            </TabsTrigger>
          </TabsList>

          <Card className="rounded-t-none border-t-0 shadow-md">
            <TabsContent value="general" className="m-0">
              <CardHeader className="p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">ประเภท</span>
                    <Select defaultValue="normal">
                      <SelectTrigger className="h-8 w-28 text-xs" data-testid="select-doc-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">ปกติ</SelectItem>
                        <SelectItem value="credit">เงินเชื่อ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Checkbox id="tax-report" checked={showInTaxReport} onCheckedChange={(v) => setShowInTaxReport(!!v)} className="border-amber-500 data-[state=checked]:bg-amber-500" data-testid="checkbox-tax-report" />
                    <label htmlFor="tax-report" className="cursor-pointer text-amber-600 font-medium">แสดงในรายงานภาษีซื้อ</label>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-sm">รายละเอียดผู้ขาย / ผู้ให้บริการ</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 border rounded-lg overflow-hidden">
                  <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2">
                    <div className="p-3 border-r border-b bg-amber-50/30 space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">รหัสคู่ค้า</label>
                      {contacts.length > 0 ? (
                        <Select value={vendorCode ? contacts.find((c: any) => c.code === vendorCode)?.id?.toString() : ""} onValueChange={handleSelectContact}>
                          <SelectTrigger className="h-7 border-none p-0 focus:ring-0 shadow-none text-sm bg-transparent" data-testid="select-vendor">
                            <SelectValue placeholder="เลือกคู่ค้า..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {contacts.map((c: any) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.code || c.id} - {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={vendorCode} onChange={(e) => setVendorCode(e.target.value)} placeholder="ระบุรหัสคู่ค้า" className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm bg-transparent" data-testid="input-vendor-code" />
                      )}
                    </div>
                    <div className="p-3 border-b bg-amber-50/30 space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">ชื่อ</label>
                      <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="ชื่อคู่ค้า / ผู้ให้บริการ" className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm bg-transparent" data-testid="input-vendor-name" />
                    </div>
                    <div className="p-3 border-r border-b md:col-span-2 space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">องค์กร</label>
                      <Input value={vendorOrg} onChange={(e) => setVendorOrg(e.target.value)} placeholder="ชื่อบริษัท / ร้านค้า" className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm" data-testid="input-vendor-org" />
                    </div>
                    <div className="p-3 border-r md:col-span-2 space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">ที่อยู่</label>
                      <textarea value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} className="w-full h-14 border-none p-0 focus:ring-0 text-sm resize-none" placeholder="ที่อยู่สำหรับออกเอกสาร..." data-testid="input-vendor-address" />
                    </div>
                    <div className="p-3 border-r border-t space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">อีเมล</label>
                      <Input value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm" data-testid="input-vendor-email" />
                    </div>
                    <div className="p-3 border-t space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">โทรศัพท์</label>
                      <Input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm" data-testid="input-vendor-phone" />
                    </div>
                  </div>

                  <div className="md:col-span-4 bg-slate-50/50">
                    <div className="p-3 border-b border-l space-y-1">
                      <label className="text-[10px] text-muted-foreground uppercase">เลขที่ใบกำกับภาษี/อ้างอิง</label>
                      <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm bg-transparent" data-testid="input-ref-no" />
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="p-3 border-b border-l space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase">สาขา</label>
                        <Input value={branch} onChange={(e) => setBranch(e.target.value)} className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm bg-transparent" data-testid="input-branch" />
                      </div>
                      <div className="p-3 border-b border-l space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase">สูตร</label>
                        <Select defaultValue="cash-ap">
                          <SelectTrigger className="h-7 border-none shadow-none p-0 focus:ring-0 text-sm bg-transparent" data-testid="select-formula">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash-ap">Cash[AP]</SelectItem>
                            <SelectItem value="credit-ap">Credit[AP]</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="p-3 border-b border-l space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">วันที่ <CalendarIcon className="h-3 w-3" /></label>
                        <ThaiDateInput value={date} onChange={v => { setManualDueDate(false); setDate(v); }} dateEra={dateEra} dateFmt={dateFmt} className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm bg-transparent" data-testid="input-date" />
                      </div>
                      <div className="p-3 border-b border-l space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase">#เครดิต (วัน)</label>
                        <Input type="number" value={creditDays} onChange={(e) => { setManualDueDate(false); setCreditDays(Number(e.target.value)); }} className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm bg-transparent" data-testid="input-credit-days" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="p-3 border-b border-l space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">วันครบกำหนด <CalendarIcon className="h-3 w-3" /></label>
                        <ThaiDateInput value={dueDate} onChange={v => { setManualDueDate(true); setDueDate(v); }} dateEra={dateEra} dateFmt={dateFmt} className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm bg-transparent" data-testid="input-due-date" />
                      </div>
                      <div className="p-3 border-b border-l space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase">เลขผู้เสียภาษี</label>
                        <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="h-7 border-none p-0 focus-visible:ring-0 shadow-none text-sm bg-transparent" data-testid="input-tax-id" />
                      </div>
                    </div>
                    <div className="p-3 border-l space-y-1 bg-white">
                      <label className="text-[10px] text-muted-foreground uppercase">เลขที่เอกสาร</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">EXP-AUTO</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader style={{ background: "var(--theme-table-header)" }}>
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-white w-10 text-center text-xs">#</TableHead>
                      <TableHead className="text-white w-44 text-xs">รหัสบัญชี</TableHead>
                      <TableHead className="text-white text-xs">รายละเอียด</TableHead>
                      <TableHead className="text-white w-24 text-right text-xs">จำนวนเงิน</TableHead>
                      <TableHead className="text-white w-24 text-center text-xs">VAT</TableHead>
                      <TableHead className="text-white w-20 text-right text-xs">ภาษีมูลค่าเพิ่ม</TableHead>
                      <TableHead className="text-white w-24 text-center text-xs">หัก ณ ที่จ่าย</TableHead>
                      <TableHead className="text-white w-20 text-right text-xs">ภาษีหัก</TableHead>
                      <TableHead className="text-white w-24 text-right text-xs">สุทธิ</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, idx) => (
                      <TableRow key={line.id} className="border-b hover:bg-blue-50/30">
                        <TableCell className="text-center text-xs py-1.5">{idx + 1}</TableCell>
                        <TableCell className="p-1">
                          <Select value={line.accountId} onValueChange={(v) => updateLine(line.id, "accountId", v)}>
                            <SelectTrigger className="h-8 text-xs border-blue-200 bg-blue-50/50" data-testid={`select-account-${idx}`}>
                              <SelectValue placeholder="เลือกบัญชี" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {(expenseAccounts.length > 0 ? expenseAccounts : accounts).map((acc: any) => (
                                <SelectItem key={acc.id} value={String(acc.id)}>
                                  {acc.code} - {acctName(acc)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-1">
                          <Input value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} className="h-8 text-xs" placeholder="รายละเอียดค่าใช้จ่าย" data-testid={`input-desc-${idx}`} />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input type="number" value={line.amount || ""} onChange={(e) => updateLine(line.id, "amount", parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" placeholder="0.00" data-testid={`input-amount-${idx}`} />
                        </TableCell>
                        <TableCell className="p-1">
                          <Select value={String(line.vatRate)} onValueChange={(v) => updateLine(line.id, "vatRate", parseFloat(v))}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-vat-${idx}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VAT_RATES.map(r => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono pr-2 text-blue-600">{fmt(line.vatAmount)}</TableCell>
                        <TableCell className="p-1">
                          <Select value={String(line.whtRate)} onValueChange={(v) => updateLine(line.id, "whtRate", parseFloat(v))}>
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-wht-${idx}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WHT_RATES.map(r => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono pr-2 text-red-500">{line.whtAmount > 0 ? `(${fmt(line.whtAmount)})` : "-"}</TableCell>
                        <TableCell className="text-right text-xs font-mono pr-2 font-bold">{fmt(line.netAmount)}</TableCell>
                        <TableCell className="p-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:bg-red-50" onClick={() => removeLine(line.id)} data-testid={`button-remove-${idx}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="p-3 border-b flex justify-between items-center bg-slate-50/30">
                  <Button variant="ghost" size="sm" className="text-xs font-bold text-[#03c9d7]" onClick={addLine} data-testid="button-add-line">
                    <Plus className="h-3 w-3 mr-1" /> เพิ่มรายการ
                  </Button>
                </div>

                <div className="p-4 bg-white border-t space-y-2">
                  <div className="flex justify-end">
                    <div className="w-72 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">รวมก่อน VAT</span>
                        <span className="font-mono" data-testid="text-subtotal">{fmt(totals.subTotal)}</span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>ภาษีมูลค่าเพิ่ม</span>
                        <span className="font-mono" data-testid="text-vat">{fmt(totals.totalVat)}</span>
                      </div>
                      <div className="flex justify-between text-red-500">
                        <span>หัก ณ ที่จ่าย</span>
                        <span className="font-mono" data-testid="text-wht">{totals.totalWht > 0 ? `(${fmt(totals.totalWht)})` : "-"}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t pt-2 border-double">
                        <span>ยอดชำระสุทธิ</span>
                        <span className="font-mono text-[#05b187]" data-testid="text-grand-total">{fmt(totals.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 px-4 pb-4">
                  <JournalPreviewPanel
                    companyId={companyId ?? null}
                    documentType="expense"
                    subtotal={totals.subTotal?.toFixed(2) || "0"}
                    vatAmount={totals.totalVat?.toFixed(2) || "0"}
                    withholdingTax={totals.totalWht?.toFixed(2) || "0"}
                                  onLinesChange={setJournalOverrideLines}
              />
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="special" className="m-0">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-sm">หมายเหตุพิเศษ</h3>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-32 border rounded-lg p-3 text-sm resize-none" placeholder="บันทึกหมายเหตุเพิ่มเติม..." data-testid="input-note" />
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="accountant" className="m-0">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-[#03c9d7]" />
                    ตัวอย่างการบันทึกบัญชี (Journal Preview)
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs">รหัสบัญชี</TableHead>
                        <TableHead className="text-xs">ชื่อบัญชี</TableHead>
                        <TableHead className="text-xs text-right">เดบิต</TableHead>
                        <TableHead className="text-xs text-right">เครดิต</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.filter(l => l.accountId && l.amount > 0).map((line) => {
                        const acct = accounts.find((a: any) => String(a.id) === line.accountId);
                        return (
                          <TableRow key={`je-${line.id}`}>
                            <TableCell className="text-xs font-mono">{acct?.code || "-"}</TableCell>
                            <TableCell className="text-sm">{acct ? acctName(acct) : "-"}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmt(line.amount)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">-</TableCell>
                          </TableRow>
                        );
                      })}
                      {totals.totalVat > 0 && (
                        <TableRow>
                          <TableCell className="text-xs font-mono">1140</TableCell>
                          <TableCell className="text-sm">ภาษีซื้อ</TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmt(totals.totalVat)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">-</TableCell>
                        </TableRow>
                      )}
                      {totals.totalWht > 0 && (
                        <TableRow>
                          <TableCell className="text-xs font-mono">2130</TableCell>
                          <TableCell className="text-sm">ภาษีหัก ณ ที่จ่าย</TableCell>
                          <TableCell className="text-right font-mono text-sm">-</TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmt(totals.totalWht)}</TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell className="text-xs font-mono">1100</TableCell>
                        <TableCell className="text-sm">เงินสด/ธนาคาร</TableCell>
                        <TableCell className="text-right font-mono text-sm">-</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(totals.grandTotal)}</TableCell>
                      </TableRow>
                      <TableRow className="bg-gray-100 font-bold">
                        <TableCell colSpan={2} className="text-sm">รวม</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(totals.subTotal + totals.totalVat)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(totals.totalWht + totals.grandTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </TabsContent>

            <div className="p-4 bg-slate-50/50 flex justify-between border-t items-center">
              <div className="flex items-center gap-2 text-xs">
                <Checkbox id="journal-sync-exp" data-testid="checkbox-journal-sync" />
                <label htmlFor="journal-sync-exp" className="cursor-pointer text-muted-foreground">บันทึกเข้าบัญชีรายชื่อ</label>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} data-testid="button-reset">
                  รีเซต [F5]
                </Button>
                <Button className="min-w-[120px] bg-[var(--theme-primary)] hover:bg-[#e8856a]" data-testid="button-save">
                  <Save className="h-4 w-4 mr-2" /> บันทึก [F2]
                </Button>
              </div>
            </div>
          </Card>
        </Tabs>
      </div>
    </Layout>
  );
}
