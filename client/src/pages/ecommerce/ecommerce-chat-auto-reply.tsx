import { useState } from "react";
import EcommerceLayout from "@/components/ecommerce-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Plus, Pencil, Trash2, Loader2, Star, Send, Search, ArrowUpDown, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "shopee", label: "Shopee" },
  { value: "lazada", label: "Lazada" },
  { value: "tiktok", label: "TikTok" },
  { value: "line", label: "LINE OA" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
];

const TRIGGER_TYPES = [
  { value: "keyword", label: "คีย์เวิร์ด" },
  { value: "greeting", label: "ทักทาย" },
  { value: "order_status", label: "สถานะออเดอร์" },
  { value: "out_of_stock", label: "สินค้าหมด" },
  { value: "after_hours", label: "นอกเวลาทำการ" },
];

const MATCH_TYPES = [
  { value: "contains", label: "มีคำ (Contains)" },
  { value: "exact", label: "ตรงทั้งหมด (Exact)" },
  { value: "regex", label: "Regex" },
];

const REPLY_TYPES = [
  { value: "text", label: "ข้อความ" },
  { value: "image", label: "รูปภาพ" },
  { value: "template", label: "เทมเพลต" },
];

const defaultRuleForm = {
  name: "",
  platform: "all",
  triggerType: "keyword",
  keywords: "",
  matchType: "contains",
  replyMessage: "",
  replyType: "text",
  priority: 1,
  schedule: "",
  isActive: true,
};

const defaultReviewForm = {
  starRating: 5,
  replyMessage: "",
  platform: "all",
  isActive: true,
};

export default function EcommerceChatAutoReply() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("rules");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editRuleId, setEditRuleId] = useState<number | null>(null);
  const [ruleForm, setRuleForm] = useState(defaultRuleForm);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [editReviewId, setEditReviewId] = useState<number | null>(null);
  const [reviewForm, setReviewForm] = useState(defaultReviewForm);
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<any>(null);

  const { data: rules = [], isLoading: rulesLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/chat/auto-rules", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/chat/auto-rules?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: reviewReplies = [], isLoading: reviewsLoading } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/chat/review-replies", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/chat/review-replies?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!selectedCompanyId,
  });

  const saveRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editRuleId ? `/api/ecommerce/chat/auto-rules/${editRuleId}` : "/api/ecommerce/chat/auto-rules";
      const method = editRuleId ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editRuleId ? "แก้ไขกฎสำเร็จ" : "เพิ่มกฎสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/chat/auto-rules"] });
      setShowRuleForm(false);
      resetRuleForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/chat/auto-rules/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ลบกฎสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/chat/auto-rules"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const r = await fetch(`/api/ecommerce/chat/auto-rules/${id}/toggle`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ isActive, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/chat/auto-rules"] }),
  });

  const saveReviewMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editReviewId ? `/api/ecommerce/chat/review-replies/${editReviewId}` : "/api/ecommerce/chat/review-replies";
      const method = editReviewId ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ...data, companyId: selectedCompanyId }),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editReviewId ? "แก้ไขการตอบกลับรีวิวสำเร็จ" : "เพิ่มการตอบกลับรีวิวสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/chat/review-replies"] });
      setShowReviewForm(false);
      resetReviewForm();
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/ecommerce/chat/review-replies/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ลบการตอบกลับรีวิวสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/chat/review-replies"] });
    },
    onError: (err: any) => toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" }),
  });

  const resetRuleForm = () => { setRuleForm(defaultRuleForm); setEditRuleId(null); };
  const resetReviewForm = () => { setReviewForm(defaultReviewForm); setEditReviewId(null); };

  const openEditRule = (rule: any) => {
    setEditRuleId(rule.id);
    setRuleForm({
      name: rule.name || "",
      platform: rule.platform || "all",
      triggerType: rule.triggerType || "keyword",
      keywords: Array.isArray(rule.keywords) ? rule.keywords.join(", ") : (rule.keywords || ""),
      matchType: rule.matchType || "contains",
      replyMessage: rule.replyMessage || "",
      replyType: rule.replyType || "text",
      priority: rule.priority || 1,
      schedule: rule.schedule || "",
      isActive: rule.isActive ?? true,
    });
    setShowRuleForm(true);
  };

  const openEditReview = (review: any) => {
    setEditReviewId(review.id);
    setReviewForm({
      starRating: review.starRating || 5,
      replyMessage: review.replyMessage || "",
      platform: review.platform || "all",
      isActive: review.isActive ?? true,
    });
    setShowReviewForm(true);
  };

  const filteredRules = platformFilter === "all"
    ? rules
    : rules.filter((r: any) => r.platform === platformFilter || r.platform === "all");

  const handleTestMessage = () => {
    if (!testMessage.trim()) return;
    const sortedRules = [...rules].filter((r: any) => r.isActive).sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));
    let matched: any = null;
    for (const rule of sortedRules) {
      const keywords = Array.isArray(rule.keywords) ? rule.keywords : (rule.keywords || "").split(",").map((k: string) => k.trim()).filter(Boolean);
      const msg = testMessage.toLowerCase();
      for (const kw of keywords) {
        const kwLower = kw.toLowerCase();
        if (rule.matchType === "exact" && msg === kwLower) { matched = rule; break; }
        if (rule.matchType === "contains" && msg.includes(kwLower)) { matched = rule; break; }
        if (rule.matchType === "regex") {
          try { if (new RegExp(kw, "i").test(testMessage)) { matched = rule; break; } } catch {}
        }
      }
      if (!matched && rule.triggerType === "greeting" && /^(สวัสดี|hello|hi|หวัดดี|ดีครับ|ดีค่ะ)/i.test(testMessage)) { matched = rule; }
      if (matched) break;
    }
    setTestResult(matched ? {
      matched: true,
      rule: matched,
      replyMessage: matched.replyMessage,
      matchInfo: `คีย์เวิร์ด → ${matched.matchType} → ตรงกับกฎ "${matched.name}"`,
    } : {
      matched: false,
      matchInfo: "ไม่พบกฎที่ตรงกับข้อความนี้",
    });
  };

  const renderStars = (count: number) => (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < count ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
    </div>
  );

  const triggerTypeLabel = (v: string) => TRIGGER_TYPES.find(t => t.value === v)?.label || v;
  const platformLabel = (v: string) => PLATFORMS.find(p => p.value === v)?.label || v;

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-chat-auto-reply">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800" data-testid="text-title">กฎตอบกลับอัตโนมัติ (Chat Auto-Reply)</h1>
            <p className="text-sm text-muted-foreground mt-0.5">จัดการกฎตอบกลับอัตโนมัติสำหรับแชทและรีวิวจากทุกแพลตฟอร์ม</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border" data-testid="tabs-list">
            <TabsTrigger value="rules" data-testid="tab-rules" className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">
              กฎตอบกลับอัตโนมัติ
            </TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews" className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">
              ตอบกลับรีวิว
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-preview" className="data-[state=active]:bg-[#fb9678] data-[state=active]:text-white">
              ตัวอย่างการทำงาน
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Auto-Reply Rules */}
          <TabsContent value="rules" className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-[160px] h-9" data-testid="select-platform-filter">
                    <SelectValue placeholder="แพลตฟอร์ม" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p.value} value={p.value} data-testid={`option-platform-${p.value}`}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="bg-[#03c9d7] hover:bg-[#02b4c1] text-white gap-1" onClick={() => { resetRuleForm(); setShowRuleForm(true); }} data-testid="button-add-rule">
                <Plus className="h-4 w-4" />เพิ่มกฎใหม่
              </Button>
            </div>

            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-[#03c9d7]" />
                  กฎตอบกลับ ({filteredRules.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rulesLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : filteredRules.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">ยังไม่มีกฎตอบกลับอัตโนมัติ</p>
                    <p className="text-xs mt-1">กดปุ่ม "เพิ่มกฎใหม่" เพื่อเริ่มตั้งค่า</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs"><div className="flex items-center gap-1"><ArrowUpDown className="h-3 w-3" />ลำดับ</div></TableHead>
                          <TableHead className="text-xs">ชื่อกฎ</TableHead>
                          <TableHead className="text-xs">แพลตฟอร์ม</TableHead>
                          <TableHead className="text-xs">ประเภท Trigger</TableHead>
                          <TableHead className="text-xs">คีย์เวิร์ด</TableHead>
                          <TableHead className="text-xs">ข้อความตอบกลับ</TableHead>
                          <TableHead className="text-xs text-center">เปิด/ปิด</TableHead>
                          <TableHead className="text-xs text-center">ใช้งานแล้ว</TableHead>
                          <TableHead className="text-xs text-center">เครื่องมือ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRules.map((rule: any, idx: number) => (
                          <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                            <TableCell className="text-sm text-muted-foreground">{rule.priority || idx + 1}</TableCell>
                            <TableCell className="text-sm font-medium">{rule.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs" data-testid={`badge-platform-${rule.id}`}>
                                {platformLabel(rule.platform)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="text-xs bg-[#fb9678]/10 text-[#fb9678] hover:bg-[#fb9678]/20 border-0">
                                {triggerTypeLabel(rule.triggerType)}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[150px]">
                              <div className="flex flex-wrap gap-1">
                                {(Array.isArray(rule.keywords) ? rule.keywords : (rule.keywords || "").split(",").map((k: string) => k.trim()).filter(Boolean))
                                  .slice(0, 3).map((kw: string, i: number) => (
                                    <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                                  ))}
                                {(Array.isArray(rule.keywords) ? rule.keywords : (rule.keywords || "").split(",")).length > 3 && (
                                  <Badge variant="secondary" className="text-xs">+{(Array.isArray(rule.keywords) ? rule.keywords : (rule.keywords || "").split(",")).length - 3}</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {(rule.replyMessage || "").substring(0, 50)}{(rule.replyMessage || "").length > 50 ? "..." : ""}
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={rule.isActive}
                                onCheckedChange={(v) => toggleRuleMutation.mutate({ id: rule.id, isActive: v })}
                                data-testid={`switch-rule-${rule.id}`}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">{rule.triggerCount || 0} ครั้ง</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => openEditRule(rule)} data-testid={`button-edit-rule-${rule.id}`}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm("ต้องการลบกฎนี้?")) deleteRuleMutation.mutate(rule.id); }} data-testid={`button-delete-rule-${rule.id}`}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Review Auto-Replies */}
          <TabsContent value="reviews" className="space-y-4">
            <div className="flex items-center justify-end">
              <Button className="bg-[#03c9d7] hover:bg-[#02b4c1] text-white gap-1" onClick={() => { resetReviewForm(); setShowReviewForm(true); }} data-testid="button-add-review-reply">
                <Plus className="h-4 w-4" />เพิ่มการตอบกลับรีวิว
              </Button>
            </div>

            {reviewsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : reviewReplies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">ยังไม่มีการตั้งค่าตอบกลับรีวิว</p>
                <p className="text-xs mt-1">กดปุ่ม "เพิ่มการตอบกลับรีวิว" เพื่อเริ่มตั้งค่า</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reviewReplies.map((review: any) => (
                  <Card key={review.id} className="rounded-xl shadow-sm" data-testid={`card-review-${review.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        {renderStars(review.starRating)}
                        <Switch
                          checked={review.isActive}
                          onCheckedChange={(v) => {
                            saveReviewMutation.mutate({ ...review, isActive: v });
                          }}
                          data-testid={`switch-review-${review.id}`}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-gray-700 line-clamp-3">{review.replyMessage}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{platformLabel(review.platform)}</Badge>
                          <Badge variant="outline" className="text-xs">{review.triggerCount || 0} ครั้ง</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openEditReview(review)} data-testid={`button-edit-review-${review.id}`}>
                            <Pencil className="h-3 w-3" />แก้ไข
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => { if (confirm("ต้องการลบ?")) deleteReviewMutation.mutate(review.id); }} data-testid={`button-delete-review-${review.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {review.isActive ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">เปิดใช้งาน</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs">ปิดใช้งาน</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Preview/Testing */}
          <TabsContent value="preview" className="space-y-4">
            <Card className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Search className="h-4 w-4 text-[#03c9d7]" />
                  ทดสอบการตอบกลับอัตโนมัติ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">พิมพ์ข้อความเพื่อทดสอบว่ากฎใดจะตอบกลับ</p>
                <div className="flex gap-2">
                  <Input
                    value={testMessage}
                    onChange={e => setTestMessage(e.target.value)}
                    placeholder="พิมพ์ข้อความทดสอบ เช่น 'สวัสดีครับ' หรือ 'ราคาเท่าไหร่'"
                    className="flex-1"
                    onKeyDown={e => { if (e.key === "Enter") handleTestMessage(); }}
                    data-testid="input-test-message"
                  />
                  <Button className="bg-[#fb9678] hover:bg-[#e8856a] text-white gap-1" onClick={handleTestMessage} data-testid="button-test-send">
                    <Send className="h-4 w-4" />ทดสอบ
                  </Button>
                </div>

                {testResult && (
                  <div className="space-y-3 mt-4">
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 p-3 border-b">
                        <p className="text-xs font-medium text-gray-600">กระบวนการจับคู่</p>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-xs">ข้อความ</Badge>
                          <span className="text-gray-400">→</span>
                          <Badge variant="outline" className="text-xs">{testResult.matched ? "จับคู่สำเร็จ" : "ไม่ตรงกับกฎใด"}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{testResult.matchInfo}</p>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 p-3 border-b">
                        <p className="text-xs font-medium text-gray-600">จำลองการแชท</p>
                      </div>
                      <div className="p-4 space-y-3 bg-[#f8f9fa] min-h-[120px]">
                        <div className="flex justify-end">
                          <div className="bg-[#fb9678] text-white rounded-2xl rounded-br-md px-4 py-2 max-w-[70%]">
                            <p className="text-sm">{testMessage}</p>
                          </div>
                        </div>
                        {testResult.matched ? (
                          <div className="flex justify-start">
                            <div className="bg-white border rounded-2xl rounded-bl-md px-4 py-2 max-w-[70%] shadow-sm">
                              <p className="text-sm">{testResult.replyMessage}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">ตอบกลับอัตโนมัติ • กฎ: {testResult.rule?.name}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-start">
                            <div className="bg-white border rounded-2xl rounded-bl-md px-4 py-2 max-w-[70%] shadow-sm border-dashed border-gray-300">
                              <p className="text-sm text-gray-400 italic">ไม่มีกฎตอบกลับอัตโนมัติสำหรับข้อความนี้</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {testResult.matched && testResult.rule && (
                      <Card className="rounded-xl border-[#03c9d7]/30">
                        <CardContent className="pt-4">
                          <p className="text-xs font-medium text-[#03c9d7] mb-2">รายละเอียดกฎที่ตรงกัน</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-muted-foreground">ชื่อกฎ:</span> <span className="font-medium">{testResult.rule.name}</span></div>
                            <div><span className="text-muted-foreground">แพลตฟอร์ม:</span> <span className="font-medium">{platformLabel(testResult.rule.platform)}</span></div>
                            <div><span className="text-muted-foreground">ประเภท:</span> <span className="font-medium">{triggerTypeLabel(testResult.rule.triggerType)}</span></div>
                            <div><span className="text-muted-foreground">วิธีจับคู่:</span> <span className="font-medium">{MATCH_TYPES.find(m => m.value === testResult.rule.matchType)?.label || testResult.rule.matchType}</span></div>
                            <div><span className="text-muted-foreground">ลำดับความสำคัญ:</span> <span className="font-medium">{testResult.rule.priority}</span></div>
                            <div><span className="text-muted-foreground">ใช้งานแล้ว:</span> <span className="font-medium">{testResult.rule.triggerCount || 0} ครั้ง</span></div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Rule Form Dialog */}
        <Dialog open={showRuleForm} onOpenChange={setShowRuleForm}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editRuleId ? "แก้ไขกฎ" : "เพิ่มกฎใหม่"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">ชื่อกฎ *</label>
                <Input value={ruleForm.name} onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น ตอบทักทายอัตโนมัติ" className="mt-1" data-testid="input-rule-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">แพลตฟอร์ม</label>
                  <Select value={ruleForm.platform} onValueChange={v => setRuleForm(f => ({ ...f, platform: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-rule-platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">ประเภท Trigger</label>
                  <Select value={ruleForm.triggerType} onValueChange={v => setRuleForm(f => ({ ...f, triggerType: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-rule-trigger-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">คีย์เวิร์ด (คั่นด้วยเครื่องหมายจุลภาค)</label>
                <Input value={ruleForm.keywords} onChange={e => setRuleForm(f => ({ ...f, keywords: e.target.value }))} placeholder="เช่น ราคา, ส่งฟรี, โปรโมชั่น" className="mt-1" data-testid="input-rule-keywords" />
                {ruleForm.keywords && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ruleForm.keywords.split(",").map((k, i) => k.trim()).filter(Boolean).map((kw, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1">
                        {kw}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => {
                          const kws = ruleForm.keywords.split(",").map(k => k.trim()).filter(Boolean);
                          kws.splice(i, 1);
                          setRuleForm(f => ({ ...f, keywords: kws.join(", ") }));
                        }} />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">วิธีจับคู่</label>
                <Select value={ruleForm.matchType} onValueChange={v => setRuleForm(f => ({ ...f, matchType: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-rule-match-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATCH_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ข้อความตอบกลับ *</label>
                <Textarea
                  value={ruleForm.replyMessage}
                  onChange={e => setRuleForm(f => ({ ...f, replyMessage: e.target.value }))}
                  placeholder="พิมพ์ข้อความตอบกลับอัตโนมัติ..."
                  className="mt-1 min-h-[80px]"
                  data-testid="textarea-rule-reply"
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">{ruleForm.replyMessage.length} ตัวอักษร</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">ประเภทตอบกลับ</label>
                  <Select value={ruleForm.replyType} onValueChange={v => setRuleForm(f => ({ ...f, replyType: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-rule-reply-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPLY_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">ลำดับความสำคัญ</label>
                  <Input type="number" min={1} value={ruleForm.priority} onChange={e => setRuleForm(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))} className="mt-1" data-testid="input-rule-priority" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">ตารางเวลา (Cron Expression, ไม่บังคับ)</label>
                <Input value={ruleForm.schedule} onChange={e => setRuleForm(f => ({ ...f, schedule: e.target.value }))} placeholder="เช่น 0 18 * * * (หลัง 6 โมงเย็น)" className="mt-1 font-mono text-xs" data-testid="input-rule-schedule" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">เปิดใช้งาน</label>
                <Switch checked={ruleForm.isActive} onCheckedChange={v => setRuleForm(f => ({ ...f, isActive: v }))} data-testid="switch-rule-active" />
              </div>
              <Button
                className="w-full bg-[#03c9d7] hover:bg-[#02b4c1] text-white"
                disabled={!ruleForm.name || !ruleForm.replyMessage || saveRuleMutation.isPending}
                onClick={() => saveRuleMutation.mutate(ruleForm)}
                data-testid="button-save-rule"
              >
                {saveRuleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editRuleId ? "บันทึกการแก้ไข" : "เพิ่มกฎ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Review Reply Form Dialog */}
        <Dialog open={showReviewForm} onOpenChange={setShowReviewForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editReviewId ? "แก้ไขการตอบกลับรีวิว" : "เพิ่มการตอบกลับรีวิว"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">ระดับดาว</label>
                <Select value={String(reviewForm.starRating)} onValueChange={v => setReviewForm(f => ({ ...f, starRating: parseInt(v) }))}>
                  <SelectTrigger className="mt-1" data-testid="select-review-star">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(s => (
                      <SelectItem key={s} value={String(s)}>{"★".repeat(s)} ({s} ดาว)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">ข้อความตอบกลับรีวิว *</label>
                <Textarea
                  value={reviewForm.replyMessage}
                  onChange={e => setReviewForm(f => ({ ...f, replyMessage: e.target.value }))}
                  placeholder="พิมพ์ข้อความตอบกลับรีวิว..."
                  className="mt-1 min-h-[100px]"
                  data-testid="textarea-review-reply"
                />
              </div>
              <div>
                <label className="text-sm font-medium">แพลตฟอร์ม</label>
                <Select value={reviewForm.platform} onValueChange={v => setReviewForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger className="mt-1" data-testid="select-review-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">เปิดใช้งาน</label>
                <Switch checked={reviewForm.isActive} onCheckedChange={v => setReviewForm(f => ({ ...f, isActive: v }))} data-testid="switch-review-active" />
              </div>
              <Button
                className="w-full bg-[#03c9d7] hover:bg-[#02b4c1] text-white"
                disabled={!reviewForm.replyMessage || saveReviewMutation.isPending}
                onClick={() => saveReviewMutation.mutate(reviewForm)}
                data-testid="button-save-review"
              >
                {saveReviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editReviewId ? "บันทึกการแก้ไข" : "เพิ่มการตอบกลับ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </EcommerceLayout>
  );
}
