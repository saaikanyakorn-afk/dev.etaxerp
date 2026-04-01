import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PlatformLayout from "@/components/platform-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { MessageCircle, Send, Loader2, Bot, User, Building2, ArrowLeft, AlertCircle } from "lucide-react";

interface ChatThread {
  tenantId: number;
  tenantName: string;
  lastMessage: string;
  lastAt: string;
  senderName: string;
  unreadCount: number;
}

interface ChatMessage {
  id: number;
  tenantId: number | null;
  senderId: number;
  senderName: string;
  senderRole: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatChatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "วันนี้";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "เมื่อวาน";
  return formatDate(dateStr);
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

export default function ChatManagement() {
  const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: threads = [], isLoading: threadsLoading, isError: threadsError } = useQuery<ChatThread[]>({
    queryKey: ["/api/chat/threads"],
    queryFn: async () => {
      const r = await fetch("/api/chat/threads", { credentials: "include" });
      if (!r.ok) throw new Error("ไม่สามารถโหลดรายการสนทนาได้");
      return r.json();
    },
    refetchInterval: 10000,
  });

  const { data: messages = [], isError: messagesError } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", selectedTenant],
    queryFn: async () => {
      if (!selectedTenant) return [];
      const r = await fetch(`/api/chat/messages?tenantId=${selectedTenant}`, { credentials: "include" });
      if (!r.ok) throw new Error("ไม่สามารถโหลดข้อความได้");
      return r.json();
    },
    enabled: !!selectedTenant,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body, targetTenantId: selectedTenant }),
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", selectedTenant] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (tenantId: number) => {
      await fetch("/api/chat/messages/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
    },
  });

  useEffect(() => {
    if (selectedTenant && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedTenant]);

  const selectedThread = threads.find(t => t.tenantId === selectedTenant);
  const selectedUnread = selectedThread?.unreadCount || 0;

  useEffect(() => {
    if (selectedTenant && selectedUnread > 0) {
      markReadMutation.mutate(selectedTenant);
    }
  }, [selectedTenant, selectedUnread]);

  const handleSend = () => {
    if (!replyText.trim() || !selectedTenant) return;
    sendMutation.mutate(replyText.trim());
    setReplyText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sortedThreads = [...threads].sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
    return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
  });

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  let lastDateLabel = "";

  return (
    <PlatformLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-chat-mgmt-title">
            <MessageCircle className="inline h-6 w-6 mr-2 text-[#03c9d7]" />
            แชทสนับสนุน
          </h1>
          <p className="text-gray-500 mt-1">
            ดูการสนทนาทั้งหมดระหว่างผู้ใช้กับ AI ฝ่ายสนับสนุน
            {totalUnread > 0 && (
              <Badge className="ml-2 bg-red-500 text-white">{totalUnread} ยังไม่อ่าน</Badge>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: "calc(100vh - 220px)" }}>
          <Card className="lg:col-span-1 overflow-hidden flex flex-col">
            <div className="p-3 border-b bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">รายการสนทนา ({threads.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {threadsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : threadsError ? (
                <div className="text-center py-12 text-red-400 text-sm">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <div>ไม่สามารถโหลดรายการสนทนาได้</div>
                </div>
              ) : sortedThreads.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                  <div>ยังไม่มีการสนทนา</div>
                </div>
              ) : (
                sortedThreads.map((thread) => (
                  <button
                    key={thread.tenantId}
                    data-testid={`chat-thread-${thread.tenantId}`}
                    onClick={() => setSelectedTenant(thread.tenantId)}
                    className={`w-full text-left p-3 border-b hover:bg-slate-50 transition-colors ${
                      selectedTenant === thread.tenantId ? "bg-[#03c9d7]/5 border-l-4 border-l-[#03c9d7]" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {thread.tenantName}
                          </span>
                          {thread.unreadCount > 0 && (
                            <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-5 ml-1">
                              {thread.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{thread.lastMessage}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(thread.lastAt)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="lg:col-span-2 overflow-hidden flex flex-col">
            {!selectedTenant ? (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3" />
                  <div className="text-sm">เลือกรายการสนทนาจากด้านซ้าย</div>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 border-b bg-slate-50 flex items-center gap-3">
                  <button
                    className="lg:hidden p-1 hover:bg-slate-200 rounded"
                    onClick={() => setSelectedTenant(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <Building2 className="h-5 w-5 text-slate-500" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800" data-testid="text-selected-tenant">
                      {selectedThread?.tenantName || `Tenant #${selectedTenant}`}
                    </div>
                    <div className="text-[10px] text-slate-400">แชทสนับสนุน</div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-slate-50/50">
                  {messagesError && (
                    <div className="text-center py-4 text-red-400 text-xs">
                      <AlertCircle className="h-5 w-5 mx-auto mb-1" />
                      ไม่สามารถโหลดข้อความได้
                    </div>
                  )}
                  {messages.map((msg) => {
                    const isAI = msg.senderRole === "ai";
                    const isAdmin = msg.senderRole === "admin";
                    const isUser = msg.senderRole === "user";
                    const msgDate = formatChatDate(msg.createdAt);
                    let showDate = false;
                    if (msgDate !== lastDateLabel) {
                      showDate = true;
                      lastDateLabel = msgDate;
                    }

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="text-center text-[10px] text-slate-400 py-2">{msgDate}</div>
                        )}
                        <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-1.5`}>
                          <div
                            className={`max-w-[70%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                              isUser
                                ? "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                                : isAI
                                ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-br-sm"
                                : "bg-[#03c9d7] text-white rounded-br-sm"
                            }`}
                          >
                            <div className={`text-[10px] font-medium mb-0.5 flex items-center gap-1 ${
                              isUser ? "text-slate-500" : isAI ? "text-amber-600" : "text-white/80"
                            }`}>
                              {isAI && <Bot className="h-3 w-3" />}
                              {isUser && <User className="h-3 w-3" />}
                              {isAI ? "AI ฝ่ายสนับสนุน" : isAdmin ? "ฝ่ายสนับสนุน (คุณ)" : msg.senderName}
                            </div>
                            <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                            <div className={`text-[9px] mt-0.5 ${
                              isUser ? "text-slate-400" : isAI ? "text-amber-400" : "text-white/70"
                            }`}>
                              {formatTime(msg.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="p-3 border-t bg-white flex items-center gap-2">
                  <Input
                    data-testid="input-admin-reply"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="พิมพ์ข้อความตอบกลับ..."
                    className="flex-1 text-sm"
                    disabled={sendMutation.isPending}
                  />
                  <Button
                    data-testid="button-admin-send"
                    size="icon"
                    className="h-9 w-9 bg-[#03c9d7] hover:bg-[#02a8b3]"
                    onClick={handleSend}
                    disabled={!replyText.trim() || sendMutation.isPending}
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </PlatformLayout>
  );
}
