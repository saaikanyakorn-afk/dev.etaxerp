import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, AlertTriangle, Users, Search, Loader2 } from "lucide-react";
import { useDbdLookup } from "@/hooks/use-dbd-lookup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import type { Contact } from "@shared/schema";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface FormData {
  code: string;
  name: string;
  nameEn: string;
  nameZh: string;
  type: string;
  taxId: string;
  branch: string;
  address: string;
  addressEn: string;
  addressZh: string;
  phone: string;
  email: string;
  contactPerson: string;
  creditDays: number;
  notes: string;
}

const INITIAL_FORM: FormData = {
  code: "",
  name: "",
  nameEn: "",
  nameZh: "",
  type: "customer",
  taxId: "",
  branch: "สำนักงานใหญ่",
  address: "",
  addressEn: "",
  addressZh: "",
  phone: "",
  email: "",
  contactPerson: "",
  creditDays: 30,
  notes: "",
};

const ContactFormInner = memo(function ContactFormInner({
  editingId,
  selectedCompanyId,
}: {
  editingId: number | null;
  selectedCompanyId: number | null;
}) {
  const { toast } = useToast();
  const { lookup: lookupDBD, loading: dbdLoading } = useDbdLookup();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const formRef = useRef<FormData>({ ...INITIAL_FORM });
  const [form, setFormState] = useState<FormData>({ ...INITIAL_FORM });

  const setForm = useCallback((updater: FormData | ((prev: FormData) => FormData)) => {
    setFormState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      formRef.current = next;
      return next;
    });
  }, []);

  const setField = useCallback((field: keyof FormData, value: string | number) => {
    setFormState(prev => {
      const next = { ...prev, [field]: value };
      formRef.current = next;
      return next;
    });
  }, []);

  const debouncedCode = useDebouncedValue(form.code, 800);
  const debouncedName = useDebouncedValue(form.name, 800);
  const debouncedTaxId = useDebouncedValue(form.taxId, 800);

  const { data: contactSettings } = useQuery({
    queryKey: ["/api/contacts/settings", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/contacts/settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!selectedCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (editingId) {
      fetch(`/api/contacts?companyId=${selectedCompanyId}`, { credentials: "include" })
        .then(r => r.json())
        .then((contacts: Contact[]) => {
          const c = contacts.find(ct => ct.id === editingId);
          if (c) {
            setForm({
              code: c.code,
              name: c.name,
              nameEn: c.nameEn || "",
              nameZh: c.nameZh || "",
              type: c.type,
              taxId: c.taxId || "",
              branch: c.branch || "สำนักงานใหญ่",
              address: c.address || "",
              addressEn: c.addressEn || "",
              addressZh: c.addressZh || "",
              phone: c.phone || "",
              email: c.email || "",
              contactPerson: c.contactPerson || "",
              creditDays: c.creditDays || 30,
              notes: c.notes || "",
            });
          }
        });
    }
  }, [editingId, selectedCompanyId, setForm]);

  useEffect(() => {
    if (!editingId && contactSettings?.autoCode && selectedCompanyId) {
      fetch(`/api/contacts/next-code?companyId=${selectedCompanyId}`, { credentials: "include" })
        .then(r => { if (!r.ok) throw new Error("failed"); return r.json(); })
        .then(({ code }) => {
          setForm(f => ({ ...f, code, type: contactSettings.defaultType || "customer", creditDays: contactSettings.defaultCreditDays || 30 }));
        })
        .catch(() => {});
    }
  }, [editingId, selectedCompanyId, contactSettings, setForm]);

  const { data: duplicates = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/check-duplicates", selectedCompanyId, debouncedCode, debouncedName, debouncedTaxId, editingId],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(selectedCompanyId) });
      if (debouncedCode) params.set("code", debouncedCode);
      if (debouncedName && debouncedName.length >= 2) params.set("name", debouncedName);
      if (debouncedTaxId && debouncedTaxId.length >= 5) params.set("taxId", debouncedTaxId);
      if (editingId) params.set("excludeId", String(editingId));
      const r = await fetch(`/api/contacts/check-duplicates?${params}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && (!!debouncedCode || (!!debouncedName && debouncedName.length >= 2) || (!!debouncedTaxId && debouncedTaxId.length >= 5)),
    staleTime: 2000,
  });

  const codeDup = duplicates.filter(d => d.code === form.code.trim());
  const taxIdDup = form.taxId.trim() ? duplicates.filter(d => d.taxId === form.taxId.trim()) : [];
  const nameDup = duplicates.filter(d => !codeDup.includes(d) && !taxIdDup.includes(d));

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) {
        const body = await r.json();
        throw new Error(body.message);
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "เพิ่มคู่ค้าสำเร็จ", variant: "success" as any });
      navigate("/contacts/list");
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "แก้ไขคู่ค้าสำเร็จ", variant: "success" as any });
      navigate("/contacts/list");
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = useCallback(() => {
    const f = formRef.current;
    if (!f.code || !f.name) {
      toast({ title: "กรุณากรอกรหัสและชื่อคู่ค้า", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: f });
    } else {
      createMutation.mutate(f);
    }
  }, [editingId, toast, createMutation, updateMutation]);

  const handleDbdLookup = useCallback(async () => {
    const result = await lookupDBD(formRef.current.taxId);
    if (result) {
      setForm(f => ({
        ...f,
        name: result.name || f.name,
        address: result.address || f.address,
        branch: result.branch || f.branch,
      }));
    }
  }, [lookupDBD, setForm]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button data-testid="button-back" variant="ghost" size="icon" onClick={() => navigate("/contacts/list")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Users className="h-5 w-5 text-primary" />
          <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">
            {editingId ? "แก้ไขคู่ค้า" : "เพิ่มคู่ค้าใหม่"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="button-cancel" variant="outline" onClick={() => navigate("/contacts/list")}>ยกเลิก</Button>
          <Button data-testid="button-save" className="gap-2" onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending || (!editingId && codeDup.length > 0)}>
            <Save className="h-4 w-4" />
            {editingId ? "บันทึก" : "เพิ่มคู่ค้า"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">ข้อมูลทั่วไป</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>รหัสคู่ค้า *</Label>
              <div className="relative">
                <Input data-testid="input-code" value={form.code} onChange={e => setField("code", e.target.value)} placeholder="C001"
                  className={codeDup.length > 0 ? "border-red-500 focus-visible:ring-red-500" : ""} />
                {!editingId && contactSettings?.autoCode && form.code && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">อัตโนมัติ</span>
                )}
              </div>
              {codeDup.length > 0 && (
                <p data-testid="text-code-duplicate" className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> รหัสนี้ถูกใช้แล้ว: {codeDup[0].name} ({codeDup[0].code})
                </p>
              )}
            </div>
            <div>
              <Label>ประเภท</Label>
              <Select data-testid="select-type" value={form.type} onValueChange={v => setField("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">ลูกค้า</SelectItem>
                  <SelectItem value="vendor">ผู้ขาย</SelectItem>
                  <SelectItem value="both">ลูกค้า/ผู้ขาย</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>🇹🇭 ชื่อคู่ค้า *</Label>
            <Input data-testid="input-name" value={form.name} onChange={e => setField("name", e.target.value)} placeholder="บริษัท ตัวอย่าง จำกัด" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>🇬🇧 Name (EN)</Label>
              <Input data-testid="input-name-en" value={form.nameEn} onChange={e => setField("nameEn", e.target.value)} placeholder="Example Co., Ltd." />
            </div>
            <div>
              <Label>🇨🇳 名称 (ZH)</Label>
              <Input data-testid="input-name-zh" value={form.nameZh} onChange={e => setField("nameZh", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>เลขประจำตัวผู้เสียภาษี</Label>
              <div className="flex gap-1">
                <Input data-testid="input-tax-id" value={form.taxId} onChange={e => setField("taxId", e.target.value)} placeholder="1234567890123"
                  className={taxIdDup.length > 0 ? "border-red-500 focus-visible:ring-red-500" : ""} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={dbdLoading}
                  data-testid="button-dbd-lookup"
                  onClick={handleDbdLookup}
                >
                  {dbdLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {taxIdDup.length > 0 && (
                <p data-testid="text-taxid-duplicate" className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> เลขภาษีนี้มีในระบบแล้ว: {taxIdDup[0].name} ({taxIdDup[0].code})
                </p>
              )}
            </div>
            <div>
              <Label>สาขา</Label>
              <Input data-testid="input-branch" value={form.branch} onChange={e => setField("branch", e.target.value)} placeholder="สำนักงานใหญ่" />
            </div>
          </div>

          {nameDup.length > 0 && (
            <div data-testid="text-name-similar" className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2">
                <AlertTriangle className="h-4 w-4" /> พบคู่ค้าที่มีชื่อคล้ายกัน
              </div>
              <div className="space-y-1">
                {nameDup.slice(0, 5).map(d => (
                  <div key={d.id} className="text-xs text-amber-700 flex items-center gap-2">
                    <span>{d.code}</span>
                    <span>{d.name}</span>
                    {d.nameEn && <span className="text-amber-600">({d.nameEn})</span>}
                    {d.taxId && <span className="text-amber-600">เลขภาษี: {d.taxId}</span>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-600 mt-2">กรุณาตรวจสอบว่าไม่ใช่คู่ค้าเดียวกันก่อนบันทึก</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">ที่อยู่</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>🇹🇭 ที่อยู่</Label>
            <Textarea data-testid="input-address" value={form.address} onChange={e => setField("address", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>🇬🇧 Address (EN)</Label>
              <Textarea data-testid="input-address-en" value={form.addressEn} onChange={e => setField("addressEn", e.target.value)} rows={2} />
            </div>
            <div>
              <Label>🇨🇳 地址 (ZH)</Label>
              <Textarea data-testid="input-address-zh" value={form.addressZh} onChange={e => setField("addressZh", e.target.value)} rows={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">ข้อมูลติดต่อ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>โทรศัพท์</Label>
              <Input data-testid="input-phone" value={form.phone} onChange={e => setField("phone", e.target.value)} placeholder="02-xxx-xxxx" />
            </div>
            <div>
              <Label>อีเมล</Label>
              <Input data-testid="input-email" value={form.email} onChange={e => setField("email", e.target.value)} placeholder="info@example.com" />
            </div>
            <div>
              <Label>ผู้ติดต่อ</Label>
              <Input data-testid="input-contact-person" value={form.contactPerson} onChange={e => setField("contactPerson", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>เครดิต (วัน)</Label>
              <Input data-testid="input-credit-days" type="number" value={form.creditDays} onChange={e => setField("creditDays", Number(e.target.value))} />
            </div>
          </div>

          <div>
            <Label>หมายเหตุ</Label>
            <Textarea data-testid="input-notes" value={form.notes} onChange={e => setField("notes", e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 pb-4">
        <Button data-testid="button-cancel-bottom" variant="outline" onClick={() => navigate("/contacts/list")}>ยกเลิก</Button>
        <Button data-testid="button-save-bottom" className="gap-2" onClick={handleSubmit}
          disabled={createMutation.isPending || updateMutation.isPending || (!editingId && codeDup.length > 0)}>
          <Save className="h-4 w-4" />
          {editingId ? "บันทึก" : "เพิ่มคู่ค้า"}
        </Button>
      </div>
    </div>
  );
});

export default function ContactForm() {
  const { selectedCompanyId } = useCompany();
  const params = useParams<{ id: string }>();
  const editingId = params.id ? Number(params.id) : null;

  return (
    <Layout>
      <ContactFormInner
        editingId={editingId}
        selectedCompanyId={selectedCompanyId}
      />
    </Layout>
  );
}
