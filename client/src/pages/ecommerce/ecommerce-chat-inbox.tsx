import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EcommerceLayout from "@/components/ecommerce-layout";
import { useCompany } from "@/lib/company-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle,
  Send,
  Image as ImageIcon,
  Info,
  Loader2,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  Search,
} from "lucide-react";
import type { PlatformChatThread, PlatformChatMessage } from "@shared/schema";

const PLATFORMS = [
  { value: "shopee", label: "Shopee", hex: "#EE4D2D", chatLabel: "Shopee Chat" },
  { value: "lazada", label: "Lazada", hex: "#0F146D", chatLabel: "Lazada Chat" },
  { value: "tiktok", label: "TikTok", hex: "#000000", chatLabel: "TikTok Shop Chat" },
  { value: "amazon", label: "Amazon", hex: "#FF9900", chatLabel: "Amazon Chat" },
  { value: "line", label: "LINE OA", hex: "#06C755", chatLabel: "LINE Official" },
  { value: "facebook", label: "Facebook", hex: "#1877F2", chatLabel: "Facebook Messenger" },
  { value: "instagram", label: "Instagram", hex: "#E4405F", chatLabel: "Instagram DM" },
] as const;

const FILTER_TABS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "shopee", label: "Shopee" },
  { value: "lazada", label: "Lazada" },
  { value: "tiktok", label: "TikTok" },
  { value: "line", label: "LINE" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
];

function getPlatform(value: string) {
  return PLATFORMS.find((p) => p.value === value);
}

function formatTime(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาที`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชม.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วัน`;
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short" });
}

function formatMessageTime(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function PlatformDot({ platform }: { platform: string }) {
  const p = getPlatform(platform);
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
      style={{ backgroundColor: p?.hex || "#999" }}
      data-testid={`dot-platform-${platform}`}
    />
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const p = getPlatform(platform);
  if (!p) return <Badge variant="secondary">{platform}</Badge>;
  return (
    <Badge
      className="text-white text-[10px] px-1.5 py-0 h-5"
      style={{ backgroundColor: p.hex }}
      data-testid={`badge-platform-${platform}`}
    >
      {p.label}
    </Badge>
  );
}

type OrderItem = {
  productId: number;
  productName: string;
  sku: string;
  price: number;
  qty: number;
};

export default function EcommerceChatInbox() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [platformFilter, setPlatformFilter] = useState("all");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderCreated, setOrderCreated] = useState(false);
  const [showChatOrders, setShowChatOrders] = useState(false);

  const { data: threads = [], isLoading: threadsLoading } = useQuery<PlatformChatThread[]>({
    queryKey: ["/api/ecommerce/chat/threads", selectedCompanyId, platformFilter],
    queryFn: async () => {
      let url = `/api/ecommerce/chat/threads?companyId=${selectedCompanyId}`;
      if (platformFilter !== "all") url += `&platform=${platformFilter}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch threads");
      return r.json();
    },
    enabled: !!selectedCompanyId,
    refetchInterval: 30000,
  });

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<PlatformChatMessage[]>({
    queryKey: ["/api/ecommerce/chat/threads", selectedThreadId, "messages"],
    queryFn: async () => {
      const r = await fetch(`/api/ecommerce/chat/threads/${selectedThreadId}/messages`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to fetch messages");
      return r.json();
    },
    enabled: !!selectedThreadId,
    refetchInterval: 15000,
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/ecommerce/products", selectedCompanyId, productSearch],
    queryFn: async () => {
      let url = `/api/ecommerce/products?companyId=${selectedCompanyId}&limit=20`;
      if (productSearch) url += `&search=${encodeURIComponent(productSearch)}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId && showCreateOrder,
  });

  const { data: chatOrdersList = [] } = useQuery<any[]>({
    queryKey: ["/api/chat-orders", selectedCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/chat-orders?companyId=${selectedCompanyId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCompanyId,
    refetchInterval: 30000,
  });

  const threadChatOrders = chatOrdersList.filter((o: any) => o.threadId === selectedThreadId);

  const confirmChatOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const r = await fetch(`/api/chat-orders/${orderId}/confirm`, {
        method: "PATCH", credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ยืนยันคำสั่งซื้อสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/chat-orders"] });
    },
    onError: (err: any) => { toast({ title: "ไม่สามารถยืนยัน", description: err.message, variant: "destructive" }); },
  });

  const cancelChatOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const r = await fetch(`/api/chat-orders/${orderId}/cancel`, {
        method: "PATCH", credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "ยกเลิกคำสั่งซื้อแล้ว" });
      queryClient.invalidateQueries({ queryKey: ["/api/chat-orders"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({ threadId, content }: { threadId: number; content: string }) => {
      const r = await fetch(`/api/ecommerce/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!r.ok) throw new Error("Failed to send");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/chat/threads", selectedThreadId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/chat/threads", selectedCompanyId] });
      setMessageInput("");
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/ecommerce/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed to create order");
      return r.json();
    },
    onSuccess: () => {
      setOrderCreated(true);
      toast({ title: "สร้างคำสั่งซื้อสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/orders"] });
    },
    onError: (err: any) => {
      toast({ title: "ไม่สามารถสร้างคำสั่งซื้อ", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const totalUnread = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);

  const handleSend = () => {
    if (!messageInput.trim() || !selectedThreadId) return;
    sendMutation.mutate({ threadId: selectedThreadId, content: messageInput.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openCreateOrder = () => {
    setOrderItems([]);
    setCustomerName(selectedThread?.buyerName || "");
    setCustomerPhone("");
    setCustomerAddress("");
    setOrderNote("");
    setProductSearch("");
    setOrderCreated(false);
    setShowCreateOrder(true);
  };

  const addProduct = (product: any) => {
    const existing = orderItems.find((i) => i.productId === product.id);
    if (existing) {
      setOrderItems(orderItems.map((i) => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setOrderItems([...orderItems, {
        productId: product.id,
        productName: product.name,
        sku: product.sku || "",
        price: parseFloat(product.sellingPrice || product.price || "0"),
        qty: 1,
      }]);
    }
  };

  const updateQty = (productId: number, delta: number) => {
    setOrderItems(orderItems.map((i) => {
      if (i.productId === productId) {
        const newQty = Math.max(1, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const removeItem = (productId: number) => {
    setOrderItems(orderItems.filter((i) => i.productId !== productId));
  };

  const orderTotal = orderItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  const handleCreateOrder = () => {
    if (orderItems.length === 0) {
      toast({ title: "กรุณาเพิ่มสินค้า", variant: "destructive" });
      return;
    }
    createOrderMutation.mutate({
      companyId: selectedCompanyId,
      platform: selectedThread?.platform || "direct",
      platformOrderId: `CHAT-${Date.now()}`,
      buyerName: customerName,
      buyerPhone: customerPhone,
      shippingAddress: customerAddress,
      status: "pending",
      totalAmount: orderTotal.toFixed(2),
      currency: "THB",
      notes: orderNote,
      source: "chat",
      chatThreadId: selectedThreadId,
      items: orderItems.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        sku: i.sku,
        quantity: i.qty,
        unitPrice: i.price.toFixed(2),
        totalPrice: (i.price * i.qty).toFixed(2),
      })),
    });
  };

  return (
    <EcommerceLayout>
      <div className="space-y-4" data-testid="page-chat-inbox">
        <div>
          <h1 className="text-2xl font-bold text-gray-800" data-testid="text-chat-title">
            แชทรวมทุกแพลตฟอร์ม
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            จัดการข้อความจากทุกแพลตฟอร์มในที่เดียว — Shopee, Lazada, TikTok, LINE OA, Facebook, Instagram
          </p>
        </div>

        {threads.length === 0 && !threadsLoading ? (
          <div
            className="bg-white rounded-xl border shadow-sm flex flex-col items-center justify-center py-20 px-6"
            data-testid="empty-state-no-threads"
          >
            <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
              <MessageCircle className="h-10 w-10 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">ยังไม่มีข้อความ</h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              เมื่อเชื่อมต่อ API กับแพลตฟอร์ม ข้อความจากผู้ซื้อจะแสดงที่นี่ สามารถสร้างคำสั่งซื้อจากแชทได้ทันที
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {PLATFORMS.map((p) => (
                <div
                  key={p.value}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
                  data-testid={`supported-platform-${p.value}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.hex }} />
                  {p.chatLabel}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="bg-white rounded-xl border shadow-sm overflow-hidden flex"
            style={{ height: "calc(100vh - 260px)", minHeight: "500px" }}
            data-testid="chat-container"
          >
            {/* Left Panel - Thread List */}
            <div className="w-1/3 border-r flex flex-col" data-testid="panel-threads">
              <div className="px-4 py-3 border-b bg-gray-50/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-[#fb9678]" />
                    <span className="font-semibold text-sm text-gray-800">ข้อความ</span>
                  </div>
                  {totalUnread > 0 && (
                    <Badge
                      className="bg-red-500 text-white text-[10px] px-1.5 h-5 hover:bg-red-500"
                      data-testid="badge-total-unread"
                    >
                      {totalUnread}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => {
                        setPlatformFilter(tab.value);
                        setSelectedThreadId(null);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        platformFilter === tab.value
                          ? "bg-[#fb9678] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      data-testid={`tab-filter-${tab.value}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <ScrollArea className="flex-1">
                {threadsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="divide-y">
                    {threads.map((thread) => (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedThreadId(thread.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                          selectedThreadId === thread.id ? "bg-[#fb9678]/5 border-l-2 border-l-[#fb9678]" : ""
                        }`}
                        data-testid={`thread-item-${thread.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                            <PlatformDot platform={thread.platform} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="font-medium text-sm text-gray-800 truncate"
                                  data-testid={`text-buyer-name-${thread.id}`}
                                >
                                  {thread.buyerName || "ผู้ซื้อ"}
                                </span>
                                <PlatformBadge platform={thread.platform} />
                              </div>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                {formatTime(thread.lastMessageAt)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p
                                className="text-xs text-muted-foreground truncate"
                                data-testid={`text-last-message-${thread.id}`}
                              >
                                {thread.lastMessage || "ยังไม่มีข้อความ"}
                              </p>
                              {(thread.unreadCount || 0) > 0 && (
                                <Badge
                                  className="bg-red-500 text-white text-[9px] px-1.5 h-4 min-w-[16px] flex items-center justify-center hover:bg-red-500 shrink-0"
                                  data-testid={`badge-unread-${thread.id}`}
                                >
                                  {thread.unreadCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right Panel - Message View */}
            <div className="w-2/3 flex flex-col" data-testid="panel-messages">
              {!selectedThread ? (
                <div
                  className="flex-1 flex flex-col items-center justify-center text-muted-foreground"
                  data-testid="empty-state-no-selection"
                >
                  <MessageCircle className="h-16 w-16 text-gray-200 mb-4" />
                  <p className="text-sm font-medium text-gray-400">เลือกแชทเพื่อดูข้อความ</p>
                </div>
              ) : (
                <>
                  {/* Message Header */}
                  <div className="px-4 py-3 border-b bg-gray-50/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
                        <PlatformDot platform={selectedThread.platform} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="font-semibold text-sm text-gray-800"
                            data-testid="text-selected-buyer"
                          >
                            {selectedThread.buyerName || "ผู้ซื้อ"}
                          </span>
                          <PlatformBadge platform={selectedThread.platform} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {selectedThread.status === "active" ? "ออนไลน์" : "ออฟไลน์"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {threadChatOrders.filter((o: any) => o.status === "detected").length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-green-500 text-green-600 hover:bg-green-50 relative"
                          onClick={() => setShowChatOrders(!showChatOrders)}
                          data-testid="button-detected-orders"
                        >
                          <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                          พบคำสั่งซื้อ
                          <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-[9px] px-1 h-4 hover:bg-green-500">
                            {threadChatOrders.filter((o: any) => o.status === "detected").length}
                          </Badge>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-[#fb9678] text-[#fb9678] hover:bg-[#fb9678]/5"
                        onClick={openCreateOrder}
                        data-testid="button-create-order-from-chat"
                      >
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                        สร้างคำสั่งซื้อ
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => setShowChatOrders(!showChatOrders)}
                        data-testid="button-view-orders"
                      >
                        <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                        ดูออเดอร์ ({threadChatOrders.length})
                      </Button>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <ScrollArea className="flex-1 px-4 py-3">
                    {messagesLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <MessageCircle className="h-10 w-10 text-gray-200 mb-3" />
                        <p className="text-sm">ยังไม่มีข้อความในแชทนี้</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((msg) => {
                          const isSeller = msg.senderType === "seller";
                          const isImage = msg.messageType === "image";
                          const msgOrder = chatOrdersList.find((o: any) => o.messageId === msg.id);
                          return (
                            <div key={msg.id}>
                              <div
                                className={`flex ${isSeller ? "justify-end" : "justify-start"}`}
                                data-testid={`message-item-${msg.id}`}
                              >
                                <div
                                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                                    isSeller
                                      ? "bg-[#fb9678] text-white rounded-br-md"
                                      : msgOrder ? "bg-green-50 text-gray-800 rounded-bl-md border border-green-200" : "bg-gray-100 text-gray-800 rounded-bl-md"
                                  }`}
                                >
                                  {!isSeller && msg.senderName && (
                                    <p className="text-[10px] font-medium text-gray-500 mb-0.5">
                                      {msg.senderName}
                                    </p>
                                  )}
                                  {isImage ? (
                                    <div
                                      className="flex items-center gap-2 py-1"
                                      data-testid={`message-image-${msg.id}`}
                                    >
                                      <ImageIcon className="h-5 w-5 opacity-60" />
                                      <span className="text-sm opacity-80">[รูปภาพ]</span>
                                    </div>
                                  ) : (
                                    <p className="text-sm whitespace-pre-wrap break-words">
                                      {msg.content}
                                    </p>
                                  )}
                                  <p
                                    className={`text-[10px] mt-1 ${
                                      isSeller ? "text-white/70" : "text-gray-400"
                                    }`}
                                    data-testid={`text-message-time-${msg.id}`}
                                  >
                                    {formatMessageTime(msg.createdAt)}
                                  </p>
                                </div>
                              </div>
                              {msgOrder && (
                                <div className={`flex ${isSeller ? "justify-end" : "justify-start"} mt-1`}>
                                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 max-w-[70%]" data-testid={`chat-order-badge-${msgOrder.id}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <ShoppingBag className="h-3 w-3 text-green-600" />
                                      <span className="text-[11px] font-semibold text-green-700">พบคำสั่งซื้อ</span>
                                      <Badge className={`text-[9px] px-1 h-4 ${msgOrder.status === "confirmed" ? "bg-blue-500" : msgOrder.status === "cancelled" ? "bg-gray-400" : "bg-green-500"} text-white`}>
                                        {msgOrder.status === "detected" ? "รอยืนยัน" : msgOrder.status === "confirmed" ? "ยืนยันแล้ว" : "ยกเลิก"}
                                      </Badge>
                                    </div>
                                    <div className="text-[11px] text-gray-600">
                                      {(() => {
                                        try {
                                          const prods = JSON.parse(msgOrder.parsedProducts || "[]");
                                          return prods.map((p: any, i: number) => (
                                            <div key={i}>{p.name} x{p.qty} {p.price > 0 ? `฿${p.price}` : ""}</div>
                                          ));
                                        } catch { return null; }
                                      })()}
                                      {Number(msgOrder.totalAmount) > 0 && (
                                        <div className="font-semibold text-green-700 mt-0.5">รวม: ฿{Number(msgOrder.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
                                      )}
                                    </div>
                                    {msgOrder.status === "detected" && (
                                      <div className="flex gap-1.5 mt-1.5">
                                        <Button size="sm" className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-700" onClick={() => confirmChatOrderMutation.mutate(msgOrder.id)} disabled={confirmChatOrderMutation.isPending} data-testid={`button-confirm-order-${msgOrder.id}`}>
                                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> ยืนยัน
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-red-500 border-red-300" onClick={() => cancelChatOrderMutation.mutate(msgOrder.id)} data-testid={`button-cancel-order-${msgOrder.id}`}>
                                          ยกเลิก
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="border-t px-4 py-3 bg-white" data-testid="message-input-area">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="พิมพ์ข้อความ..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 rounded-full border-gray-200 focus-visible:ring-[#fb9678]"
                        data-testid="input-message"
                      />
                      <Button
                        size="icon"
                        className="rounded-full shrink-0 bg-[#fb9678] hover:bg-[#e8855a]"
                        onClick={handleSend}
                        disabled={!messageInput.trim() || sendMutation.isPending}
                        data-testid="button-send-message"
                      >
                        {sendMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 px-1">
                      <Info className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-[10px] text-muted-foreground/60">
                        เมื่อเชื่อมต่อ API ข้อความจะส่งถึงผู้ซื้อโดยตรง | กดปุ่ม "สร้างคำสั่งซื้อ" เพื่อเปิดออเดอร์จากแชท
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Order from Chat Dialog */}
      <Dialog open={showCreateOrder} onOpenChange={setShowCreateOrder}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-[#fb9678]" />
              สร้างคำสั่งซื้อจากแชท
              {selectedThread && (
                <PlatformBadge platform={selectedThread.platform} />
              )}
            </DialogTitle>
          </DialogHeader>

          {orderCreated ? (
            <div className="flex flex-col items-center py-12" data-testid="order-created-success">
              <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">สร้างคำสั่งซื้อสำเร็จ!</h3>
              <p className="text-sm text-muted-foreground mb-6">ออเดอร์ถูกสร้างเรียบร้อยแล้ว สามารถดูได้ในหน้ารายการคำสั่งซื้อ</p>
              <Button onClick={() => setShowCreateOrder(false)} className="bg-[#fb9678] hover:bg-[#e8855a]" data-testid="button-close-order-success">
                ปิด
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Customer Info */}
              <Card className="p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  ข้อมูลลูกค้า
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">ชื่อลูกค้า</label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="ชื่อ-นามสกุล"
                      data-testid="input-customer-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">เบอร์โทร</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="08x-xxx-xxxx"
                        className="pl-9"
                        data-testid="input-customer-phone"
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">ที่อยู่จัดส่ง</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-3.5 w-3.5 text-muted-foreground" />
                      <textarea
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="ที่อยู่สำหรับจัดส่งสินค้า"
                        className="w-full pl-9 pr-3 py-2 text-sm border rounded-md min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-[#fb9678]"
                        data-testid="input-customer-address"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Product Search & Add */}
              <Card className="p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  เพิ่มสินค้า
                </h4>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ค้นหาสินค้าด้วยชื่อหรือ SKU..."
                    className="pl-10"
                    data-testid="input-product-search"
                  />
                </div>
                {products.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                    {(Array.isArray(products) ? products : []).slice(0, 10).map((product: any) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        onClick={() => addProduct(product)}
                        data-testid={`product-option-${product.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {product.sku || "-"} | ราคา: ฿{parseFloat(product.sellingPrice || product.price || "0").toLocaleString()}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-[#fb9678] shrink-0" data-testid={`button-add-product-${product.id}`}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Order Items */}
              {orderItems.length > 0 && (
                <Card className="p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">รายการสินค้า ({orderItems.length} รายการ)</h4>
                  <div className="space-y-2">
                    {orderItems.map((item) => (
                      <div key={item.productId} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg" data-testid={`order-item-${item.productId}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">SKU: {item.sku} | ฿{item.price.toLocaleString()} x {item.qty}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.productId, -1)} data-testid={`button-qty-minus-${item.productId}`}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium" data-testid={`text-qty-${item.productId}`}>{item.qty}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.productId, 1)} data-testid={`button-qty-plus-${item.productId}`}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm font-semibold text-right w-24" data-testid={`text-item-total-${item.productId}`}>
                          ฿{(item.price * item.qty).toLocaleString()}
                        </p>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removeItem(item.productId)} data-testid={`button-remove-item-${item.productId}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <span className="text-sm font-semibold text-gray-700">รวมทั้งสิ้น</span>
                    <span className="text-lg font-bold text-[#fb9678]" data-testid="text-order-total">
                      ฿{orderTotal.toLocaleString()}
                    </span>
                  </div>
                </Card>
              )}

              {/* Note */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">หมายเหตุ</label>
                <Input
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                  data-testid="input-order-note"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowCreateOrder(false)} data-testid="button-cancel-order">
                  ยกเลิก
                </Button>
                <Button
                  className="bg-[#fb9678] hover:bg-[#e8855a]"
                  onClick={handleCreateOrder}
                  disabled={orderItems.length === 0 || createOrderMutation.isPending}
                  data-testid="button-confirm-create-order"
                >
                  {createOrderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ShoppingCart className="h-4 w-4 mr-2" />
                  )}
                  สร้างคำสั่งซื้อ (฿{orderTotal.toLocaleString()})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Chat Orders Panel */}
      <Dialog open={showChatOrders} onOpenChange={setShowChatOrders}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-green-600" />
              คำสั่งซื้อจากแชท
              {selectedThread && <PlatformBadge platform={selectedThread.platform} />}
            </DialogTitle>
          </DialogHeader>
          {threadChatOrders.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 text-gray-200 mb-3" />
              <p className="text-sm">ยังไม่พบคำสั่งซื้อในแชทนี้</p>
              <p className="text-xs text-muted-foreground mt-1">ระบบจะตรวจจับอัตโนมัติเมื่อลูกค้าพิมพ์ "CF" หรือ "สั่ง" ตามด้วยชื่อสินค้า</p>
            </div>
          ) : (
            <div className="space-y-3">
              {threadChatOrders.map((order: any) => {
                const prods = (() => { try { return JSON.parse(order.parsedProducts || "[]"); } catch { return []; } })();
                return (
                  <Card key={order.id} className="p-3" data-testid={`chat-order-card-${order.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] px-1.5 h-5 ${order.status === "detected" ? "bg-amber-500" : order.status === "confirmed" ? "bg-green-600" : "bg-gray-400"} text-white`}>
                          {order.status === "detected" ? "รอยืนยัน" : order.status === "confirmed" ? "ยืนยันแล้ว" : "ยกเลิก"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {order.createdAt ? new Date(order.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : ""}
                        </span>
                      </div>
                      {order.status === "confirmed" && order.ecommerceOrderId && (
                        <span className="text-[10px] text-blue-600">#{order.ecommerceOrderId}</span>
                      )}
                    </div>
                    <div className="text-sm space-y-0.5">
                      {prods.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between text-gray-700">
                          <span>{p.name} x{p.qty}</span>
                          {p.price > 0 && <span>฿{(p.qty * p.price).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>}
                        </div>
                      ))}
                    </div>
                    {Number(order.totalAmount) > 0 && (
                      <div className="flex justify-between text-sm font-semibold mt-1 pt-1 border-t">
                        <span>รวม</span>
                        <span className="text-green-700">฿{Number(order.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {order.rawMessage && (
                      <p className="text-[10px] text-muted-foreground mt-1 bg-gray-50 rounded px-2 py-1 italic">"{order.rawMessage}"</p>
                    )}
                    {order.status === "detected" && (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700" onClick={() => confirmChatOrderMutation.mutate(order.id)} disabled={confirmChatOrderMutation.isPending} data-testid={`btn-confirm-${order.id}`}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> ยืนยันคำสั่งซื้อ
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-300" onClick={() => cancelChatOrderMutation.mutate(order.id)} data-testid={`btn-cancel-${order.id}`}>
                          ยกเลิก
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </EcommerceLayout>
  );
}
