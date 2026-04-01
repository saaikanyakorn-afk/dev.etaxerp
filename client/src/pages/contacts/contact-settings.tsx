import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

export default function ContactSettings() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [autoCode, setAutoCode] = useState(true);
  const [codePrefix, setCodePrefix] = useState("C");
  const [codeDigits, setCodeDigits] = useState("4");
  const [defaultType, setDefaultType] = useState("customer");
  const [defaultCredit, setDefaultCredit] = useState("30");

  const { data: settings } = useQuery({
    queryKey: ["/api/contacts/settings", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/contacts/settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (settings) {
      setAutoCode(settings.autoCode ?? true);
      setCodePrefix(settings.codePrefix ?? "C");
      setCodeDigits(String(settings.codeDigits ?? 4));
      setDefaultType(settings.defaultType ?? "customer");
      setDefaultCredit(String(settings.defaultCreditDays ?? 30));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/contacts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyId: selectedCompanyId,
          autoCode,
          codePrefix,
          codeDigits: Number(codeDigits),
          defaultType,
          defaultCreditDays: Number(defaultCredit),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/settings"] });
      toast({ title: "บันทึกการตั้งค่าเรียบร้อย" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">ตั้งค่าประวัติ</h1>
          </div>
          <Button data-testid="button-save" className="gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" /> บันทึก
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">รหัสคู่ค้าอัตโนมัติ</CardTitle>
              <CardDescription>ตั้งค่าการสร้างรหัสคู่ค้าอัตโนมัติเมื่อเพิ่มคู่ค้าใหม่</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>เปิดใช้รหัสอัตโนมัติ</Label>
                <Switch data-testid="switch-auto-code" checked={autoCode} onCheckedChange={setAutoCode} />
              </div>
              {autoCode && (
                <>
                  <div>
                    <Label>คำนำหน้ารหัส</Label>
                    <Input data-testid="input-code-prefix" value={codePrefix} onChange={e => setCodePrefix(e.target.value)} placeholder="C" />
                  </div>
                  <div>
                    <Label>จำนวนหลักตัวเลข</Label>
                    <Select value={codeDigits} onValueChange={setCodeDigits}>
                      <SelectTrigger data-testid="select-code-digits">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 หลัก (C001)</SelectItem>
                        <SelectItem value="4">4 หลัก (C0001)</SelectItem>
                        <SelectItem value="5">5 หลัก (C00001)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ตัวอย่าง: {codePrefix}{String(1).padStart(Number(codeDigits), "0")}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ค่าเริ่มต้นคู่ค้า</CardTitle>
              <CardDescription>กำหนดค่าเริ่มต้นเมื่อเพิ่มคู่ค้าใหม่</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>ประเภทคู่ค้าเริ่มต้น</Label>
                <Select value={defaultType} onValueChange={setDefaultType}>
                  <SelectTrigger data-testid="select-default-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">ลูกค้า</SelectItem>
                    <SelectItem value="vendor">ผู้ขาย</SelectItem>
                    <SelectItem value="both">ลูกค้า/ผู้ขาย</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>เครดิตเริ่มต้น (วัน)</Label>
                <Input data-testid="input-default-credit" type="number" value={defaultCredit} onChange={e => setDefaultCredit(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
