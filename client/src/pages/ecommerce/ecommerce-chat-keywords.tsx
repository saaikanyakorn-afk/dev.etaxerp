import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EcommerceLayout from "@/components/ecommerce-layout";
import { useCompany } from "@/lib/company-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, TestTube, MessageCircle, Send } from "lucide-react";
import type { ChatOrderKeyword } from "@shared/schema";

const PLATFORM_OPTIONS = [
  { value: "all", label: "ทุกแพลตฟอร์ม", hex: "#6b7280" },
  { value: "line", label: "LINE OA", hex: "#06C755" },
  { value: "facebook", label: "Facebook", hex: "#1877F2" },
  { value: "instagram", label: "Instagram", hex: "#E4405F" },
];

const DEFAULT_KEYWORDS = ["CF", "cf", "สั่ง", "order"];

export default function EcommerceChatKeywords() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newKeyword, setNewKeyword] = useState("");
  const [newPlatform, setNewPlatform] = useState("all");
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const { data: keywords = [], isLoading } = useQuery<ChatOrderKeyword[]>({
    queryKey: ["/api/chat-order-keywords", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await fetch(`/api/chat-order-keywords?companyId=${selectedCompanyId}`);
      if (!res.ok) throw new Error("Failed to load keywords");
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const addMutation = useMutation({
    mutationFn: async (data: { keyword: string; platform: string }) => {
      const res = await fetch("/api/chat-order-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompanyId, ...data }),
      });
      if (!res.ok) throw new Error("Failed to add keyword");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/chat-order-keywords"] });
      setNewKeyword("");
      toast({ title: "เพิ่มคีย์เวิร์ดสำเร็จ" });
    },
    onError: () => toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/chat-order-keywords/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/chat-order-keywords"] });
      toast({ title: "ลบคีย์เวิร์ดสำเร็จ" });
    },
  });

  const handleAdd = () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    addMutation.mutate({ keyword: trimmed, platform: newPlatform });
  };

  const handleTestParse = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/chat-orders/test-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompanyId, message: testMessage }),
      });
      if (!res.ok) throw new Error("Test failed");
      const data = await res.json();
      setTestResult(data);
    } catch {
      toast({ title: "ทดสอบล้มเหลว", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const getPlatformInfo = (value: string) =>
    PLATFORM_OPTIONS.find((p) => p.value === value) || PLATFORM_OPTIONS[0];

  const usingDefaults = keywords.length === 0;

  return (
    <EcommerceLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">คีย์เวิร์ดจับออเดอร์</h1>
          <p className="text-gray-500 mt-1">กำหนดคำที่ระบบจะใช้ตรวจจับออเดอร์จากข้อความแชท LINE, Facebook, Instagram</p>
        </div>

        <Card className="p-5">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <MessageCircle size={20} className="text-[#fb9678]" />
            คีย์เวิร์ดที่ใช้งาน
          </h2>

          {usingDefaults && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                ยังไม่ได้ตั้งค่าคีย์เวิร์ด — ระบบใช้ค่าเริ่มต้น: <strong>{DEFAULT_KEYWORDS.join(", ")}</strong>
              </p>
              <p className="text-xs text-amber-600 mt-1">เพิ่มคีย์เวิร์ดด้านล่างเพื่อปรับแต่งตามต้องการ</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : keywords.length > 0 ? (
            <div className="space-y-2 mb-4">
              {keywords.map((kw) => {
                const pInfo = getPlatformInfo(kw.platform);
                return (
                  <div
                    key={kw.id}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border"
                    data-testid={`row-keyword-${kw.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-semibold">{kw.keyword}</span>
                      <Badge
                        className="text-white text-xs"
                        style={{ backgroundColor: pInfo.hex }}
                      >
                        {pInfo.label}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(kw.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      data-testid={`button-delete-keyword-${kw.id}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-sm text-gray-600 mb-1 block">คีย์เวิร์ดใหม่</label>
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="เช่น CF, สั่ง, จอง, order"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                data-testid="input-new-keyword"
              />
            </div>
            <div className="w-48">
              <label className="text-sm text-gray-600 mb-1 block">แพลตฟอร์ม</label>
              <Select value={newPlatform} onValueChange={setNewPlatform}>
                <SelectTrigger data-testid="select-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: p.hex }} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAdd}
              disabled={!newKeyword.trim() || addMutation.isPending}
              className="bg-[#fb9678] hover:bg-[#e8856a] text-white"
              data-testid="button-add-keyword"
            >
              {addMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              <span className="ml-1">เพิ่ม</span>
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <TestTube size={20} className="text-[#03c9d7]" />
            ทดสอบจับออเดอร์
          </h2>
          <p className="text-sm text-gray-500 mb-3">พิมพ์ข้อความตัวอย่างเพื่อดูว่าระบบจับออเดอร์ได้หรือไม่</p>

          <div className="flex gap-2">
            <Input
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="เช่น CF เสื้อยืด 2 ตัว 250"
              onKeyDown={(e) => e.key === "Enter" && handleTestParse()}
              className="flex-1"
              data-testid="input-test-message"
            />
            <Button
              onClick={handleTestParse}
              disabled={!testMessage.trim() || testing}
              variant="outline"
              className="border-[#03c9d7] text-[#03c9d7] hover:bg-[#03c9d7] hover:text-white"
              data-testid="button-test-parse"
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span className="ml-1">ทดสอบ</span>
            </Button>
          </div>

          {testResult && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4 border" data-testid="div-test-result">
              {testResult.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-green-600 mb-2">✓ จับออเดอร์ได้ {testResult.length} รายการ:</p>
                  <div className="space-y-1">
                    {testResult.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 text-sm bg-white rounded px-3 py-2 border">
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="outline">x{item.qty}</Badge>
                        {item.price > 0 && <span className="text-gray-500">฿{item.price.toLocaleString()}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">✗ ไม่พบออเดอร์ในข้อความนี้ — ลองเพิ่มคีย์เวิร์ดหรือแก้ไขรูปแบบข้อความ</p>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5 bg-blue-50/50 border-blue-200">
          <h3 className="font-semibold mb-2">วิธีใช้งาน</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• ระบบจะตรวจจับข้อความที่ขึ้นต้นด้วยคีย์เวิร์ดที่กำหนด เช่น <code className="bg-white px-1.5 py-0.5 rounded border text-xs">CF เสื้อยืด 2 ตัว 250</code></p>
            <p>• รองรับรูปแบบ: <code className="bg-white px-1.5 py-0.5 rounded border text-xs">[คีย์เวิร์ด] [ชื่อสินค้า] [จำนวน] [ราคา]</code></p>
            <p>• หากตั้งแพลตฟอร์มเป็น "ทุกแพลตฟอร์ม" คีย์เวิร์ดนั้นจะใช้กับ LINE, Facebook, และ Instagram</p>
            <p>• หากไม่มีคีย์เวิร์ดที่ตั้งไว้ ระบบจะใช้ค่าเริ่มต้น: <strong>CF, cf, สั่ง, order</strong></p>
          </div>
        </Card>
      </div>
    </EcommerceLayout>
  );
}
