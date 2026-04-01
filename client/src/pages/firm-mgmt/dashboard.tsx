import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowUpRight, Plus, Pencil, Trash2, UserCircle, Phone, Mail, FileSpreadsheet, FileText, Upload, Download, AlertCircle, CheckCircle2, FileArchive } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { useShowMore } from "@/hooks/use-show-more";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CHART_TEMPLATES } from "@shared/chart-of-accounts";
import { BUSINESS_TYPES, CHART_TO_BUSINESS_TYPE } from "@shared/accounting-formulas";

function LangRow({ label, fieldBase, values: v, onChange: oc, testId, placeholder }: {
  label: string; fieldBase: string; values: Record<string, any>; onChange: (v: any) => void; testId: string;
  placeholder?: { th?: string; en?: string; zh?: string };
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-1 mt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs w-5 text-center">🇹🇭</span>
          <Input data-testid={`${testId}-th`} value={v[fieldBase] || ""} onChange={e => oc({...v, [fieldBase]: e.target.value})} placeholder={placeholder?.th} className="h-8 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs w-5 text-center">🇬🇧</span>
          <Input data-testid={`${testId}-en`} value={v[`${fieldBase}En`] || ""} onChange={e => oc({...v, [`${fieldBase}En`]: e.target.value})} placeholder={placeholder?.en} className="h-8 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs w-5 text-center">🇨🇳</span>
          <Input data-testid={`${testId}-zh`} value={v[`${fieldBase}Zh`] || ""} onChange={e => oc({...v, [`${fieldBase}Zh`]: e.target.value})} placeholder={placeholder?.zh} className="h-8 text-sm" />
        </div>
      </div>
    </div>
  );
}

const STATUS_MAP: Record<string, string> = {
  synced: "โอนข้อมูลแล้ว",
  pending_sync: "รอดึงข้อมูล",
  pending_review: "รอตรวจสอบ",
  active: "ใช้งาน",
};

const STATUS_COLORS: Record<string, string> = {
  synced: "bg-[#05b187] hover:bg-[#049a75]",
  paid: "bg-[#05b187] hover:bg-[#049a75]",
  pending_sync: "",
  pending_review: "",
  pending: "",
  active: "bg-[#7de3eb] hover:bg-[#6adae3]",
};

const emptyForm = {
  name: "",
  nickname: "",
  nameEn: "",
  nameZh: "",
  branch: "สำนักงานใหญ่",
  branchEn: "",
  branchZh: "",
  ownerName: "",
  ownerNameEn: "",
  ownerNameZh: "",
  chartTemplate: "standard",
  businessType: "mixed",
  contactPerson: "",
  phone: "",
  fax: "",
  email: "",
  website: "",
  taxId: "",
  address: "",
  addressEn: "",
  addressZh: "",
  assignedTo: "none",
  invoiceCount: 0,
  serviceFee: "0",
  whtRate: "3",
  notes: "",
};

export default function FirmManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"skip" | "overwrite" | "replace_all">("skip");
  const [importResult, setImportResult] = useState<{ message: string; imported: number; total: number; errors: string[] } | null>(null);
  const [showImportLogs, setShowImportLogs] = useState(false);
  const [, navigate] = useLocation();
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set());

  const { data: clientsData } = useQuery<any[]>({
    queryKey: ["/api/firm-clients"],
    queryFn: async () => {
      const r = await fetch("/api/firm-clients", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const allClients = Array.isArray(clientsData) ? clientsData : [];
  const clients = useMemo(() => {
    if (!clientSearch) return allClients;
    const s = clientSearch.toLowerCase();
    return allClients.filter((c: any) =>
      (c.name || "").toLowerCase().includes(s) ||
      (c.contactPerson || "").toLowerCase().includes(s) ||
      (c.phone || "").includes(s) ||
      (c.email || "").toLowerCase().includes(s) ||
      (c.taxId || "").includes(s)
    );
  }, [allClients, clientSearch]);

  const { data: employeesData } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const r = await fetch("/api/employees", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const employeesList = Array.isArray(employeesData) ? employeesData.filter((e: any) => e.active) : [];

  const { data: firmStats } = useQuery<any>({
    queryKey: ["/api/firm/stats"],
    queryFn: async () => {
      const r = await fetch("/api/firm/stats", { credentials: "include" });
      if (!r.ok) return {};
      return r.json();
    },
  });

  const [teamMembers, setTeamMembers] = useState<number[]>([]);
  const [editTeamMembers, setEditTeamMembers] = useState<number[]>([]);

  const { data: allTeamsData } = useQuery<any[]>({
    queryKey: ["/api/firm-clients/teams/all"],
    queryFn: async () => {
      const r = await fetch("/api/firm-clients/teams/all", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const allTeams = Array.isArray(allTeamsData) ? allTeamsData : [];

  const { visibleItems: visibleClients, hasMore: hasMoreClients, remainingCount: remainingClients, totalCount: totalClients, showMore: showMoreClients } = useShowMore(clients);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/firm-clients"] });
    queryClient.invalidateQueries({ queryKey: ["/api/firm/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    queryClient.invalidateQueries({ queryKey: ["/api/firm-clients/teams/all"] });
  };

  const saveTeam = async (clientId: number, memberIds: number[]) => {
    await fetch(`/api/firm-clients/${clientId}/team`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeIds: memberIds }),
      credentials: "include",
    });
  };

  const addClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/firm-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          assignedTo: data.assignedTo && data.assignedTo !== "none" ? Number(data.assignedTo) : null,
        }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      const client = await r.json();
      if (teamMembers.length > 0) await saveTeam(client.id, teamMembers);
      return client;
    },
    onSuccess: () => {
      invalidateAll();
      const template = form.chartTemplate;
      setAddOpen(false);
      setForm({ ...emptyForm });
      setTeamMembers([]);
      toast({
        title: "เพิ่มลูกค้าสำเร็จ",
        description: template !== "none" ? "สร้างบริษัทและผังบัญชีมาตรฐานเรียบร้อย" : "สร้างบริษัทเรียบร้อย",
      });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/firm-clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          assignedTo: data.assignedTo && data.assignedTo !== "none" ? Number(data.assignedTo) : null,
        }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      await saveTeam(id, editTeamMembers);
      return r.json();
    },
    onSuccess: () => {
      invalidateAll();
      setEditOpen(false);
      setEditingClient(null);
      setEditTeamMembers([]);
      toast({ title: "อัปเดตลูกค้าสำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/firm-clients/${id}`, { method: "DELETE", credentials: "include" }).then(r => {
      if (!r.ok) return r.json().then(d => { throw new Error(d.message); });
      return r.json();
    }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "ลบลูกค้าสำเร็จ", variant: "success" as any });
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ file, mode }: { file: File; mode: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);
      try {
        const r = await fetch("/api/firm-clients/import", { method: "POST", body: formData, credentials: "include", signal: controller.signal });
        clearTimeout(timeoutId);
        if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
        return r.json();
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") throw new Error("การนำเข้าใช้เวลานานเกินไป กรุณาลองอีกครั้ง หรือลดจำนวนแถวในไฟล์");
        throw err;
      }
    },
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/firm-clients/import-logs"] });
      setImportResult(data);
      setImportFile(null);
      toast({ title: data.message, variant: data.errors?.length > 0 ? "default" : ("success" as any) });
    },
    onError: (err: any) => {
      toast({ title: "นำเข้าไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const { data: importLogs } = useQuery<any[]>({
    queryKey: ["/api/firm-clients/import-logs"],
    queryFn: async () => {
      const r = await fetch("/api/firm-clients/import-logs", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const deduplicateMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/firm-clients/deduplicate", { method: "POST", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      toast({ title: data.message, variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ลบซ้ำไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const cleanupOrphansMutation = useMutation({
    mutationFn: async () => {
      const preview = await fetch("/api/firm-clients/cleanup-orphan-companies?dryRun=true", { method: "POST", credentials: "include" });
      if (!preview.ok) { const d = await preview.json(); throw new Error(d.message); }
      const previewData = await preview.json();
      if (previewData.canDelete === 0 && previewData.skipped === 0) {
        return previewData;
      }
      const safeNames = (previewData.details?.safeToDelete || []).slice(0, 10).map((c: any) => c.name).join("\n  • ");
      const skippedCount = previewData.skipped || 0;
      const msg = `พบบริษัทขยะ ${previewData.canDelete + skippedCount} ราย\n\n✅ ลบได้อย่างปลอดภัย: ${previewData.canDelete} ราย${safeNames ? `\n  • ${safeNames}${previewData.canDelete > 10 ? `\n  ... และอีก ${previewData.canDelete - 10} ราย` : ""}` : ""}\n\n⚠️ ข้าม (มีข้อมูลผูก): ${skippedCount} ราย\n\nต้องการลบจริง ${previewData.canDelete} ราย?`;
      if (!confirm(msg)) throw new Error("ยกเลิกโดยผู้ใช้");
      const r = await fetch("/api/firm-clients/cleanup-orphan-companies", { method: "POST", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: data.message, variant: "success" as any });
    },
    onError: (err: any) => {
      if (err.message === "ยกเลิกโดยผู้ใช้") return;
      toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 300000);
      const r = await fetch("/api/firm-clients/reset-all", { method: "POST", credentials: "include", signal: controller.signal });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: data.message, variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteAllMutation = useMutation({
    mutationFn: async () => {
      const allIds = (clientsData || []).map((c: any) => c.id);
      if (allIds.length === 0) throw new Error("ไม่มีรายการให้ลบ");
      const r = await fetch("/api/firm-clients/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: allIds }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      toast({ title: `ลบลูกค้า ${data.deleted} รายการสำเร็จ`, variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteSelectedMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (ids.length === 0) throw new Error("กรุณาเลือกรายการที่ต้องการลบ");
      const r = await fetch("/api/firm-clients/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      setSelectedClientIds(new Set());
      toast({ title: `ลบลูกค้า ${data.deleted} รายการสำเร็จ` });
    },
    onError: (err: any) => {
      toast({ title: "ลบไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/firm-clients/sync-contacts", { method: "POST", credentials: "include" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      return r.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      toast({ title: data.message, variant: "success" as any });
    },
    onError: (err: any) => {
      toast({ title: "Sync ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleImport = () => {
    if (!importFile) return;
    if (importMode === "replace_all" && !confirm("⚠️ โหมดนี้จะลบลูกค้าเก่าทั้งหมดแล้วนำเข้าใหม่ คุณแน่ใจหรือไม่?")) return;
    setImportResult(null);
    importMutation.mutate({ file: importFile, mode: importMode });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addClientMutation.mutate(form);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    updateClientMutation.mutate({ id: editingClient.id, data: editForm });
  };

  const openEdit = (client: any) => {
    setEditingClient(client);
    setEditForm({
      name: client.name || "",
      nickname: client.nickname || "",
      nameEn: client.nameEn || "",
      nameZh: client.nameZh || "",
      branch: client.branch || "สำนักงานใหญ่",
      branchEn: client.branchEn || "",
      branchZh: client.branchZh || "",
      ownerName: client.ownerName || "",
      ownerNameEn: client.ownerNameEn || "",
      ownerNameZh: client.ownerNameZh || "",
      chartTemplate: client.chartTemplate || "standard",
      businessType: client.businessType || CHART_TO_BUSINESS_TYPE[client.chartTemplate || "standard"] || "mixed",
      contactPerson: client.contactPerson || "",
      phone: client.phone || "",
      fax: client.fax || "",
      email: client.email || "",
      website: client.website || "",
      taxId: client.taxId || "",
      address: client.address || "",
      addressEn: client.addressEn || "",
      addressZh: client.addressZh || "",
      assignedTo: client.assignedTo ? String(client.assignedTo) : "none",
      invoiceCount: client.invoiceCount || 0,
      serviceFee: client.serviceFee || "0",
      whtRate: client.whtRate || "3",
      notes: client.notes || "",
    });
    const clientTeam = allTeams.filter((t: any) => t.firmClientId === client.id).map((t: any) => t.employeeId);
    setEditTeamMembers(clientTeam);
    setEditOpen(true);
  };

  const renderFormFields = (values: typeof emptyForm, onChange: (v: typeof emptyForm) => void, employees: any[], isEdit = false, currentTeam: number[] = [], setCurrentTeam: (ids: number[]) => void = () => {}) => (
    <div className="space-y-4">
      <LangRow label="ชื่อบริษัท *" fieldBase="name" values={values} onChange={onChange} testId="input-client-name" placeholder={{ th: "ชื่อภาษาไทย", en: "Company name (English)", zh: "公司名称（中文）" }} />
      <div>
        <Label>ชื่อเล่น / ชื่อย่อ</Label>
        <Input value={values.nickname} onChange={e => onChange({ ...values, nickname: e.target.value })} placeholder="เช่น คอสเมท, เอเอ็นบี" data-testid="input-client-nickname" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <LangRow label="สาขา" fieldBase="branch" values={values} onChange={onChange} testId="input-branch" placeholder={{ th: "สำนักงานใหญ่", en: "Head office", zh: "总部" }} />
        <LangRow label="ชื่อผู้ประกอบการ" fieldBase="ownerName" values={values} onChange={onChange} testId="input-owner-name" placeholder={{ th: "ชื่อภาษาไทย", en: "Owner name", zh: "负责人姓名" }} />
      </div>
      {!isEdit && (
        <div>
          <Label className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-4 w-4" style={{ color: "#03c9d7" }} />
            ผังบัญชี & สูตรบัญชี
          </Label>
          <Select value={values.chartTemplate} onValueChange={v => {
            const inferred = CHART_TO_BUSINESS_TYPE[v] || "mixed";
            onChange({...values, chartTemplate: v, businessType: inferred});
          }}>
            <SelectTrigger data-testid="select-chart-template">
              <SelectValue placeholder="เลือกรูปแบบผังบัญชี" />
            </SelectTrigger>
            <SelectContent>
              {CHART_TEMPLATES.map(t => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {CHART_TEMPLATES.find(t => t.key === values.chartTemplate)?.description}
          </p>
        </div>
      )}
      <div>
        <Label className="flex items-center gap-1.5">ประเภทธุรกิจ (Tax Point)</Label>
        <Select value={values.businessType} onValueChange={v => onChange({...values, businessType: v})}>
          <SelectTrigger data-testid="select-business-type">
            <SelectValue placeholder="เลือกประเภทธุรกิจ" />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_TYPES.map(t => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {BUSINESS_TYPES.find(t => t.key === values.businessType)?.description}
          {values.businessType === "trading" && " — ใบแจ้งหนี้จะถูกซ่อน (ใช้ใบกำกับภาษีแทน)"}
          {values.businessType === "service" && " — ใบแจ้งหนี้ลงบัญชี VAT ยังไม่ถึงกำหนด"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>เลขประจำตัวผู้เสียภาษี</Label>
          <Input data-testid="input-client-taxid" value={values.taxId} onChange={e => onChange({...values, taxId: e.target.value})} placeholder="13 หลัก" />
        </div>
        <div>
          <Label>ผู้ติดต่อ</Label>
          <Input data-testid="input-contact-person" value={values.contactPerson} onChange={e => onChange({...values, contactPerson: e.target.value})} />
        </div>
      </div>
      <div>
        <Label>ที่อยู่</Label>
        <div className="space-y-1 mt-1">
          <div className="flex items-start gap-1.5">
            <span className="text-xs w-5 text-center mt-2">🇹🇭</span>
            <Textarea data-testid="input-address-th" value={values.address} onChange={e => onChange({...values, address: e.target.value})} rows={2} className="text-sm" />
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-xs w-5 text-center mt-2">🇬🇧</span>
            <Textarea data-testid="input-address-en" value={values.addressEn} onChange={e => onChange({...values, addressEn: e.target.value})} rows={2} className="text-sm" placeholder="Address (English)" />
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-xs w-5 text-center mt-2">🇨🇳</span>
            <Textarea data-testid="input-address-zh" value={values.addressZh} onChange={e => onChange({...values, addressZh: e.target.value})} rows={2} className="text-sm" placeholder="地址（中文）" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>เบอร์โทร</Label>
          <Input data-testid="input-phone" value={values.phone} onChange={e => onChange({...values, phone: e.target.value})} />
        </div>
        <div>
          <Label>แฟกซ์</Label>
          <Input data-testid="input-fax" value={values.fax} onChange={e => onChange({...values, fax: e.target.value})} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>อีเมล</Label>
          <Input data-testid="input-email" type="email" value={values.email} onChange={e => onChange({...values, email: e.target.value})} />
        </div>
        <div>
          <Label>เว็บไซต์</Label>
          <Input data-testid="input-website" value={values.website} onChange={e => onChange({...values, website: e.target.value})} placeholder="www.example.com" />
        </div>
      </div>
      <div>
        <Label>พนักงานผู้ดูแลหลัก</Label>
        <Select value={values.assignedTo} onValueChange={v => onChange({...values, assignedTo: v})}>
          <SelectTrigger data-testid="select-assigned-employee">
            <SelectValue placeholder="เลือกพนักงานผู้ดูแลหลัก" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- ไม่ระบุ --</SelectItem>
            {employees.map((emp: any) => (
              <SelectItem key={emp.id} value={String(emp.id)}>
                {emp.fullName} ({emp.position || emp.employeeCode})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">รับผิดชอบงานรายเดือน</p>
      </div>
      <div>
        <Label>ทีมงาน (เข้าถึงได้หลายคน)</Label>
        <div className="border rounded-lg p-2 mt-1 max-h-40 overflow-y-auto space-y-1">
          {employees.length > 0 ? employees.map((emp: any) => (
            <label key={emp.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer" data-testid={`team-checkbox-${emp.id}`}>
              <input
                type="checkbox"
                checked={currentTeam.includes(emp.id)}
                onChange={(e) => {
                  if (e.target.checked) setCurrentTeam([...currentTeam, emp.id]);
                  else setCurrentTeam(currentTeam.filter(id => id !== emp.id));
                }}
                className="rounded border-gray-300 accent-[#fb9678]"
              />
              <span className="text-sm">{emp.fullName}</span>
              <span className="text-xs text-muted-foreground">({emp.position || emp.employeeCode})</span>
            </label>
          )) : (
            <p className="text-xs text-muted-foreground text-center py-2">ยังไม่มีพนักงาน</p>
          )}
        </div>
        {currentTeam.length > 0 && (
          <p className="text-xs mt-1" style={{ color: "#03c9d7" }}>เลือกแล้ว {currentTeam.length} คน</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">เช่น คนปิดงบ, หัวหน้าทีม, ผู้ตรวจสอบ</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>จำนวนใบกำกับ/เดือน</Label>
          <Input data-testid="input-invoice-count" type="number" value={values.invoiceCount} onChange={e => onChange({...values, invoiceCount: Number(e.target.value)})} />
        </div>
        <div>
          <Label>ค่าบริการ (฿/เดือน)</Label>
          <Input data-testid="input-service-fee" type="number" value={values.serviceFee} onChange={e => onChange({...values, serviceFee: e.target.value})} />
        </div>
        <div>
          <Label>หัก ณ ที่จ่าย (%)</Label>
          <Input data-testid="input-wht-rate" type="number" step="0.5" value={values.whtRate} onChange={e => onChange({...values, whtRate: e.target.value})} placeholder="3" />
        </div>
      </div>
      <div>
        <Label>หมายเหตุ</Label>
        <Textarea data-testid="input-notes" value={values.notes} onChange={e => onChange({...values, notes: e.target.value})} rows={2} placeholder="รายละเอียดเพิ่มเติม..." />
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6" style={{ color: "#03c9d7" }} />
            <h1 className="text-2xl font-bold" data-testid="text-firm-title">บริหารจัดการสำนักงานบัญชี</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
          {selectedClientIds.size > 0 && (
            <Button
              variant="outline"
              className="border-red-400 text-red-500 hover:bg-red-50"
              data-testid="button-bulk-delete-selected"
              disabled={bulkDeleteSelectedMutation.isPending}
              onClick={() => {
                if (confirm(`ต้องการลบลูกค้าที่เลือก ${selectedClientIds.size} รายการ?\n\n⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
                  bulkDeleteSelectedMutation.mutate(Array.from(selectedClientIds));
                }
              }}
            >
              {bulkDeleteSelectedMutation.isPending ? "กำลังลบ..." : `ลบที่เลือก (${selectedClientIds.size})`}
            </Button>
          )}
          <Button
            variant="outline"
            className="border-[#03c9d7] text-[#03c9d7] hover:bg-cyan-50"
            data-testid="button-sync-contacts"
            disabled={syncContactsMutation.isPending}
            onClick={async () => {
              try {
                const r = await fetch("/api/firm-clients/sync-contacts/preview", { credentials: "include" });
                if (!r.ok) { const d = await r.json(); alert(d.message); return; }
                const preview = await r.json();
                if (preview.willCreate === 0 && preview.willLink === 0) {
                  alert("ไม่มีรายการที่ต้อง Sync — ข้อมูลเป็นปัจจุบันแล้ว");
                  return;
                }
                if (confirm(`📊 Preview Sync:\n\n• ลูกค้าสำนักงานปัจจุบัน: ${preview.existingFirmClients} ราย\n• คู่ค้าปัจจุบัน: ${preview.existingContacts} ราย\n\n➡️ จะสร้างลูกค้าใหม่: ${preview.willCreate} ราย\n➡️ จะเชื่อมโยง: ${preview.willLink} ราย\n\n⏳ อาจใช้เวลาสักครู่ — ดำเนินการ?`)) {
                  syncContactsMutation.mutate();
                }
              } catch (err: any) {
                alert("เกิดข้อผิดพลาด: " + err.message);
              }
            }}
          >
            {syncContactsMutation.isPending ? "กำลัง Sync..." : "Sync คู่ค้า"}
          </Button>
          <Button
            variant="outline"
            className="border-amber-500 text-amber-600 hover:bg-amber-50"
            data-testid="button-deduplicate"
            disabled={deduplicateMutation.isPending}
            onClick={() => {
              if (confirm("ลบรายการซ้ำ — ระบบจะตรวจสอบชื่อลูกค้าที่ซ้ำกัน แล้วลบรายการซ้ำออก (เก็บรายการแรกไว้)\n\nดำเนินการ?")) {
                deduplicateMutation.mutate();
              }
            }}
          >
            {deduplicateMutation.isPending ? "กำลังลบซ้ำ..." : "ลบรายการซ้ำ"}
          </Button>
          <Button
            variant="outline"
            className="border-red-400 text-red-500 hover:bg-red-50"
            data-testid="button-cleanup-orphans"
            disabled={cleanupOrphansMutation.isPending}
            onClick={() => cleanupOrphansMutation.mutate()}
          >
            {cleanupOrphansMutation.isPending ? "กำลังลบ..." : "ลบบริษัทขยะ"}
          </Button>
          <Button
            variant="outline"
            className="border-red-600 text-red-700 hover:bg-red-50"
            data-testid="button-reset-all"
            disabled={resetAllMutation.isPending}
            onClick={() => {
              const total = clientsData?.length || 0;
              if (confirm(`⚠️ ลบลูกค้าทั้งหมด ${total} ราย\n\nจะลบ firm_clients + บริษัท + ผังบัญชี + รายชื่อคู่ค้า ออกทั้งหมด\n\n⚠️ ลบแล้วกู้คืนไม่ได้ — ดำเนินการ?`)) {
                resetAllMutation.mutate();
              }
            }}
          >
            {resetAllMutation.isPending ? "กำลังลบทั้งหมด..." : "ลบลูกค้าทั้งหมด"}
          </Button>
          <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportFile(null); setImportResult(null); setImportMode("skip"); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-[#fb9678] text-[#fb9678] hover:bg-[#fb9678]/10" data-testid="button-import-clients">
                <Upload className="mr-2 h-4 w-4" /> นำเข้าจาก Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" style={{ color: "#03c9d7" }} />
                  นำเข้ารายชื่อลูกค้าจาก Excel
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800 mb-2">ดาวน์โหลดไฟล์ตัวอย่างเพื่อดูรูปแบบที่ถูกต้อง แล้วกรอกข้อมูลลูกค้าลงไป</p>
                  <a href="/api/firm-clients/import/template" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900" data-testid="link-download-template">
                    <Download className="h-4 w-4" /> ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)
                  </a>
                </div>
                <div>
                  <Label>เลือกไฟล์ Excel (.xlsx)</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    data-testid="input-import-file"
                    className="mt-1"
                    onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
                  />
                  {importFile && <p className="text-xs text-muted-foreground mt-1">{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>}
                </div>
                <div>
                  <Label className="mb-2 block">โหมดนำเข้า</Label>
                  <div className="space-y-2">
                    {([
                      { value: "skip", label: "ข้ามซ้ำ", desc: "ถ้าชื่อบริษัทซ้ำ จะข้ามแถวนั้นไป", color: "text-green-700", bg: "bg-green-50 border-green-200" },
                      { value: "overwrite", label: "เขียนทับค่าใหม่", desc: "ถ้าชื่อซ้ำ จะอัปเดตข้อมูลจากไฟล์ใหม่ทับข้อมูลเดิม", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
                      { value: "replace_all", label: "ล้างและนำเข้าใหม่ทั้งหมด", desc: "⚠️ ลบลูกค้าเดิมทั้งหมดแล้วนำเข้าจากไฟล์ใหม่", color: "text-red-700", bg: "bg-red-50 border-red-200" },
                    ] as const).map(opt => (
                      <label key={opt.value} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${importMode === opt.value ? opt.bg : "bg-white border-gray-200 hover:bg-gray-50"}`} data-testid={`radio-import-mode-${opt.value}`}>
                        <input type="radio" name="importMode" value={opt.value} checked={importMode === opt.value} onChange={() => setImportMode(opt.value)} className="mt-0.5" />
                        <div>
                          <span className={`text-sm font-medium ${importMode === opt.value ? opt.color : "text-gray-900"}`}>{opt.label}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                {importResult && (
                  <div className={`rounded-lg p-3 ${importResult.errors.length > 0 ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {importResult.errors.length > 0 ? <AlertCircle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      <span className={`text-sm font-medium ${importResult.errors.length > 0 ? "text-amber-800" : "text-green-800"}`} data-testid="text-import-result">{importResult.message}</span>
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        {importResult.errors.map((err: string, i: number) => (
                          <p key={i} className="text-xs text-amber-700">{err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Button
                  className="w-full text-white hover:opacity-90"
                  style={{ background: importMode === "replace_all" ? "#f94d4d" : "#fb9678" }}
                  data-testid="button-submit-import"
                  disabled={!importFile || importMutation.isPending}
                  onClick={handleImport}
                >
                  {importMutation.isPending ? "กำลังนำเข้า..." : importMode === "replace_all" ? "ล้างและนำเข้าใหม่" : "นำเข้าข้อมูล"}
                </Button>
                <button type="button" onClick={() => { setImportOpen(false); setShowImportLogs(true); }} className="w-full text-center text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" data-testid="link-import-logs">
                  ดูประวัติการนำเข้า
                </button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showImportLogs} onOpenChange={setShowImportLogs}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileArchive className="h-5 w-5" style={{ color: "var(--theme-primary)" }} />
                  ประวัติการนำเข้าข้อมูล
                </DialogTitle>
              </DialogHeader>
              {(!importLogs || importLogs.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีประวัติการนำเข้า</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่/เวลา</TableHead>
                      <TableHead>ผู้นำเข้า</TableHead>
                      <TableHead>ไฟล์</TableHead>
                      <TableHead>โหมด</TableHead>
                      <TableHead className="text-right">ผลลัพธ์</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importLogs.map((log: any) => {
                      const modeMap: Record<string, { label: string; color: string }> = {
                        skip: { label: "ข้ามซ้ำ", color: "bg-green-100 text-green-800" },
                        overwrite: { label: "เขียนทับ", color: "bg-blue-100 text-blue-800" },
                        replace_all: { label: "ล้างใหม่", color: "bg-red-100 text-red-800" },
                      };
                      const m = modeMap[log.mode] || { label: log.mode, color: "bg-gray-100 text-gray-800" };
                      const d = log.createdAt ? new Date(log.createdAt) : null;
                      const dateStr = d ? `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear() + 543} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}` : "-";
                      const parts: string[] = [];
                      if (log.imported > 0) parts.push(`สร้าง ${log.imported}`);
                      if (log.updated > 0) parts.push(`อัปเดต ${log.updated}`);
                      if (log.skipped > 0) parts.push(`ข้าม ${log.skipped}`);
                      if (log.deleted > 0) parts.push(`ลบ ${log.deleted}`);
                      if (log.errorCount > 0) parts.push(`ผิดพลาด ${log.errorCount}`);
                      return (
                        <TableRow key={log.id} data-testid={`row-import-log-${log.id}`}>
                          <TableCell className="text-sm whitespace-nowrap">{dateStr}</TableCell>
                          <TableCell className="text-sm">{log.userName || "-"}</TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate" title={log.fileName}>{log.fileName || "-"}</TableCell>
                          <TableCell><Badge className={`${m.color} text-xs`}>{m.label}</Badge></TableCell>
                          <TableCell className="text-right text-sm">
                            <span className="text-muted-foreground">{log.totalRows} แถว → </span>
                            {parts.join(", ") || "ไม่มีการเปลี่ยนแปลง"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </DialogContent>
          </Dialog>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="text-white hover:opacity-90" style={{ background: "#03c9d7" }} data-testid="button-add-client">
                <Plus className="mr-2 h-4 w-4" /> เพิ่มลูกค้า
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd}>
                {renderFormFields(form, setForm, employeesList, false, teamMembers, setTeamMembers)}
                <Button type="submit" className="w-full mt-4 text-white hover:opacity-90" style={{ background: "#03c9d7" }} data-testid="button-submit-client" disabled={addClientMutation.isPending}>
                  {addClientMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border" style={{ background: "#e5f9fa", borderColor: "#03c9d7" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: "#03c9d7" }}>รายได้ค่าบริการรวมเดือนนี้</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-firm-revenue" style={{ color: "#027a84" }}>
                ฿{Number(firmStats?.totalRevenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 0 })}
              </div>
              <p className="text-xs mt-1 flex items-center" style={{ color: "#03c9d7" }}>
                <ArrowUpRight className="h-3 w-3 mr-1" /> +8.4% จากเดือนที่แล้ว
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">จำนวนใบกำกับที่ประมวลผล</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-firm-invoices">{(firmStats?.totalInvoices || 0).toLocaleString()} ใบ</div>
              <p className="text-xs text-muted-foreground mt-1">จากลูกค้าทั้งหมด {firmStats?.totalClients || 0} ราย</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">งานที่รอการตรวจสอบ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600" data-testid="text-firm-pending">{firmStats?.pendingReview || 0} ราย</div>
              <p className="text-xs text-muted-foreground mt-1">ต้องการการยืนยันข้อมูล</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>สถานะงานและค่าบริการรายลูกค้า</CardTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาลูกค้า..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-9 h-9 w-56 text-sm"
                  data-testid="input-search-client"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 h-4 w-4 cursor-pointer accent-[#fb9678]"
                      checked={visibleClients.length > 0 && visibleClients.every((c: any) => selectedClientIds.has(c.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedClientIds(new Set(visibleClients.map((c: any) => c.id)));
                        } else {
                          setSelectedClientIds(new Set());
                        }
                      }}
                      data-testid="checkbox-select-all-clients"
                    />
                  </TableHead>
                  <TableHead>ชื่อลูกค้า</TableHead>
                  <TableHead>ผู้ติดต่อ</TableHead>
                  <TableHead>ผู้ดูแล / ทีมงาน</TableHead>
                  <TableHead className="text-right">ใบกำกับ</TableHead>
                  <TableHead className="text-right">ค่าบริการ</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleClients.map((client: any) => (
                  <TableRow key={client.id} data-testid={`row-client-${client.id}`} className={selectedClientIds.has(client.id) ? "bg-red-50/50" : ""}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 h-4 w-4 cursor-pointer accent-[#fb9678]"
                        checked={selectedClientIds.has(client.id)}
                        onChange={(e) => {
                          const next = new Set(selectedClientIds);
                          if (e.target.checked) next.add(client.id); else next.delete(client.id);
                          setSelectedClientIds(next);
                        }}
                        data-testid={`checkbox-client-${client.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div title={client.name}>{client.nickname || client.name}</div>
                        {client.nickname && (
                          <div className="text-xs text-muted-foreground mt-0.5">{client.name}</div>
                        )}
                        {client.branch && (
                          <div className="text-xs text-muted-foreground mt-0.5">{client.branch}</div>
                        )}
                        {client.email && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" /> {client.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{client.contactPerson || "-"}</div>
                        {client.phone && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" /> {client.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {(client.assignedEmployeeName || client.assignedEmployeeFullName) ? (
                          <div className="flex items-center gap-1.5">
                            <UserCircle className="h-4 w-4" style={{ color: "#fb9678" }} />
                            <span className="text-sm font-medium" title={client.assignedEmployeeFullName}>{client.assignedEmployeeName || client.assignedEmployeeFullName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">ยังไม่ได้มอบหมาย</span>
                        )}
                        {(() => {
                          const clientTeamMembers = allTeams.filter((t: any) => t.firmClientId === client.id);
                          if (clientTeamMembers.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1">
                              {clientTeamMembers.map((m: any) => (
                                <Badge key={m.employeeId} variant="outline" className="text-[10px] py-0 px-1.5 font-normal" style={{ borderColor: "#03c9d7", color: "#03c9d7" }} title={m.fullName}>
                                  {m.nickname || m.fullName}
                                </Badge>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{(client.invoiceCount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold" style={{ color: "#03c9d7" }}>฿{Number(client.serviceFee || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={["synced", "paid"].includes(client.status) ? "default" : "outline"} 
                        className={STATUS_COLORS[client.status] || ""}
                      >
                        {STATUS_MAP[client.status] || client.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 hover:opacity-80"
                          style={{ color: "#05b187" }}
                          onClick={() => navigate(`/line-document-archive?firmClientId=${client.id}&name=${encodeURIComponent(client.name)}`)}
                          data-testid={`button-line-docs-client-${client.id}`}
                        >
                          <FileArchive className="h-3.5 w-3.5 mr-1" /> เอกสาร LINE
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 hover:opacity-80"
                          style={{ color: "#fb9678" }}
                          onClick={() => navigate(`/firm-mgmt/contracts?clientId=${client.id}`)}
                          data-testid={`button-contract-client-${client.id}`}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" /> สัญญา
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 hover:opacity-80"
                          style={{ color: "#03c9d7" }}
                          onClick={() => openEdit(client)}
                          data-testid={`button-edit-client-${client.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" /> แก้ไข
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-rose-500 hover:text-rose-700 h-8"
                          onClick={() => deleteClientMutation.mutate(client.id)}
                          data-testid={`button-delete-client-${client.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> ลบ
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      ยังไม่มีข้อมูลลูกค้า กดปุ่ม "เพิ่มลูกค้า" เพื่อเริ่มต้น
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {hasMoreClients && (
              <div className="text-center py-3 border-t">
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); showMoreClients(); }} className="text-sm font-medium hover:opacity-80 hover:underline cursor-pointer py-1 px-3" style={{ color: "var(--theme-primary)" }} data-testid="button-show-more">
                  แสดงเพิ่มเติม ({remainingClients} รายการ)
                </button>
              </div>
            )}
            {!hasMoreClients && totalClients > 50 && (
              <div className="text-center py-2 text-xs text-muted-foreground">
                แสดงทั้งหมด {totalClients} รายการ
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>แก้ไขข้อมูลลูกค้า: {editingClient?.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit}>
              {renderFormFields(editForm, setEditForm, employeesList, true, editTeamMembers, setEditTeamMembers)}
              <Button type="submit" className="w-full mt-4 text-white hover:opacity-90" style={{ background: "#03c9d7" }} data-testid="button-submit-edit-client" disabled={updateClientMutation.isPending}>
                {updateClientMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
