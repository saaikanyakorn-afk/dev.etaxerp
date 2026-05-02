import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  MessageCircle, Send, X, ArrowLeft, Plus, Search, Users, User, Hash, ChevronDown, GripVertical,
  Smile, MoreVertical, Trash2, Info, CheckCheck, DoorOpen,
  Paperclip, Pin, CornerUpLeft, FileText, Download, Forward, Pencil, Ban
} from "lucide-react";

interface ChatRoom {
  id: number;
  name: string | null;
  type: string;
  displayName: string;
  members: { userId: number; fullName: string }[];
  lastMessage: { body: string; senderName: string; createdAt: string } | null;
  unreadCount: number;
  lastMessageAt: string | null;
}

interface ChatReaction {
  emoji: string;
  userId: number;
  userName: string;
}

interface ChatMessage {
  id: number;
  roomId: number;
  senderId: number;
  senderName: string;
  body: string;
  messageType: string;
  replyToId?: number | null;
  replyTo?: { id: number; body: string; senderName: string } | null;
  pinnedAt?: string | null;
  pinnedBy?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  reactions?: ChatReaction[];
  createdAt: string;
  readBy?: number[];
  editedAt?: string | null;
  deletedAt?: string | null;
  forwardedFromId?: number | null;
  forwardedFromRoomName?: string | null;
}

interface OrgUser {
  id: number;
  fullName: string;
  username: string;
  role: string;
}

type WidgetView = "closed" | "rooms" | "chat" | "new" | "members";

const WIDGET_EMOJIS = [
  ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘","😗","😋","😛","😜","🤪","😎","🤓","🥳","😏","😌","😴","🤔","🤗","🤭","🤫","🤐","😬","😮","😲","😳","🥺","😢","😭","😤","😡","🤬","😈","💀","💩","🤡","👻","👽","🤖"],
  ["👍","👎","👋","✋","🤚","🖐️","✌️","🤞","🤟","🤘","🤙","👌","🤌","👏","🙌","🤝","🙏","💪","❤️","🧡","💛","💚","💙","💜","🖤","💔","💯","💥","🔥","⭐","✨","🎉","🎊","✅","❌","⭕","❗","❓"],
];

function renderMentionText(text: string): React.ReactNode[] {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return <span key={i} className="bg-blue-200/50 text-blue-700 font-semibold rounded px-0.5">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function InternalChatWidget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<WidgetView>("closed");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [newChatSearch, setNewChatSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteRoom, setShowDeleteRoom] = useState(false);
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<ChatRoom | null>(null);
  const [replyToMsg, setReplyToMsg] = useState<ChatMessage | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<number | null>(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<number | null>(null);

  const [showSearchBar, setShowSearchBar] = useState(false);
  const [msgSearchText, setMsgSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searchHighlightId, setSearchHighlightId] = useState<number | null>(null);

  const [showForwardPanel, setShowForwardPanel] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [forwardSearch, setForwardSearch] = useState("");

  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const [deleteMsgTarget, setDeleteMsgTarget] = useState<ChatMessage | null>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number>(0);

  const lastTypingSentRef = useRef<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean }>({ startX: 0, startY: 0, origX: 0, origY: 0, dragging: false });

  const getInitialPos = () => {
    try {
      const s = localStorage.getItem("chat-widget-pos");
      if (s) return JSON.parse(s);
    } catch {}
    return { x: window.innerWidth - 64, y: window.innerHeight - 140 };
  };
  const [initialPosLoaded] = useState(getInitialPos);
  const defaultPos = initialPosLoaded;
  const [position, setPosition] = useState<{ x: number; y: number }>(defaultPos);
  const [isDragging, setIsDragging] = useState(false);
  const wasDragged = useRef(false);

  const clampPosition = useCallback((x: number, y: number) => {
    const maxX = window.innerWidth - 56;
    const maxY = window.innerHeight - 56;
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y, dragging: true };
    wasDragged.current = false;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged.current = true;
    const newPos = clampPosition(dragRef.current.origX + dx, dragRef.current.origY + dy);
    setPosition(newPos);
  }, [clampPosition]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    setIsDragging(false);
    try { localStorage.setItem("chat-widget-pos", JSON.stringify(position)); } catch {}
  }, [position]);

  useEffect(() => {
    const handleResize = () => setPosition(prev => clampPosition(prev.x, prev.y));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  const isOpen = view !== "closed";

  const { data: rooms = [] } = useQuery<ChatRoom[]>({
    queryKey: ["/api/internal-chat/rooms"],
    refetchInterval: isOpen ? 8000 : false,
    enabled: !!user,
  });

  const { data: orgUsers = [] } = useQuery<OrgUser[]>({
    queryKey: ["/api/internal-chat/users"],
    enabled: !!user && (view === "new" || view === "chat"),
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/internal-chat/rooms", selectedRoomId, "messages"],
    queryFn: () => selectedRoomId ? fetch(`/api/internal-chat/rooms/${selectedRoomId}/messages`, { credentials: "include" }).then(r => r.json()) : Promise.resolve([]),
    enabled: !!selectedRoomId && view === "chat",
    refetchInterval: view === "chat" && selectedRoomId ? 5000 : false,
  });

  const { data: typingUsers = [] } = useQuery<{ userId: number; fullName: string }[]>({
    queryKey: ["/api/internal-chat/rooms", selectedRoomId, "typing"],
    queryFn: () => selectedRoomId ? fetch(`/api/internal-chat/rooms/${selectedRoomId}/typing`, { credentials: "include" }).then(r => r.json()) : Promise.resolve([]),
    enabled: !!selectedRoomId && view === "chat",
    refetchInterval: selectedRoomId && view === "chat" ? 2000 : false,
  });

  const sendMutation = useMutation({
    mutationFn: (data: { body: string; replyToId?: number; attachmentUrl?: string; attachmentName?: string }) =>
      apiRequest("POST", `/api/internal-chat/rooms/${selectedRoomId}/messages`, data),
    onSuccess: () => {
      setMessageText("");
      setReplyToMsg(null);
      refetchMessages();
      qc.invalidateQueries({ queryKey: ["/api/internal-chat/rooms"] });
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({ msgId, emoji }: { msgId: number; emoji: string }) =>
      apiRequest("POST", `/api/internal-chat/rooms/${selectedRoomId}/messages/${msgId}/reactions`, { emoji }),
    onSuccess: () => refetchMessages(),
  });

  const pinMutation = useMutation({
    mutationFn: (msgId: number) =>
      apiRequest("PATCH", `/api/internal-chat/rooms/${selectedRoomId}/messages/${msgId}/pin`),
    onSuccess: () => refetchMessages(),
  });

  const createRoomMutation = useMutation({
    mutationFn: (data: { name?: string; type: string; memberIds: number[] }) =>
      apiRequest("POST", "/api/internal-chat/rooms", data),
    onSuccess: async (res) => {
      const room = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/internal-chat/rooms"] });
      setSelectedRoomId(room.id);
      setView("chat");
      setSelectedUserIds([]);
      setGroupName("");
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/internal-chat/rooms/${selectedRoomId}/messages`),
    onSuccess: () => {
      refetchMessages();
      qc.invalidateQueries({ queryKey: ["/api/internal-chat/rooms"] });
      setShowDeleteConfirm(false);
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (roomId?: number) => apiRequest("DELETE", `/api/internal-chat/rooms/${roomId || selectedRoomId}`),
    onSuccess: (_data, roomId) => {
      qc.invalidateQueries({ queryKey: ["/api/internal-chat/rooms"] });
      if ((roomId || selectedRoomId) === selectedRoomId) {
        setSelectedRoomId(null);
      }
      setShowDeleteRoom(false);
      setDeleteRoomTarget(null);
      if (view === "chat") setView("rooms");
    },
  });

  const forwardMutation = useMutation({
    mutationFn: ({ msgId, targetRoomId }: { msgId: number; targetRoomId: number }) =>
      apiRequest("POST", `/api/internal-chat/rooms/${selectedRoomId}/messages/${msgId}/forward`, { targetRoomId }),
    onSuccess: () => {
      setShowForwardPanel(false);
      setForwardMsg(null);
      setForwardSearch("");
      qc.invalidateQueries({ queryKey: ["/api/internal-chat/rooms"] });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ msgId, body }: { msgId: number; body: string }) =>
      apiRequest("PATCH", `/api/internal-chat/rooms/${selectedRoomId}/messages/${msgId}`, { body }),
    onSuccess: () => {
      setEditingMsgId(null);
      setEditText("");
      refetchMessages();
    },
  });

  const deleteMsgMutation = useMutation({
    mutationFn: (msgId: number) =>
      apiRequest("DELETE", `/api/internal-chat/rooms/${selectedRoomId}/messages/${msgId}`),
    onSuccess: () => {
      setDeleteMsgTarget(null);
      refetchMessages();
    },
  });

  const sendTyping = useCallback(() => {
    if (!selectedRoomId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    fetch(`/api/internal-chat/rooms/${selectedRoomId}/typing`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  }, [selectedRoomId]);

  useEffect(() => {
    if (selectedRoomId && view === "chat") {
      fetch(`/api/internal-chat/rooms/${selectedRoomId}/read`, {
        method: "PATCH",
        credentials: "include",
      });
    }
  }, [selectedRoomId, messages.length, view]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (view === "chat") inputRef.current?.focus();
  }, [view, selectedRoomId]);

  useEffect(() => {
    if (searchHighlightId) {
      const el = document.querySelector(`[data-testid="widget-msg-${searchHighlightId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchHighlightId]);

  useEffect(() => {
    if (showSearchBar && searchInputRef.current) searchInputRef.current.focus();
  }, [showSearchBar]);

  useEffect(() => {
    if (editingMsgId && editInputRef.current) editInputRef.current.focus();
  }, [editingMsgId]);

  const handleSearchMessages = useCallback(async () => {
    if (!selectedRoomId || !msgSearchText.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/internal-chat/rooms/${selectedRoomId}/messages/search?q=${encodeURIComponent(msgSearchText.trim())}`, { credentials: "include" });
      const data = await res.json();
      setSearchResults(data);
      if (data.length > 0) setSearchHighlightId(data[0].id);
    } catch {
      setSearchResults([]);
    }
  }, [selectedRoomId, msgSearchText]);

  useEffect(() => {
    const t = setTimeout(handleSearchMessages, 400);
    return () => clearTimeout(t);
  }, [msgSearchText, handleSearchMessages]);

  const handleSend = () => {
    if (!messageText.trim() || !selectedRoomId) return;
    sendMutation.mutate({
      body: messageText.trim(),
      ...(replyToMsg ? { replyToId: replyToMsg.id } : {}),
    });
    setMentionQuery(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoomId) return;
    try {
      const res = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name, size: file.size, contentType: file.type,
      });
      const { uploadURL, objectPath } = await res.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      sendMutation.mutate({
        body: "",
        attachmentUrl: objectPath,
        attachmentName: file.name,
        ...(replyToMsg ? { replyToId: replyToMsg.id } : {}),
      });
    } catch (err) { console.error("Upload failed", err); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isImageFile = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const canEditMessage = (msg: ChatMessage) => {
    if (msg.senderId !== user?.id) return false;
    if (msg.deletedAt) return false;
    const createdAt = new Date(msg.createdAt).getTime();
    return Date.now() - createdAt < 15 * 60 * 1000;
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessageText(val);
    sendTyping();

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\S*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setMentionStartPos(cursorPos - atMatch[0].length);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const members = selectedRoom?.members || [];
    const memberUsers = members
      .filter(m => m.userId !== user?.id)
      .map(m => {
        const ou = orgUsers.find(u => u.id === m.userId);
        return { userId: m.userId, fullName: m.fullName, username: ou?.username || "" };
      });
    if (!mentionQuery) return memberUsers.slice(0, 6);
    return memberUsers.filter(u =>
      u.fullName.toLowerCase().includes(mentionQuery) ||
      u.username.toLowerCase().includes(mentionQuery)
    ).slice(0, 6);
  }, [mentionQuery, selectedRoom, orgUsers, user]);

  const insertMention = (candidate: { username: string; fullName: string }) => {
    const before = messageText.slice(0, mentionStartPos);
    const after = messageText.slice(inputRef.current?.selectionStart || messageText.length);
    const mention = `@${candidate.username} `;
    setMessageText(before + mention + after);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionQuery !== null && mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(prev => Math.min(prev + 1, mentionCandidates.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMsgId && editText.trim()) {
        editMutation.mutate({ msgId: editingMsgId, body: editText.trim() });
      }
    }
    if (e.key === "Escape") {
      setEditingMsgId(null);
      setEditText("");
    }
  };

  const totalUnread = rooms.reduce((sum, r) => sum + r.unreadCount, 0);

  const filteredRooms = useMemo(() => {
    if (!searchText.trim()) return rooms;
    const q = searchText.toLowerCase();
    return rooms.filter(r => r.displayName?.toLowerCase().includes(q));
  }, [rooms, searchText]);

  const filteredOrgUsers = useMemo(() => {
    if (!newChatSearch.trim()) return orgUsers;
    const q = newChatSearch.toLowerCase();
    return orgUsers.filter(u => u.fullName?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q));
  }, [orgUsers, newChatSearch]);

  const forwardFilteredRooms = useMemo(() => {
    const otherRooms = rooms.filter(r => r.id !== selectedRoomId);
    if (!forwardSearch.trim()) return otherRooms;
    const q = forwardSearch.toLowerCase();
    return otherRooms.filter(r => r.displayName?.toLowerCase().includes(q));
  }, [rooms, selectedRoomId, forwardSearch]);

  const typingText = useMemo(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].fullName} กำลังพิมพ์...`;
    if (typingUsers.length === 2) return `${typingUsers[0].fullName} และ ${typingUsers[1].fullName} กำลังพิมพ์...`;
    return `${typingUsers.length} คนกำลังพิมพ์...`;
  }, [typingUsers]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  };

  const openRoom = (roomId: number) => {
    setSelectedRoomId(roomId);
    setView("chat");
  };

  const handleCreateChat = () => {
    if (selectedUserIds.length === 0) return;
    createRoomMutation.mutate({
      name: selectedUserIds.length > 1 ? groupName || undefined : undefined,
      type: selectedUserIds.length > 1 ? "group" : "direct",
      memberIds: selectedUserIds,
    });
  };

  const toggleUserId = (id: number) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const pathname = window.location.pathname;
  const isPublicPage = pathname === "/" || pathname === "/landing" || pathname === "/about" || pathname === "/register" || pathname === "/login" || pathname.startsWith("/pricing") || pathname.startsWith("/ecommerce-pricing") || pathname.startsWith("/food-delivery-pricing") || pathname.startsWith("/accounting-pricing");

  if (!user || isPublicPage) return null;
  if (pathname === "/office/chat") return null;
  if (pathname === "/pos/terminal" || pathname === "/restaurant-pos") return null;
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  if (user && !isDashboard) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-40 print:!hidden"
      style={{ left: position.x, top: position.y, touchAction: "none" }}
      data-testid="internal-chat-widget"
    >
      {isOpen && (
        <div
          className="absolute w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
          style={{
            height: "min(520px, calc(100vh - 120px))",
            ...(position.y > window.innerHeight / 2
              ? { bottom: 56, left: 0 }
              : { top: 56, left: 0 }),
          }}
          data-testid="internal-chat-panel"
        >
          {view === "rooms" && (
            <>
              <div className="px-4 py-3 flex items-center justify-between shrink-0 border-b" style={{ background: "var(--theme-primary)" }}>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-white" />
                  <span className="font-semibold text-sm text-white">แชทภายใน</span>
                  {totalUnread > 0 && (
                    <span className="bg-white text-[#fb9678] text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{totalUnread}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setView("new"); setNewChatSearch(""); setSelectedUserIds([]); setGroupName(""); }}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    data-testid="widget-btn-new-chat"
                  >
                    <Plus className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={() => setView("closed")}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    data-testid="widget-btn-close"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="px-3 py-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาแชท..."
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#fb9678] bg-gray-50"
                    data-testid="widget-search-rooms"
                  />
                </div>
              </div>
              {deleteRoomTarget && view === "rooms" && (
                <div className="px-3 py-2 border-b bg-red-50">
                  <p className="text-xs text-red-700 font-medium mb-2">ลบห้อง "{deleteRoomTarget.displayName}"?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteRoomTarget(null)}
                      className="flex-1 py-1.5 text-xs border rounded-lg hover:bg-gray-50 bg-white"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => deleteRoomMutation.mutate(deleteRoomTarget.id)}
                      disabled={deleteRoomMutation.isPending}
                      className="flex-1 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                    >
                      {deleteRoomMutation.isPending ? "กำลังลบ..." : "ลบ"}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {filteredRooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <MessageCircle className="h-8 w-8 mb-2 opacity-30" />
                    <span className="text-xs">ยังไม่มีแชท</span>
                    <button
                      onClick={() => { setView("new"); setNewChatSearch(""); setSelectedUserIds([]); }}
                      className="mt-2 text-xs font-medium text-[#fb9678] hover:underline"
                    >
                      เริ่มแชทใหม่
                    </button>
                  </div>
                ) : (
                  filteredRooms.map(room => (
                    <div
                      key={room.id}
                      className={cn(
                        "group w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer relative",
                        room.unreadCount > 0 && "bg-orange-50/40"
                      )}
                      onClick={() => openRoom(room.id)}
                      data-testid={`widget-room-${room.id}`}
                    >
                      <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                        style={{ background: room.type === "group" ? "#03c9d7" : "#fb9678" }}>
                        {room.type === "group" ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-sm truncate", room.unreadCount > 0 ? "font-semibold text-gray-900" : "text-gray-700")}>
                            {room.displayName}
                          </span>
                          {room.lastMessage && (
                            <span className="text-[10px] text-gray-400 shrink-0 ml-2">{formatTime(room.lastMessage.createdAt)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs text-gray-500 truncate">
                            {room.lastMessage ? `${room.lastMessage.senderName}: ${room.lastMessage.body}` : "ยังไม่มีข้อความ"}
                          </span>
                          {room.unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0 ml-1">
                              {room.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={(e) => { e.stopPropagation(); setDeleteRoomTarget(room); }}
                        data-testid={`widget-btn-delete-room-${room.id}`}
                        title="ลบห้องแชท"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {view === "chat" && selectedRoom && (
            <>
              <div className="px-3 py-2.5 flex items-center gap-2 shrink-0 border-b" style={{ background: "var(--theme-primary)" }}>
                <button
                  onClick={() => setView("rooms")}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  data-testid="widget-btn-back"
                >
                  <ArrowLeft className="h-4 w-4 text-white" />
                </button>
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: selectedRoom.type === "group" ? "#03c9d7" : "rgba(255,255,255,0.3)" }}>
                  {selectedRoom.type === "group" ? <Hash className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm text-white truncate block">{selectedRoom.displayName}</span>
                  {typingText && (
                    <span className="text-[10px] text-green-200 animate-pulse block" data-testid="widget-typing-indicator">{typingText}</span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => {
                      setShowSearchBar(!showSearchBar);
                      if (showSearchBar) {
                        setMsgSearchText("");
                        setSearchResults([]);
                        setSearchHighlightId(null);
                      }
                    }}
                    className={cn("p-1 hover:bg-white/20 rounded transition-colors", showSearchBar && "bg-white/20")}
                    data-testid="widget-btn-search-messages"
                    title="ค้นหาข้อความ"
                  >
                    <Search className="h-3.5 w-3.5 text-white" />
                  </button>
                  {selectedRoom.type === "group" && (
                    <button
                      onClick={() => setView("members")}
                      className="p-1 hover:bg-white/20 rounded transition-colors"
                      data-testid="widget-btn-members"
                      title="ดูสมาชิก"
                    >
                      <Users className="h-4 w-4 text-white" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowPinnedPanel(!showPinnedPanel)}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    data-testid="widget-btn-pinned"
                    title="ข้อความปักหมุด"
                  >
                    <Pin className="h-3.5 w-3.5 text-white" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    data-testid="widget-btn-delete-chat"
                    title="ลบประวัติแชท"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-white" />
                  </button>
                  <button
                    onClick={() => setShowDeleteRoom(true)}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    data-testid="widget-btn-delete-room"
                    title="ลบห้องแชท"
                  >
                    <DoorOpen className="h-3.5 w-3.5 text-white" />
                  </button>
                  <button
                    onClick={() => setView("closed")}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>

              {showSearchBar && (
                <div className="border-b bg-white px-3 py-1.5 flex items-center gap-1.5" data-testid="widget-msg-search-bar">
                  <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="ค้นหาข้อความ..."
                    className="flex-1 text-sm py-1 focus:outline-none bg-transparent"
                    value={msgSearchText}
                    onChange={e => setMsgSearchText(e.target.value)}
                    data-testid="widget-input-search-messages"
                  />
                  {searchResults.length > 0 && (
                    <span className="text-[10px] text-gray-400 shrink-0">{searchResults.length}</span>
                  )}
                  {searchResults.length > 1 && (
                    <div className="flex items-center gap-0.5">
                      <button
                        className="p-0.5 hover:bg-gray-100 rounded text-gray-500"
                        onClick={() => {
                          const idx = searchResults.findIndex(r => r.id === searchHighlightId);
                          const prev = idx > 0 ? idx - 1 : searchResults.length - 1;
                          setSearchHighlightId(searchResults[prev].id);
                        }}
                        data-testid="widget-btn-search-prev"
                      >
                        <ArrowLeft className="h-3 w-3 rotate-90" />
                      </button>
                      <button
                        className="p-0.5 hover:bg-gray-100 rounded text-gray-500"
                        onClick={() => {
                          const idx = searchResults.findIndex(r => r.id === searchHighlightId);
                          const next = idx < searchResults.length - 1 ? idx + 1 : 0;
                          setSearchHighlightId(searchResults[next].id);
                        }}
                        data-testid="widget-btn-search-next"
                      >
                        <ArrowLeft className="h-3 w-3 -rotate-90" />
                      </button>
                    </div>
                  )}
                  <button
                    className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                    onClick={() => {
                      setShowSearchBar(false);
                      setMsgSearchText("");
                      setSearchResults([]);
                      setSearchHighlightId(null);
                    }}
                    data-testid="widget-btn-close-search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {showPinnedPanel && (
                <div className="border-b bg-yellow-50 px-3 py-2 max-h-32 overflow-y-auto">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                      <Pin className="h-3 w-3 text-yellow-600" /> ปักหมุด
                    </span>
                    <button onClick={() => setShowPinnedPanel(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {messages.filter(m => m.pinnedAt).length === 0 ? (
                    <p className="text-[10px] text-gray-400">ไม่มีข้อความปักหมุด</p>
                  ) : (
                    messages.filter(m => m.pinnedAt).map(pm => (
                      <div key={pm.id} className="bg-white rounded px-2 py-1 mb-1 border text-[10px]">
                        <span className="font-medium text-gray-700">{pm.senderName}: </span>
                        <span className="text-gray-600">{pm.body?.slice(0, 50)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {showForwardPanel && forwardMsg && (
                <div className="border-b bg-white px-3 py-2 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                      <Forward className="h-3 w-3 text-[#fb9678]" /> ส่งต่อข้อความ
                    </span>
                    <button onClick={() => { setShowForwardPanel(false); setForwardMsg(null); setForwardSearch(""); }} className="text-gray-400 hover:text-gray-600">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded px-2 py-1 mb-1.5 border text-[10px]">
                    <span className="font-medium text-gray-500">{forwardMsg.senderName}: </span>
                    <span className="text-gray-600">{forwardMsg.body?.slice(0, 60) || forwardMsg.attachmentName || ""}</span>
                  </div>
                  <div className="relative mb-1.5">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาห้องแชท..."
                      value={forwardSearch}
                      onChange={e => setForwardSearch(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-[11px] border rounded focus:outline-none focus:ring-1 focus:ring-[#fb9678] bg-gray-50"
                      data-testid="widget-input-forward-search"
                    />
                  </div>
                  {forwardFilteredRooms.length === 0 && (
                    <p className="text-center text-gray-400 text-[10px] py-1">ไม่พบห้องแชท</p>
                  )}
                  {forwardFilteredRooms.slice(0, 5).map(room => (
                    <button
                      key={room.id}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 transition-colors text-[11px]"
                      onClick={() => {
                        if (forwardMsg) forwardMutation.mutate({ msgId: forwardMsg.id, targetRoomId: room.id });
                      }}
                      disabled={forwardMutation.isPending}
                      data-testid={`widget-forward-room-${room.id}`}
                    >
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0", room.type === "group" ? "bg-[#03c9d7]" : "bg-[#fb9678]")}>
                        {room.type === "group" ? <Users className="h-3 w-3" /> : (room.displayName?.charAt(0) || "?")}
                      </div>
                      <span className="truncate flex-1 text-gray-700">{room.displayName}</span>
                      <Forward className="h-3 w-3 text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {deleteMsgTarget && (
                <div className="border-b bg-red-50 px-3 py-2">
                  <p className="text-[11px] text-red-700 font-medium mb-1">ลบข้อความนี้?</p>
                  <div className="bg-white rounded px-2 py-1 mb-1.5 border text-[10px] text-gray-600 line-clamp-2">
                    {deleteMsgTarget.body || deleteMsgTarget.attachmentName || ""}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteMsgTarget(null)}
                      className="flex-1 py-1 text-[11px] border rounded hover:bg-gray-50 bg-white"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => deleteMsgMutation.mutate(deleteMsgTarget.id)}
                      disabled={deleteMsgMutation.isPending}
                      className="flex-1 py-1 text-[11px] bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                    >
                      {deleteMsgMutation.isPending ? "กำลังลบ..." : "ลบ"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 bg-gray-50">
                {messages.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-8">
                    <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <div>ยังไม่มีข้อความ</div>
                  </div>
                )}
                {messages.map(msg => {
                  const isMe = msg.senderId === user?.id;
                  const isHovered = hoveredMsgId === msg.id;
                  const isDeleted = !!msg.deletedAt;
                  const isEditing = editingMsgId === msg.id;
                  const isHighlighted = searchHighlightId === msg.id;
                  const grouped = msg.reactions?.reduce<Record<string, { count: number; users: string[]; hasMe: boolean }>>((acc, r) => {
                    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], hasMe: false };
                    acc[r.emoji].count++;
                    acc[r.emoji].users.push(r.userName);
                    if (r.userId === user?.id) acc[r.emoji].hasMe = true;
                    return acc;
                  }, {}) || {};

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex relative",
                        isMe ? "justify-end" : "justify-start",
                        isHighlighted && "ring-2 ring-yellow-400 ring-offset-1 rounded-xl"
                      )}
                      data-testid={`widget-msg-${msg.id}`}
                      onMouseEnter={() => setHoveredMsgId(msg.id)}
                      onMouseLeave={() => { setHoveredMsgId(null); setReactionPickerMsgId(null); }}
                    >
                      <div className={cn("max-w-[80%] relative", isMe && "")}>
                        {isHovered && !isDeleted && !isEditing && (
                          <div className={cn(
                            "absolute -top-6 z-10 flex items-center gap-0.5 bg-white border rounded shadow px-0.5 py-0.5",
                            isMe ? "right-0" : "left-0"
                          )}>
                            <button className="p-0.5 hover:bg-gray-100 rounded text-gray-500" onClick={() => { setReplyToMsg(msg); inputRef.current?.focus(); }} title="ตอบกลับ">
                              <CornerUpLeft className="h-3 w-3" />
                            </button>
                            <button className="p-0.5 hover:bg-gray-100 rounded text-gray-500" onClick={() => { setForwardMsg(msg); setShowForwardPanel(true); }} title="ส่งต่อ">
                              <Forward className="h-3 w-3" />
                            </button>
                            <button className="p-0.5 hover:bg-gray-100 rounded text-gray-500" onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)} title="รีแอค">
                              <Smile className="h-3 w-3" />
                            </button>
                            <button className="p-0.5 hover:bg-gray-100 rounded text-gray-500" onClick={() => pinMutation.mutate(msg.id)} title={msg.pinnedAt ? "เลิกปักหมุด" : "ปักหมุด"}>
                              <Pin className={cn("h-3 w-3", msg.pinnedAt && "text-blue-500 fill-blue-500")} />
                            </button>
                            {isMe && canEditMessage(msg) && (
                              <button className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-500" onClick={() => { setEditingMsgId(msg.id); setEditText(msg.body); }} title="แก้ไข">
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            {isMe && (
                              <button className="p-0.5 hover:bg-gray-100 rounded text-gray-500 hover:text-red-500" onClick={() => setDeleteMsgTarget(msg)} title="ลบ">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}

                        {reactionPickerMsgId === msg.id && (
                          <div className={cn("absolute -top-12 z-20 flex items-center gap-0.5 bg-white border rounded-lg shadow-lg px-1 py-0.5", isMe ? "right-0" : "left-0")}>
                            {QUICK_REACTIONS.map(emoji => (
                              <button key={emoji} className="w-6 h-6 flex items-center justify-center text-sm hover:bg-gray-100 rounded-full hover:scale-110" onClick={() => { reactMutation.mutate({ msgId: msg.id, emoji }); setReactionPickerMsgId(null); }}>
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {isDeleted ? (
                          <div className={cn(
                            "rounded-xl px-3 py-1.5 text-[13px] italic",
                            isMe ? "bg-gray-200 text-gray-400 rounded-br-sm" : "bg-gray-100 text-gray-400 border rounded-bl-sm"
                          )} data-testid={`widget-msg-deleted-${msg.id}`}>
                            <div className="flex items-center gap-1">
                              <Ban className="h-3 w-3" />
                              ข้อความถูกลบ
                            </div>
                          </div>
                        ) : isEditing ? (
                          <div className="flex items-center gap-1" data-testid={`widget-msg-edit-${msg.id}`}>
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              className="flex-1 text-[12px] px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-[#fb9678]"
                              data-testid={`widget-input-edit-${msg.id}`}
                            />
                            <button
                              className="px-1.5 py-1 text-[10px] bg-[#fb9678] text-white rounded hover:bg-[#e8856a] disabled:opacity-50"
                              onClick={() => editMutation.mutate({ msgId: msg.id, body: editText.trim() })}
                              disabled={!editText.trim() || editMutation.isPending}
                              data-testid={`widget-btn-save-edit-${msg.id}`}
                            >
                              บันทึก
                            </button>
                            <button
                              className="px-1.5 py-1 text-[10px] border rounded hover:bg-gray-50"
                              onClick={() => { setEditingMsgId(null); setEditText(""); }}
                              data-testid={`widget-btn-cancel-edit-${msg.id}`}
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <div className={cn(
                            "rounded-xl px-3 py-1.5 text-sm",
                            isMe ? "bg-[#fb9678] text-white rounded-br-sm" : "bg-white text-gray-800 border rounded-bl-sm"
                          )}>
                            {msg.pinnedAt && (
                              <div className={cn("flex items-center gap-0.5 text-[9px] mb-0.5", isMe ? "text-white/60" : "text-blue-400")}>
                                <Pin className="h-2 w-2" /> ปักหมุด
                              </div>
                            )}
                            {msg.forwardedFromRoomName && (
                              <div className={cn("flex items-center gap-0.5 text-[9px] mb-0.5", isMe ? "text-white/60" : "text-gray-400")}>
                                <Forward className="h-2 w-2" /> ส่งต่อจาก {msg.forwardedFromRoomName}
                              </div>
                            )}
                            {!isMe && selectedRoom.type === "group" && (
                              <div className="text-[10px] font-medium text-[#03c9d7] mb-0.5">{msg.senderName}</div>
                            )}
                            {msg.replyTo && (
                              <div className={cn("text-[10px] rounded px-1.5 py-0.5 mb-1 border-l-2", isMe ? "bg-white/20 border-white/50 text-white/80" : "bg-gray-50 border-gray-300 text-gray-500")}>
                                <span className="font-medium">{msg.replyTo.senderName}</span>
                                <p className="truncate">{msg.replyTo.body}</p>
                              </div>
                            )}
                            {msg.attachmentUrl && msg.attachmentName && isImageFile(msg.attachmentName) ? (
                              <div>
                                <img src={msg.attachmentUrl} alt={msg.attachmentName} className="max-w-full max-h-40 rounded cursor-pointer" onClick={() => window.open(msg.attachmentUrl!, "_blank")} />
                                {msg.body && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px]">{renderMentionText(msg.body)}</p>}
                              </div>
                            ) : msg.attachmentUrl && msg.attachmentName ? (
                              <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-1.5 px-2 py-1 rounded", isMe ? "bg-white/20 hover:bg-white/30" : "bg-gray-50 hover:bg-gray-100")}>
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="text-[12px] truncate flex-1">{msg.attachmentName}</span>
                                <Download className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <div className="whitespace-pre-wrap break-words text-[13px]">{renderMentionText(msg.body)}</div>
                            )}
                            {msg.editedAt && (
                              <span className={cn("text-[9px]", isMe ? "text-white/50" : "text-gray-400")}>(แก้ไขแล้ว)</span>
                            )}
                            <div className={cn("flex items-center gap-0.5 mt-0.5", "justify-end")}>
                              <span className={cn("text-[10px]", isMe ? "text-white/70" : "text-gray-400")}>{formatTime(msg.createdAt)}</span>
                              {isMe && (
                                <CheckCheck className={cn("h-3 w-3", msg.readBy && msg.readBy.length > 0 ? "text-[#03c9d7]" : "text-white/40")} />
                              )}
                            </div>
                          </div>
                        )}

                        {!isDeleted && Object.keys(grouped).length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5 ml-1">
                            {Object.entries(grouped).map(([emoji, data]) => (
                              <button key={emoji} className={cn("flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[10px] border", data.hasMe ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-600")} onClick={() => reactMutation.mutate({ msgId: msg.id, emoji })} title={data.users.join(", ")}>
                                <span>{emoji}</span><span>{data.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <div className="px-3 py-2 border-t bg-white shrink-0">
                {showDeleteRoom && (
                  <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-700 font-medium mb-2">ลบห้องแชท "{selectedRoom?.displayName}" ทั้งห้อง?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteRoom(false)}
                        className="flex-1 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                        data-testid="widget-btn-cancel-delete-room"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={() => deleteRoomMutation.mutate(selectedRoomId || undefined)}
                        disabled={deleteRoomMutation.isPending}
                        className="flex-1 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                        data-testid="widget-btn-confirm-delete-room"
                      >
                        {deleteRoomMutation.isPending ? "กำลังลบ..." : "ลบห้องแชท"}
                      </button>
                    </div>
                  </div>
                )}
                {showDeleteConfirm && (
                  <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-700 font-medium mb-2">ลบข้อความทั้งหมดในแชทนี้?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                        data-testid="widget-btn-cancel-delete"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={() => clearHistoryMutation.mutate()}
                        disabled={clearHistoryMutation.isPending}
                        className="flex-1 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                        data-testid="widget-btn-confirm-delete"
                      >
                        {clearHistoryMutation.isPending ? "กำลังลบ..." : "ลบทั้งหมด"}
                      </button>
                    </div>
                  </div>
                )}
                <div className="relative">
                  {showEmojiPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                      <div className="absolute bottom-full left-0 mb-1 bg-white border rounded-xl shadow-lg z-50 w-64" data-testid="widget-emoji-picker">
                        <div className="max-h-36 overflow-y-auto p-2">
                          {WIDGET_EMOJIS.map((row, ri) => (
                            <div key={ri} className="flex flex-wrap">
                              {row.map((emoji, ei) => (
                                <button
                                  key={ei}
                                  className="w-7 h-7 flex items-center justify-center text-base hover:bg-gray-100 rounded transition-colors"
                                  onClick={() => {
                                    setMessageText(prev => prev + emoji);
                                    inputRef.current?.focus();
                                  }}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {replyToMsg && (
                  <div className="flex items-center gap-1.5 mb-1.5 px-2 py-1 bg-gray-50 border-l-2 border-[#fb9678] rounded-r text-[11px]">
                    <CornerUpLeft className="h-3 w-3 text-[#fb9678] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-[#fb9678]">{replyToMsg.senderName}</span>
                      <p className="text-gray-500 truncate">{replyToMsg.body || replyToMsg.attachmentName || "ไฟล์แนบ"}</p>
                    </div>
                    <button onClick={() => setReplyToMsg(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1.5 relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1.5 text-gray-400 hover:text-[#fb9678] rounded-full hover:bg-gray-100 transition-colors shrink-0"
                    data-testid="widget-btn-emoji"
                    title="อีโมจิ"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-gray-400 hover:text-[#fb9678] rounded-full hover:bg-gray-100 transition-colors shrink-0"
                    data-testid="widget-btn-attach"
                    title="แนบไฟล์"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="พิมพ์ข้อความ... (@ แท็ก)"
                      value={messageText}
                      onChange={handleMessageInputChange}
                      onKeyDown={handleKeyDown}
                      className="w-full px-3 py-2 text-sm border rounded-full focus:outline-none focus:ring-1 focus:ring-[#fb9678] bg-gray-50"
                      data-testid="widget-input-message"
                    />
                    {mentionQuery !== null && mentionCandidates.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-1 w-full bg-white border rounded-lg shadow-xl z-50 max-h-36 overflow-y-auto" data-testid="widget-mention-dropdown">
                        {mentionCandidates.map((c, idx) => (
                          <button
                            key={c.userId}
                            className={cn(
                              "w-full text-left px-2 py-1.5 flex items-center gap-2 hover:bg-gray-50 transition-colors text-[12px]",
                              idx === mentionIndex && "bg-orange-50"
                            )}
                            onClick={() => insertMention(c)}
                            data-testid={`widget-mention-option-${c.userId}`}
                          >
                            <div className="w-5 h-5 rounded-full bg-[#03c9d7] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                              {(c.fullName?.charAt(0) || "?").toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-gray-800 truncate block">{c.fullName}</span>
                              <span className="text-[10px] text-gray-400">@{c.username}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!messageText.trim() || sendMutation.isPending}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-colors shrink-0"
                    style={{ background: "#fb9678" }}
                    data-testid="widget-btn-send"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {view === "members" && selectedRoom && (
            <>
              <div className="px-3 py-2.5 flex items-center gap-2 shrink-0 border-b" style={{ background: "var(--theme-primary)" }}>
                <button
                  onClick={() => setView("chat")}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  data-testid="widget-btn-back-members"
                >
                  <ArrowLeft className="h-4 w-4 text-white" />
                </button>
                <Users className="h-4 w-4 text-white" />
                <span className="font-medium text-sm text-white">สมาชิก ({selectedRoom.members.length})</span>
                <div className="flex-1" />
                <button
                  onClick={() => setView("closed")}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedRoom.members.map((m: any) => (
                  <div
                    key={m.userId}
                    className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0"
                    data-testid={`widget-member-${m.userId}`}
                  >
                    <div className="h-9 w-9 rounded-full bg-[#fb9678] flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {(m.fullName?.charAt(0) || "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.fullName}</p>
                      {m.userId === user?.id && (
                        <p className="text-[10px] text-gray-400">คุณ</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === "new" && (
            <>
              <div className="px-3 py-2.5 flex items-center gap-2 shrink-0 border-b" style={{ background: "var(--theme-primary)" }}>
                <button
                  onClick={() => setView("rooms")}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 text-white" />
                </button>
                <span className="font-medium text-sm text-white">สร้างแชทใหม่</span>
                <div className="flex-1" />
                <button
                  onClick={() => setView("closed")}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
              <div className="px-3 py-2 border-b space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อ..."
                    value={newChatSearch}
                    onChange={e => setNewChatSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#fb9678] bg-gray-50"
                    data-testid="widget-search-users"
                  />
                </div>
                {selectedUserIds.length > 1 && (
                  <input
                    type="text"
                    placeholder="ชื่อกลุ่ม (ไม่บังคับ)"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#fb9678]"
                    data-testid="widget-input-group-name"
                  />
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredOrgUsers.filter(u => u.id !== user?.id).map(u => (
                  <button
                    key={u.id}
                    onClick={() => toggleUserId(u.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors",
                      selectedUserIds.includes(u.id) && "bg-orange-50"
                    )}
                    data-testid={`widget-user-${u.id}`}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
                      selectedUserIds.includes(u.id) ? "bg-[#fb9678] border-[#fb9678]" : "border-gray-300"
                    )}>
                      {selectedUserIds.includes(u.id) && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      )}
                    </div>
                    <div className="h-8 w-8 rounded-full bg-[#fb9678] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {u.fullName?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{u.fullName}</div>
                      <div className="text-[10px] text-gray-400">{u.role}</div>
                    </div>
                  </button>
                ))}
              </div>
              {selectedUserIds.length > 0 && (
                <div className="px-3 py-2 border-t bg-white shrink-0">
                  <button
                    onClick={handleCreateChat}
                    disabled={createRoomMutation.isPending}
                    className="w-full py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors"
                    style={{ background: "#fb9678" }}
                    data-testid="widget-btn-create"
                  >
                    {selectedUserIds.length > 1 ? `สร้างกลุ่ม (${selectedUserIds.length} คน)` : "เริ่มแชท"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div
        className={cn(
          "h-12 w-12 rounded-full shadow-lg flex items-center justify-center relative select-none",
          isDragging ? "cursor-grabbing scale-110 shadow-xl" : "cursor-grab hover:shadow-xl hover:scale-110"
        )}
        style={{ background: isOpen ? "#e8856a" : "#fb9678", transition: isDragging ? "none" : "all 0.2s" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          onPointerUp(e);
          if (!wasDragged.current) {
            setView(isOpen ? "closed" : "rooms");
          }
        }}
        data-testid="widget-toggle-chat"
      >
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-white pointer-events-none" />
        ) : (
          <MessageCircle className="h-5 w-5 text-white pointer-events-none" />
        )}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-red-500 border-2 border-white pointer-events-none">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </div>
    </div>
  );
}
