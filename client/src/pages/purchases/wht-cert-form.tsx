import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute, useSearch } from "wouter";
import Layout from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { ArrowLeft, Save, FileText, CheckCircle2, ExternalLink, Search, Loader2, Plus, Trash2, Paperclip, FileDown, X } from "lucide-react";
import { useDbdLookup } from "@/hooks/use-dbd-lookup";
import MultiFileAttachment from "@/components/multi-file-attachment";
import { apiRequest } from "@/lib/queryClient";
import { DatePicker, toDisplayDate } from "@/components/ui/date-picker";
import type { DateFormat } from "@/components/ui/date-picker";
import { toLocalDateStr } from "@/lib/utils";

import { useDateSettings } from "@/hooks/use-date-settings";
function fmt(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0"));
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const INCOME_TYPES = [
  { value: "1", label: "1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง บำเหน็จ ฯลฯ (ม.40(1))" },
  { value: "2", label: "2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ (ม.40(2))" },
  { value: "3", label: "3. ค่าแห่งลิขสิทธิ์ ฯลฯ (ม.40(3))" },
  { value: "4a", label: "4(ก) ค่าดอกเบี้ย ฯลฯ (ม.40(4)(ก))" },
  { value: "4b", label: "4(ข) เงินปันผล ส่วนแบ่งกำไร ฯลฯ (ม.40(4)(ข))" },
  { value: "5", label: "5. ค่าจ้างทำของ ค่าบริการ ค่าเช่า ค่าขนส่ง ค่าโฆษณา (ม.3 เตรส)" },
  { value: "6", label: "6. อื่นๆ" },
];

const WHT_CONDITIONS = [
  { value: "1", label: "(1) หักภาษี ณ ที่จ่าย" },
  { value: "2", label: "(2) ออกภาษีให้ตลอดไป" },
  { value: "3", label: "(3) ออกภาษีให้ครั้งเดียว" },
  { value: "4", label: "(4) อื่นๆ" },
];

export default function WhtCertForm() {
  const [, navigate] = useLocation();
  const [matchNew] = useRoute("/purchases/wht/new");
  const [matchEdit, paramsEdit] = useRoute("/purchases/wht/edit/:id");
  const editingId = matchEdit ? Number(paramsEdit?.id) : null;
  const isNew = !!matchNew;

  const searchString = useSearch();
  const searchParams = isNew ? new URLSearchParams(searchString) : null;

  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { toast } = useToast();
  const { lookup: lookupDBD, loading: dbdLoading } = useDbdLookup();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    certNo: "",
    certDate: toLocalDateStr(new Date()),
    paidDate: toLocalDateStr(new Date()),
    payerName: "",
    payerAddress: "",
    payerTaxId: "",
    payerBranch: "",
    payeeVendorId: undefined as number | undefined,
    payeeName: "",
    payeeAddress: "",
    payeeTaxId: "",
    payeeBranch: "",
    formType: "pnd3",
    incomeType: "5",
    incomeDescription: "",
    taxRate: "3",
    amountPaid: "0",
    taxWithheld: "0",
    whtCondition: "1",
    sourceDocType: "",
    sourceDocId: undefined as number | undefined,
    sourceDocNo: "",
    notes: "",
    status: "approved",
    docPrefix: "WHT",
    attachedUrl: "",
  });
  const [items, setItems] = useState<Array<{ incomeType: string; incomeDescription: string; paidDate: string; amountPaid: string; taxRate: string; taxWithheld: string }>>([
    { incomeType: "5", incomeDescription: "", paidDate: toLocalDateStr(new Date()), amountPaid: "0", taxRate: "3", taxWithheld: "0" },
  ]);
  const [loaded, setLoaded] = useState(false);

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/document-settings/${companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: nextNo } = useQuery<any>({
    queryKey: ["/api/wht-certs/next-no", companyId, form.docPrefix],
    queryFn: async () => {
      if (!companyId) return null;
      const res = await fetch(`/api/wht-certs/next-no?companyId=${companyId}&prefix=${form.docPrefix}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!companyId && isNew,
  });

  const { data: existingDoc } = useQuery<any>({
    queryKey: ["/api/wht-certs", editingId],
    queryFn: async () => {
      if (!editingId) return null;
      const res = await fetch(`/api/wht-certs/${editingId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!editingId,
  });

  useEffect(() => {
    if (existingDoc && !loaded) {
      setForm({
        certNo: existingDoc.certNo || "",
        certDate: existingDoc.certDate || "",
        paidDate: existingDoc.paidDate || "",
        payerName: existingDoc.payerName || "",
        payerAddress: existingDoc.payerAddress || "",
        payerTaxId: existingDoc.payerTaxId || "",
        payerBranch: existingDoc.payerBranch || "",
        payeeVendorId: existingDoc.payeeVendorId || undefined,
        payeeName: existingDoc.payeeName || "",
        payeeAddress: existingDoc.payeeAddress || "",
        payeeTaxId: existingDoc.payeeTaxId || "",
        payeeBranch: existingDoc.payeeBranch || "",
        formType: existingDoc.formType || "pnd3",
        incomeType: existingDoc.incomeType || "5",
        incomeDescription: existingDoc.incomeDescription || "",
        taxRate: existingDoc.taxRate || "3",
        amountPaid: existingDoc.amountPaid || "0",
        taxWithheld: existingDoc.taxWithheld || "0",
        whtCondition: existingDoc.whtCondition || "1",
        sourceDocType: existingDoc.sourceDocType || "",
        sourceDocId: existingDoc.sourceDocId || undefined,
        sourceDocNo: existingDoc.sourceDocNo || "",
        notes: existingDoc.notes || "",
        status: existingDoc.status || "draft",
        docPrefix: existingDoc.docPrefix || "WHT",
        attachedUrl: existingDoc.attachedUrl || "",
      });
      if (existingDoc.items && existingDoc.items.length > 0) {
        setItems(existingDoc.items.map((it: any) => ({
          incomeType: it.incomeType || "5",
          incomeDescription: it.incomeDescription || "",
          paidDate: it.paidDate || existingDoc.paidDate || "",
          amountPaid: it.amountPaid || "0",
          taxRate: it.taxRate || "3",
          taxWithheld: it.taxWithheld || "0",
        })));
      } else {
        setItems([{
          incomeType: existingDoc.incomeType || "5",
          incomeDescription: existingDoc.incomeDescription || "",
          paidDate: existingDoc.paidDate || "",
          amountPaid: existingDoc.amountPaid || "0",
          taxRate: existingDoc.taxRate || "3",
          taxWithheld: existingDoc.taxWithheld || "0",
        }]);
      }
      setLoaded(true);
    }
  }, [existingDoc, loaded]);

  useEffect(() => {
    if (isNew && selectedCompany && !loaded) {
      setForm(f => ({
        ...f,
        payerName: selectedCompany.nameTh || selectedCompany.name || "",
        payerAddress: (selectedCompany as any).addressTh || (selectedCompany as any).address || "",
        payerTaxId: selectedCompany.taxId || "",
        payerBranch: (selectedCompany as any).branch || "สำนักงานใหญ่",
      }));
    }
  }, [isNew, selectedCompany, loaded]);

  useEffect(() => {
    if (isNew && searchParams && !loaded) {
      const vendorId = searchParams.get("vendorId");
      const vendorName = searchParams.get("vendorName");
      const vendorAddress = searchParams.get("vendorAddress");
      const vendorTaxId = searchParams.get("vendorTaxId");
      const vendorBranch = searchParams.get("vendorBranch");
      const wht = searchParams.get("whtAmount");
      const sourceDocType = searchParams.get("sourceDocType");
      const sourceDocId = searchParams.get("sourceDocId");
      const sourceDocNo = searchParams.get("sourceDocNo");
      const totalAmount = searchParams.get("totalAmount");
      const incomeDesc = searchParams.get("incomeDescription");

      if (vendorName || wht) {
        const taxId = vendorTaxId || "";
        const digits = taxId.replace(/\D/g, "");
        const autoForm = digits.length > 0 && digits[0] === "0" ? "pnd53" : "pnd3";
        setForm(f => ({
          ...f,
          payeeVendorId: vendorId ? Number(vendorId) : undefined,
          payeeName: vendorName || f.payeeName,
          payeeAddress: vendorAddress || f.payeeAddress,
          payeeTaxId: taxId || f.payeeTaxId,
          payeeBranch: vendorBranch || f.payeeBranch,
          taxWithheld: wht || f.taxWithheld,
          amountPaid: totalAmount || f.amountPaid,
          sourceDocType: sourceDocType || f.sourceDocType,
          sourceDocId: sourceDocId ? Number(sourceDocId) : undefined,
          sourceDocNo: sourceDocNo || f.sourceDocNo,
          formType: taxId ? autoForm : f.formType,
        }));
        const amt = totalAmount || "0";
        const whtVal = wht || "0";
        const rateCalc = parseFloat(amt) > 0 ? ((parseFloat(whtVal) / parseFloat(amt)) * 100).toFixed(0) : "3";
        setItems([{
          incomeType: "5",
          incomeDescription: incomeDesc || "",
          paidDate: toLocalDateStr(new Date()),
          amountPaid: amt,
          taxRate: rateCalc,
          taxWithheld: whtVal,
        }]);
      }
    }
  }, [isNew, searchString, loaded]);

  useEffect(() => {
    if (isNew && nextNo?.certNo && !form.certNo) {
      setForm(f => ({ ...f, certNo: nextNo.certNo }));
    }
  }, [nextNo, isNew, form.certNo]);

  const updateItem = (idx: number, field: string, value: string) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      if (field === "amountPaid" || field === "taxRate") {
        const paid = parseFloat(field === "amountPaid" ? value : it.amountPaid) || 0;
        const rate = parseFloat(field === "taxRate" ? value : it.taxRate) || 0;
        updated.taxWithheld = (paid * rate / 100).toFixed(2);
      }
      return updated;
    }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { incomeType: "5", incomeDescription: "", paidDate: form.paidDate, amountPaid: "0", taxRate: "3", taxWithheld: "0" }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const totalAmountPaid = items.reduce((s, it) => s + (parseFloat(it.amountPaid) || 0), 0);
  const totalTaxWithheld = items.reduce((s, it) => s + (parseFloat(it.taxWithheld) || 0), 0);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingId) {
        return apiRequest("PATCH", `/api/wht-certs/${editingId}`, data);
      } else {
        return apiRequest("POST", "/api/wht-certs", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wht-certs"] });
      toast({ title: editingId ? "แก้ไขสำเร็จ" : "บันทึกสำเร็จ", variant: "success" as any });
      navigate("/purchases/wht");
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const handleSave = (status?: string) => {
    if (!form.payerName || !form.payeeName || !form.certDate) {
      toast({ title: "กรุณากรอกข้อมูลให้ครบ", description: "ต้องระบุชื่อผู้จ่าย, ผู้ถูกหัก, และวันที่", variant: "destructive" });
      return;
    }
    const syncedItems = items.map(it => ({ ...it, paidDate: form.paidDate || it.paidDate }));
    saveMutation.mutate({
      ...form,
      companyId,
      amountPaid: totalAmountPaid.toFixed(2),
      taxWithheld: totalTaxWithheld.toFixed(2),
      items: syncedItems,
      status: status || form.status,
    });
  };

  const getSourceDocUrl = () => {
    if (!form.sourceDocType) return null;
    if (form.sourceDocType === "purchase_invoice") return `/purchases/invoice`;
    if (form.sourceDocType === "expense") return `/purchases/expense`;
    if (form.sourceDocType === "purchase_order") return `/purchases/po`;
    return null;
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/purchases/wht")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1" /> กลับ
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--theme-primary)]/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[var(--theme-primary)]" />
            </div>
            <h2 className="text-lg font-bold" data-testid="text-form-title">
              {editingId ? "แก้ไขหนังสือรับรอง 50 ทวิ" : "สร้างหนังสือรับรอง 50 ทวิ"}
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">เลขที่หนังสือ</label>
              <Input
                data-testid="input-cert-no"
                value={form.certNo}
                onChange={e => setForm(f => ({ ...f, certNo: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">วันที่ออกหนังสือ</label>
              <DatePicker
                value={form.certDate}
                onChange={(val) => setForm(f => ({ ...f, certDate: val }))}
                dateFormat={dateFmt}
                dateEra={dateEra}
                data-testid="input-cert-date"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">วันที่จ่ายเงิน</label>
              <DatePicker
                value={form.paidDate}
                onChange={(val) => setForm(f => ({ ...f, paidDate: val }))}
                dateFormat={dateFmt}
                dateEra={dateEra}
                data-testid="input-paid-date"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">แบบ</label>
              <Select value={form.formType} onValueChange={v => setForm(f => ({ ...f, formType: v }))}>
                <SelectTrigger data-testid="select-form-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pnd1">ภ.ง.ด.1</SelectItem>
                  <SelectItem value="pnd1a">ภ.ง.ด.1ก</SelectItem>
                  <SelectItem value="pnd1a_special">ภ.ง.ด.1ก พิเศษ</SelectItem>
                  <SelectItem value="pnd2">ภ.ง.ด.2</SelectItem>
                  <SelectItem value="pnd3">ภ.ง.ด.3</SelectItem>
                  <SelectItem value="pnd2a">ภ.ง.ด.2ก</SelectItem>
                  <SelectItem value="pnd3a">ภ.ง.ด.3ก</SelectItem>
                  <SelectItem value="pnd53">ภ.ง.ด.53</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">เงื่อนไขการหัก</label>
              <Select value={form.whtCondition} onValueChange={v => setForm(f => ({ ...f, whtCondition: v }))}>
                <SelectTrigger data-testid="select-wht-condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHT_CONDITIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-3 text-[var(--theme-primary)]">ผู้จ่ายเงิน (ผู้หัก)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">ชื่อ</label>
                <Input
                  data-testid="input-payer-name"
                  value={form.payerName}
                  onChange={e => setForm(f => ({ ...f, payerName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">เลขประจำตัวผู้เสียภาษี</label>
                <Input
                  data-testid="input-payer-tax-id"
                  value={form.payerTaxId}
                  onChange={e => setForm(f => ({ ...f, payerTaxId: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ที่อยู่</label>
                <Input
                  data-testid="input-payer-address"
                  value={form.payerAddress}
                  onChange={e => setForm(f => ({ ...f, payerAddress: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">สาขา</label>
                <Input
                  data-testid="input-payer-branch"
                  value={form.payerBranch}
                  onChange={e => setForm(f => ({ ...f, payerBranch: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-3 text-[#03c9d7]">ผู้ถูกหักภาษี ณ ที่จ่าย</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">ชื่อ</label>
                <Input
                  data-testid="input-payee-name"
                  value={form.payeeName}
                  onChange={e => setForm(f => ({ ...f, payeeName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">เลขประจำตัวผู้เสียภาษี</label>
                <div className="flex gap-1">
                  <Input
                    data-testid="input-payee-tax-id"
                    value={form.payeeTaxId}
                    onChange={e => {
                      const val = e.target.value;
                      const digits = val.replace(/\D/g, "");
                      const autoForm = digits.length > 0 && digits[0] === "0" ? "pnd53" : "pnd3";
                      setForm(f => ({ ...f, payeeTaxId: val, formType: autoForm }));
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={dbdLoading}
                    data-testid="button-dbd-lookup-payee"
                    onClick={async () => {
                      const result = await lookupDBD(form.payeeTaxId);
                      if (result) {
                        setForm(f => ({
                          ...f,
                          payeeName: result.name || f.payeeName,
                          payeeAddress: result.address || f.payeeAddress,
                          payeeBranch: result.branch || f.payeeBranch,
                        }));
                      }
                    }}
                  >
                    {dbdLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ที่อยู่</label>
                <Input
                  data-testid="input-payee-address"
                  value={form.payeeAddress}
                  onChange={e => setForm(f => ({ ...f, payeeAddress: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">สาขา</label>
                <Input
                  data-testid="input-payee-branch"
                  value={form.payeeBranch}
                  onChange={e => setForm(f => ({ ...f, payeeBranch: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: "var(--theme-primary)" }}>รายละเอียดเงินได้และภาษี</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="border-[#05b187] text-[#05b187] hover:bg-[#05b187]/10" data-testid="button-add-item">
                <Plus className="w-3 h-3 mr-1" /> เพิ่มรายการ
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border p-2 text-left w-[200px]">ประเภทเงินได้</th>
                    <th className="border p-2 text-left">รายละเอียด</th>
                    <th className="border p-2 text-right w-[130px]">จำนวนเงินที่จ่าย</th>
                    <th className="border p-2 text-center w-[80px]">อัตรา %</th>
                    <th className="border p-2 text-right w-[130px]">ภาษีที่หัก</th>
                    <th className="border p-2 text-center w-[40px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border p-1">
                        <Select value={item.incomeType} onValueChange={v => updateItem(idx, "incomeType", v)}>
                          <SelectTrigger className="h-8 text-xs" data-testid={`select-item-income-type-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INCOME_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="border p-1">
                        <Input className="h-8 text-xs" value={item.incomeDescription} onChange={e => updateItem(idx, "incomeDescription", e.target.value)} placeholder="ค่าบริการ, ค่าจ้างทำของ ฯลฯ" data-testid={`input-item-desc-${idx}`} />
                      </td>
                      <td className="border p-1">
                        <Input className="h-8 text-xs text-right" type="number" value={item.amountPaid} onChange={e => updateItem(idx, "amountPaid", e.target.value)} data-testid={`input-item-amount-${idx}`} />
                      </td>
                      <td className="border p-1">
                        <Input className="h-8 text-xs text-center" type="number" value={item.taxRate} onChange={e => updateItem(idx, "taxRate", e.target.value)} data-testid={`input-item-rate-${idx}`} />
                      </td>
                      <td className="border p-1">
                        <Input className="h-8 text-xs text-right border-red-200 text-red-600 font-semibold" type="number" value={item.taxWithheld} onChange={e => updateItem(idx, "taxWithheld", e.target.value)} data-testid={`input-item-tax-${idx}`} />
                      </td>
                      <td className="border p-1 text-center">
                        {items.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removeItem(idx)} data-testid={`button-remove-item-${idx}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-1">เปลี่ยนจำนวนเงินหรืออัตราจะคำนวณภาษีที่หักอัตโนมัติ หรือแก้ไขภาษีที่หักเองได้</p>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-3">เอกสารอ้างอิง</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">ประเภทเอกสาร</label>
                <Select value={form.sourceDocType || "none"} onValueChange={v => setForm(f => ({ ...f, sourceDocType: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-source-doc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่ระบุ</SelectItem>
                    <SelectItem value="purchase_invoice">ใบแจ้งหนี้ซื้อ (AP)</SelectItem>
                    <SelectItem value="expense">รายจ่ายอื่น (EXP)</SelectItem>
                    <SelectItem value="purchase_order">ใบสั่งซื้อ (PO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">เลขที่เอกสาร</label>
                <div className="flex items-center gap-1">
                  <Input
                    data-testid="input-source-doc-no"
                    value={form.sourceDocNo}
                    onChange={e => setForm(f => ({ ...f, sourceDocNo: e.target.value }))}
                    placeholder="เช่น AP-2024-0001"
                  />
                  {getSourceDocUrl() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      title="ไปที่หน้ารายการเอกสาร"
                      onClick={() => navigate(getSourceDocUrl()!)}
                      data-testid="button-go-source-doc"
                    >
                      <ExternalLink className="w-4 h-4" style={{ color: "var(--theme-primary)" }} />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">หมายเหตุ</label>
                <Input
                  data-testid="input-notes"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-3">เอกสารแนบ</h3>
            <MultiFileAttachment
              value={form.attachedUrl}
              onChange={v => setForm(p => ({ ...p, attachedUrl: v }))}
              testIdPrefix="wht-cert-attachment"
            />
          </div>

          <div className="border-t pt-4 bg-slate-50 -mx-5 -mb-5 p-5 rounded-b-xl">
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="text-right col-span-2 space-y-1">
                <div className="flex justify-end gap-8">
                  <span className="text-muted-foreground">รวมจำนวนเงินที่จ่าย ({items.length} รายการ):</span>
                  <span className="font-semibold w-32 text-right">{fmt(totalAmountPaid)} บาท</span>
                </div>
                <div className="flex justify-end gap-8 text-red-600">
                  <span className="font-medium">รวมภาษีที่หักไว้:</span>
                  <span className="font-bold w-32 text-right">{fmt(totalTaxWithheld)} บาท</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => navigate("/purchases/wht")} data-testid="button-cancel">
                ยกเลิก
              </Button>
              <Button
                onClick={() => handleSave("draft")}
                className="bg-slate-600 hover:bg-slate-700 text-white"
                disabled={saveMutation.isPending}
                data-testid="button-save-draft"
              >
                <Save className="w-4 h-4 mr-1" /> บันทึกร่าง
              </Button>
              <Button
                onClick={() => handleSave("approved")}
                className="bg-[#05b187] hover:bg-[#05b187]/90 text-white"
                disabled={saveMutation.isPending}
                data-testid="button-save-approved"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" /> บันทึก & อนุมัติ
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
