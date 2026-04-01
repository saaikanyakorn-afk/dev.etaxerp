import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompany } from "@/lib/company-context";
import { apiRequest } from "@/lib/queryClient";
import { Key, Copy, Trash2, Ban, Plus, BookOpen, Shield, Code, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";

import { useDateSettings } from "@/hooks/use-date-settings";
interface ApiKey {
  id: number;
  companyId: number;
  keyName: string;
  keyPrefix: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function EcommerceApiConnect() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { dateEra, dateFmt } = useDateSettings();
  const { data: docSettings } = useQuery<any>({
    queryKey: ["/api/document-settings", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/document-settings?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [createdKeyDialogOpen, setCreatedKeyDialogOpen] = useState(false);
  const [createdFullKey, setCreatedFullKey] = useState("");
  const [createdKeyName, setCreatedKeyName] = useState("");

  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/api-keys?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/api-keys", { companyId: selectedCompanyId, keyName: name });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setCreateDialogOpen(false);
      setKeyName("");
      setCreatedFullKey(data.fullKey);
      setCreatedKeyName(data.keyName);
      setCreatedKeyDialogOpen(true);
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/api-keys/${id}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "ยกเลิก API Key สำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "ลบ API Key สำเร็จ", variant: "success" as any });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "คัดลอกแล้ว", variant: "success" as any });
  };

  const baseUrl = `${window.location.origin}/api/public/v1`;

  return (
    <EcommerceLayout>
      <div className="space-y-6" data-testid="page-api-connect">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-api-connect-title">
            <Globe className="h-6 w-6 inline mr-2" style={{ color: "#fb9678" }} />
            Open API / เชื่อมต่อเว็บไซต์
          </h1>
          <p className="text-sm text-muted-foreground mt-1">สร้าง API Key เพื่อเชื่อมต่อเว็บไซต์ของคุณ ส่งออเดอร์เข้าระบบอัตโนมัติ</p>
        </div>

        <Tabs defaultValue="manage" data-testid="tabs-api-connect">
          <TabsList>
            <TabsTrigger value="manage" data-testid="tab-manage-keys">
              <Key className="h-4 w-4 mr-1.5" />
              จัดการ API Key
            </TabsTrigger>
            <TabsTrigger value="docs" data-testid="tab-api-docs">
              <BookOpen className="h-4 w-4 mr-1.5" />
              คู่มือ API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="mt-4">
            <div className="flexy-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">API Keys</h2>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  style={{ background: "#fb9678" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-create-api-key"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  สร้าง API Key ใหม่
                </Button>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <Shield className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#539BFF" }} />
                <p className="text-xs text-blue-700">
                  API Key ใช้สำหรับยืนยันตัวตนเมื่อเรียกใช้ API กรุณาเก็บรักษา Key ไว้อย่างปลอดภัย อย่าเปิดเผยให้ผู้อื่น
                </p>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#fb9678]" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-no-api-keys">
                  <Key className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm">ยังไม่มี API Key</p>
                  <p className="text-xs mt-1">กดปุ่ม "สร้าง API Key ใหม่" เพื่อเริ่มต้นใช้งาน</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-3 px-2 font-medium">ชื่อ Key</th>
                        <th className="text-left py-3 px-2 font-medium">Key (ซ่อน)</th>
                        <th className="text-center py-3 px-2 font-medium">สถานะ</th>
                        <th className="text-left py-3 px-2 font-medium">ใช้ล่าสุด</th>
                        <th className="text-left py-3 px-2 font-medium">สร้างเมื่อ</th>
                        <th className="text-right py-3 px-2 font-medium">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.map((k) => (
                        <tr key={k.id} className="border-b hover:bg-gray-50/50" data-testid={`row-api-key-${k.id}`}>
                          <td className="py-3 px-2 font-medium" data-testid={`text-key-name-${k.id}`}>{k.keyName}</td>
                          <td className="py-3 px-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono" data-testid={`text-key-prefix-${k.id}`}>
                              {k.keyPrefix}••••••••
                            </code>
                          </td>
                          <td className="py-3 px-2 text-center" data-testid={`badge-key-status-${k.id}`}>
                            {k.status === "active" ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">ใช้งาน</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">ยกเลิกแล้ว</Badge>
                            )}
                          </td>
                          <td className="py-3 px-2 text-xs text-muted-foreground" data-testid={`text-key-last-used-${k.id}`}>
                            {formatDateTime(k.lastUsedAt, dateEra, dateFmt)}
                          </td>
                          <td className="py-3 px-2 text-xs text-muted-foreground" data-testid={`text-key-created-${k.id}`}>
                            {formatDateTime(k.createdAt, dateEra, dateFmt)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {k.status === "active" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-orange-600 border-orange-200 hover:bg-orange-50 h-7 text-xs"
                                  onClick={() => revokeMutation.mutate(k.id)}
                                  disabled={revokeMutation.isPending}
                                  data-testid={`button-revoke-key-${k.id}`}
                                >
                                  <Ban className="h-3 w-3 mr-1" />
                                  ยกเลิก
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs"
                                onClick={() => deleteMutation.mutate(k.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-key-${k.id}`}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                ลบ
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="docs" className="mt-4 space-y-6">
            <div className="flexy-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Code className="h-5 w-5" style={{ color: "#03c9d7" }} />
                คู่มือการใช้งาน API
              </h2>
              <p className="text-sm text-muted-foreground">
                ใช้ API เพื่อส่งออเดอร์จากเว็บไซต์หรือระบบของคุณเข้าสู่ระบบ eCommerce Hub โดยอัตโนมัติ
              </p>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">Base URL</h3>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded font-mono" data-testid="text-base-url">
                    {baseUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(baseUrl)}
                    data-testid="button-copy-base-url"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flexy-card p-6 space-y-4">
              <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                <Shield className="h-4 w-4" style={{ color: "#fb9678" }} />
                การยืนยันตัวตน (Authentication)
              </h3>
              <p className="text-sm text-muted-foreground">
                ส่ง API Key ผ่าน Header ทุกครั้งที่เรียกใช้ API
              </p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto font-mono" data-testid="code-auth-header">
{`X-API-Key: etx_xxxx...`}
              </pre>
            </div>

            <div className="flexy-card p-6 space-y-4">
              <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                <Code className="h-4 w-4" style={{ color: "#03c9d7" }} />
                POST /orders — สร้างออเดอร์
              </h3>
              <p className="text-sm text-muted-foreground">สร้างออเดอร์ใหม่ 1 รายการ</p>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">ตัวอย่าง curl:</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto font-mono" data-testid="code-create-order-curl">
{`curl -X POST ${baseUrl}/orders \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: etx_xxxx..." \\
  -d '{
  "orderNo": "WEB-001",
  "buyerName": "สมชาย ใจดี",
  "buyerPhone": "0812345678",
  "buyerAddress": "123 ถ.สุขุมวิท กรุงเทพฯ 10110",
  "subtotal": "1500",
  "shippingFee": "50",
  "totalAmount": "1550",
  "paymentMethod": "bank_transfer",
  "status": "confirmed",
  "items": [
    { "name": "เสื้อยืดสีขาว", "sku": "TSH-W-001", "qty": "2", "price": "500" },
    { "name": "กางเกงยีนส์", "sku": "JNS-B-001", "qty": "1", "price": "500" }
  ]
}'`}
                </pre>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">JSON Body:</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto font-mono" data-testid="code-create-order-body">
{`{
  "orderNo": "WEB-001",
  "buyerName": "สมชาย ใจดี",
  "buyerPhone": "0812345678",
  "buyerAddress": "123 ถ.สุขุมวิท กรุงเทพฯ 10110",
  "subtotal": "1500",
  "shippingFee": "50",
  "totalAmount": "1550",
  "paymentMethod": "bank_transfer",
  "status": "confirmed",
  "items": [
    { "name": "เสื้อยืดสีขาว", "sku": "TSH-W-001", "qty": "2", "price": "500" },
    { "name": "กางเกงยีนส์", "sku": "JNS-B-001", "qty": "1", "price": "500" }
  ]
}`}
                </pre>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Response สำเร็จ (200):</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto font-mono" data-testid="code-create-order-response">
{`{
  "success": true,
  "order": {
    "id": 123,
    "orderNo": "WEB-001",
    "status": "confirmed",
    "createdAt": "2026-02-15T10:30:00Z"
  }
}`}
                </pre>
              </div>
            </div>

            <div className="flexy-card p-6 space-y-4">
              <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                <Code className="h-4 w-4" style={{ color: "#03c9d7" }} />
                POST /orders/bulk — นำเข้าหลายออเดอร์
              </h3>
              <p className="text-sm text-muted-foreground">นำเข้าหลายออเดอร์พร้อมกัน สูงสุด 100 รายการต่อครั้ง</p>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">ตัวอย่าง JSON Body:</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto font-mono" data-testid="code-bulk-order-body">
{`{
  "orders": [
    {
      "orderNo": "WEB-001",
      "buyerName": "สมชาย ใจดี",
      "buyerPhone": "0812345678",
      "buyerAddress": "123 ถ.สุขุมวิท กรุงเทพฯ 10110",
      "subtotal": "1500",
      "shippingFee": "50",
      "totalAmount": "1550",
      "paymentMethod": "bank_transfer",
      "status": "confirmed",
      "items": [
        { "name": "เสื้อยืดสีขาว", "sku": "TSH-W-001", "qty": "2", "price": "500" }
      ]
    },
    {
      "orderNo": "WEB-002",
      "buyerName": "สมหญิง รักดี",
      "buyerPhone": "0898765432",
      "buyerAddress": "456 ถ.พหลโยธิน กรุงเทพฯ 10400",
      "subtotal": "800",
      "shippingFee": "40",
      "totalAmount": "840",
      "paymentMethod": "cod",
      "status": "confirmed",
      "items": [
        { "name": "กระเป๋าผ้า", "sku": "BAG-001", "qty": "1", "price": "800" }
      ]
    }
  ]
}`}
                </pre>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Response สำเร็จ (200):</p>
                <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto font-mono" data-testid="code-bulk-order-response">
{`{
  "success": true,
  "imported": 2,
  "failed": 0,
  "errors": []
}`}
                </pre>
              </div>
            </div>

            <div className="flexy-card p-6 space-y-4">
              <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-500" />
                รหัสข้อผิดพลาด (Error Codes)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium">HTTP Status</th>
                      <th className="text-left py-2 px-3 font-medium">ความหมาย</th>
                      <th className="text-left py-2 px-3 font-medium">ตัวอย่าง Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b" data-testid="row-error-401">
                      <td className="py-2 px-3">
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">401</Badge>
                      </td>
                      <td className="py-2 px-3 text-sm">API Key ไม่ถูกต้องหรือถูกยกเลิก</td>
                      <td className="py-2 px-3">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{"{ \"error\": \"Unauthorized\" }"}</code>
                      </td>
                    </tr>
                    <tr className="border-b" data-testid="row-error-400">
                      <td className="py-2 px-3">
                        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">400</Badge>
                      </td>
                      <td className="py-2 px-3 text-sm">ข้อมูลไม่ครบถ้วนหรือรูปแบบไม่ถูกต้อง</td>
                      <td className="py-2 px-3">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{"{ \"error\": \"Bad Request\", \"details\": \"...\" }"}</code>
                      </td>
                    </tr>
                    <tr className="border-b" data-testid="row-error-409">
                      <td className="py-2 px-3">
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">409</Badge>
                      </td>
                      <td className="py-2 px-3 text-sm">เลขที่ออเดอร์ซ้ำ (Duplicate orderNo)</td>
                      <td className="py-2 px-3">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{"{ \"error\": \"Duplicate orderNo\" }"}</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-create-api-key">
            <DialogHeader>
              <DialogTitle>สร้าง API Key ใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">ชื่อ Key</label>
                <Input
                  placeholder="เช่น เว็บไซต์หลัก, ระบบ POS"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  data-testid="input-key-name"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel-create">
                  ยกเลิก
                </Button>
                <Button
                  onClick={() => createMutation.mutate(keyName)}
                  disabled={!keyName.trim() || createMutation.isPending}
                  style={{ background: "#fb9678" }}
                  className="text-white hover:opacity-90"
                  data-testid="button-confirm-create"
                >
                  {createMutation.isPending ? "กำลังสร้าง..." : "สร้าง Key"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={createdKeyDialogOpen} onOpenChange={setCreatedKeyDialogOpen}>
          <DialogContent className="max-w-lg" data-testid="dialog-show-created-key">
            <DialogHeader>
              <DialogTitle className="text-green-700">สร้าง API Key สำเร็จ!</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <Shield className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800 font-medium">
                  กรุณาคัดลอกและเก็บรักษา Key นี้ไว้ Key จะแสดงเพียงครั้งเดียวเท่านั้น ไม่สามารถดูซ้ำได้
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">ชื่อ Key</label>
                <p className="text-sm font-medium" data-testid="text-created-key-name">{createdKeyName}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">API Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-100 px-3 py-2 rounded font-mono break-all" data-testid="text-created-full-key">
                    {createdFullKey}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(createdFullKey)}
                    data-testid="button-copy-created-key"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    คัดลอก
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setCreatedKeyDialogOpen(false)} data-testid="button-close-created-key">
                  เข้าใจแล้ว ปิด
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
