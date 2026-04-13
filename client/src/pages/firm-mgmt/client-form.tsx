import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft, FileSpreadsheet, Server } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
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
          <span className="text-xs w-5 text-center">TH</span>
          <Input data-testid={`${testId}-th`} value={v[fieldBase] || ""} onChange={e => oc({...v, [fieldBase]: e.target.value})} placeholder={placeholder?.th} className="h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs w-5 text-center">EN</span>
          <Input data-testid={`${testId}-en`} value={v[`${fieldBase}En`] || ""} onChange={e => oc({...v, [`${fieldBase}En`]: e.target.value})} placeholder={placeholder?.en} className="h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs w-5 text-center">ZH</span>
          <Input data-testid={`${testId}-zh`} value={v[`${fieldBase}Zh`] || ""} onChange={e => oc({...v, [`${fieldBase}Zh`]: e.target.value})} placeholder={placeholder?.zh} className="h-9 text-sm" />
        </div>
      </div>
    </div>
  );
}

const emptyForm = {
  name: "", nickname: "", nameEn: "", nameZh: "",
  branch: "สำนักงานใหญ่", branchEn: "", branchZh: "",
  ownerName: "", ownerNameEn: "", ownerNameZh: "",
  chartTemplate: "standard", businessType: "mixed",
  contactPerson: "", phone: "", fax: "", email: "", website: "",
  taxId: "", address: "", addressEn: "", addressZh: "",
  assignedTo: "none", invoiceCount: 0, serviceFee: "0", whtRate: "3",
  notes: "", targetDbMachineId: "none",
};

export default function ClientForm() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/firm-mgmt/clients/:id/edit");
  const editId = params?.id ? Number(params.id) : null;
  const isEdit = !!editId;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { primaryCompanyId, selectedCompanyId } = useCompany();
  const firmCompanyId = primaryCompanyId || selectedCompanyId;

  const [form, setForm] = useState({ ...emptyForm });
  const [teamMembers, setTeamMembers] = useState<number[]>([]);

  const { data: employeesData } = useQuery<any[]>({
    queryKey: ["/api/employees", firmCompanyId],
    queryFn: async () => {
      const url = firmCompanyId ? `/api/employees?companyId=${firmCompanyId}` : "/api/employees";
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!firmCompanyId,
  });
  const employees = Array.isArray(employeesData) ? employeesData.filter((e: any) => e.active) : [];

  const { data: dbServersData } = useQuery({
    queryKey: ["/api/firm-clients/db-servers"],
    queryFn: async () => {
      const r = await fetch("/api/firm-clients/db-servers", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const dbServers: any[] = Array.isArray(dbServersData) ? dbServersData : [];

  const { data: allTeamsData } = useQuery<any[]>({
    queryKey: ["/api/firm-clients/teams/all"],
    queryFn: async () => {
      const r = await fetch("/api/firm-clients/teams/all", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: isEdit,
  });

  const { data: editClient } = useQuery<any>({
    queryKey: ["/api/firm-clients", editId],
    queryFn: async () => {
      const r = await fetch("/api/firm-clients", { credentials: "include" });
      if (!r.ok) return null;
      const all = await r.json();
      return Array.isArray(all) ? all.find((c: any) => c.id === editId) : null;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (editClient) {
      setForm({
        name: editClient.name || "",
        nickname: editClient.nickname || "",
        nameEn: editClient.nameEn || "",
        nameZh: editClient.nameZh || "",
        branch: editClient.branch || "สำนักงานใหญ่",
        branchEn: editClient.branchEn || "",
        branchZh: editClient.branchZh || "",
        ownerName: editClient.ownerName || "",
        ownerNameEn: editClient.ownerNameEn || "",
        ownerNameZh: editClient.ownerNameZh || "",
        chartTemplate: editClient.chartTemplate || "standard",
        businessType: editClient.businessType || CHART_TO_BUSINESS_TYPE[editClient.chartTemplate || "standard"] || "mixed",
        contactPerson: editClient.contactPerson || "",
        phone: editClient.phone || "",
        fax: editClient.fax || "",
        email: editClient.email || "",
        website: editClient.website || "",
        taxId: editClient.taxId || "",
        address: editClient.address || "",
        addressEn: editClient.addressEn || "",
        addressZh: editClient.addressZh || "",
        assignedTo: editClient.assignedTo ? String(editClient.assignedTo) : "none",
        invoiceCount: editClient.invoiceCount || 0,
        serviceFee: editClient.serviceFee || "0",
        whtRate: editClient.whtRate || "3",
        notes: editClient.notes || "",
        targetDbMachineId: editClient.targetDbMachineId ? String(editClient.targetDbMachineId) : "none",
      });
      const teams = Array.isArray(allTeamsData) ? allTeamsData : [];
      setTeamMembers(teams.filter((t: any) => t.firmClientId === editId).map((t: any) => t.employeeId));
    }
  }, [editClient, allTeamsData, editId]);

  const saveTeam = async (clientId: number, memberIds: number[]) => {
    await fetch(`/api/firm-clients/${clientId}/team`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeIds: memberIds }),
      credentials: "include",
    });
  };

  const preparePayload = (data: any) => ({
    ...data,
    assignedTo: data.assignedTo && data.assignedTo !== "none" ? Number(data.assignedTo) : null,
    targetDbMachineId: data.targetDbMachineId && data.targetDbMachineId !== "none" ? Number(data.targetDbMachineId) : null,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = isEdit ? `/api/firm-clients/${editId}` : "/api/firm-clients";
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preparePayload(data)),
        credentials: "include",
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.message); }
      const client = await r.json();
      const clientId = isEdit ? editId! : client.id;
      if (teamMembers.length > 0) await saveTeam(clientId, teamMembers);
      return client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-clients/teams/all"] });
      toast({ title: isEdit ? "อัปเดตลูกค้าสำเร็จ" : "เพิ่มลูกค้าสำเร็จ" });
      navigate("/firm-mgmt/clients");
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <Layout>
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/firm-mgmt/clients")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <Building2 className="h-5 w-5" style={{ color: "#03c9d7" }} />
          <h1 className="text-xl font-bold" data-testid="text-form-title">
            {isEdit ? `แก้ไขข้อมูลลูกค้า: ${editClient?.name || ""}` : "เพิ่มลูกค้าใหม่"}
          </h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="border-b pb-4">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "#03c9d7" }}>ข้อมูลบริษัท</h2>
                <div className="space-y-4">
                  <LangRow label="ชื่อบริษัท *" fieldBase="name" values={form} onChange={setForm} testId="input-client-name" placeholder={{ th: "ชื่อภาษาไทย", en: "Company name (English)", zh: "公司名称（中文）" }} />
                  <div>
                    <Label>ชื่อเล่น / ชื่อย่อ</Label>
                    <Input value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} placeholder="เช่น คอสเมท, เอเอ็นบี" data-testid="input-client-nickname" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <LangRow label="สาขา" fieldBase="branch" values={form} onChange={setForm} testId="input-branch" placeholder={{ th: "สำนักงานใหญ่", en: "Head office", zh: "总部" }} />
                    <LangRow label="ชื่อผู้ประกอบการ" fieldBase="ownerName" values={form} onChange={setForm} testId="input-owner-name" placeholder={{ th: "ชื่อภาษาไทย", en: "Owner name", zh: "负责人姓名" }} />
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "#03c9d7" }}>การตั้งค่าบัญชี</h2>
                <div className="space-y-4">
                  {!isEdit && (
                    <div>
                      <Label className="flex items-center gap-1.5">
                        <FileSpreadsheet className="h-4 w-4" style={{ color: "#03c9d7" }} />
                        ผังบัญชี & สูตรบัญชี
                      </Label>
                      <Select value={form.chartTemplate} onValueChange={v => {
                        const inferred = CHART_TO_BUSINESS_TYPE[v] || "mixed";
                        setForm({...form, chartTemplate: v, businessType: inferred});
                      }}>
                        <SelectTrigger data-testid="select-chart-template">
                          <SelectValue placeholder="เลือกรูปแบบผังบัญชี" />
                        </SelectTrigger>
                        <SelectContent>
                          {CHART_TEMPLATES.map(t => (
                            <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {CHART_TEMPLATES.find(t => t.key === form.chartTemplate)?.description}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label>ประเภทธุรกิจ (Tax Point)</Label>
                    <Select value={form.businessType} onValueChange={v => setForm({...form, businessType: v})}>
                      <SelectTrigger data-testid="select-business-type">
                        <SelectValue placeholder="เลือกประเภทธุรกิจ" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map(t => (
                          <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {BUSINESS_TYPES.find(t => t.key === form.businessType)?.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "#03c9d7" }}>ข้อมูลติดต่อ</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>เลขประจำตัวผู้เสียภาษี</Label>
                      <Input data-testid="input-client-taxid" value={form.taxId} onChange={e => setForm({...form, taxId: e.target.value})} placeholder="13 หลัก" />
                    </div>
                    <div>
                      <Label>ผู้ติดต่อ</Label>
                      <Input data-testid="input-contact-person" value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <Label>ที่อยู่</Label>
                    <div className="space-y-1 mt-1">
                      <div className="flex items-start gap-1.5">
                        <span className="text-xs w-5 text-center mt-2">TH</span>
                        <Textarea data-testid="input-address-th" value={form.address} onChange={e => setForm({...form, address: e.target.value})} rows={2} className="text-sm" />
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-xs w-5 text-center mt-2">EN</span>
                        <Textarea data-testid="input-address-en" value={form.addressEn} onChange={e => setForm({...form, addressEn: e.target.value})} rows={2} className="text-sm" placeholder="Address (English)" />
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-xs w-5 text-center mt-2">ZH</span>
                        <Textarea data-testid="input-address-zh" value={form.addressZh} onChange={e => setForm({...form, addressZh: e.target.value})} rows={2} className="text-sm" placeholder="地址（中文）" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>เบอร์โทร</Label>
                      <Input data-testid="input-phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                    </div>
                    <div>
                      <Label>แฟกซ์</Label>
                      <Input data-testid="input-fax" value={form.fax} onChange={e => setForm({...form, fax: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>อีเมล</Label>
                      <Input data-testid="input-email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                    </div>
                    <div>
                      <Label>เว็บไซต์</Label>
                      <Input data-testid="input-website" value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="www.example.com" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "#03c9d7" }}>ผู้ดูแลและทีมงาน</h2>
                <div className="space-y-4">
                  <div>
                    <Label>พนักงานผู้ดูแลหลัก</Label>
                    <Select value={form.assignedTo} onValueChange={v => setForm({...form, assignedTo: v})}>
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
                    <div className="border rounded-lg p-2 mt-1 max-h-48 overflow-y-auto space-y-1">
                      {employees.length > 0 ? employees.map((emp: any) => (
                        <label key={emp.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer" data-testid={`team-checkbox-${emp.id}`}>
                          <input
                            type="checkbox"
                            checked={teamMembers.includes(emp.id)}
                            onChange={(e) => {
                              if (e.target.checked) setTeamMembers([...teamMembers, emp.id]);
                              else setTeamMembers(teamMembers.filter(id => id !== emp.id));
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
                    {teamMembers.length > 0 && (
                      <p className="text-xs mt-1" style={{ color: "#03c9d7" }}>เลือกแล้ว {teamMembers.length} คน</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "#03c9d7" }}>ค่าบริการ</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>จำนวนใบกำกับ/เดือน</Label>
                    <Input data-testid="input-invoice-count" type="number" value={form.invoiceCount} onChange={e => setForm({...form, invoiceCount: Number(e.target.value)})} />
                  </div>
                  <div>
                    <Label>ค่าบริการ (฿/เดือน)</Label>
                    <Input data-testid="input-service-fee" type="number" value={form.serviceFee} onChange={e => setForm({...form, serviceFee: e.target.value})} />
                  </div>
                  <div>
                    <Label>หัก ณ ที่จ่าย (%)</Label>
                    <Input data-testid="input-wht-rate" type="number" step="0.5" value={form.whtRate} onChange={e => setForm({...form, whtRate: e.target.value})} placeholder="3" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>หมายเหตุ</Label>
                  <Textarea data-testid="input-notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="รายละเอียดเพิ่มเติม..." />
                </div>
                {dbServers.length > 0 && (
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Server className="h-4 w-4" style={{ color: "#03c9d7" }} />
                      เซิร์ฟเวอร์เก็บข้อมูล
                    </Label>
                    <Select value={form.targetDbMachineId} onValueChange={v => setForm({...form, targetDbMachineId: v})}>
                      <SelectTrigger data-testid="select-target-db-server">
                        <SelectValue placeholder="เลือกเซิร์ฟเวอร์" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- เซิร์ฟเวอร์หลัก (ค่าเริ่มต้น) --</SelectItem>
                        {dbServers.map((sv: any) => (
                          <SelectItem key={sv.id} value={String(sv.id)}>
                            {sv.displayName || sv.localName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">กำหนดเซิร์ฟเวอร์ฐานข้อมูลสำหรับเก็บข้อมูลลูกค้ารายนี้</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1 text-white hover:opacity-90" style={{ background: "#03c9d7" }} data-testid="button-submit-client" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/firm-mgmt/clients")} data-testid="button-cancel">
                  ยกเลิก
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
