import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/hooks/use-translation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import Layout from "@/components/layout";
import {
  MessageCircle, Send, Plus, Search, Users, User, ArrowLeft, Hash,
  Smile, MoreVertical, Trash2, UserPlus, Info, CheckCheck, DoorOpen,
  X, Paperclip, Pin, Reply, CornerUpLeft, FileText, Image, Download,
  Forward, Pencil, Ban, AtSign, Video, Phone
} from "lucide-react";
import { VideoCall, IncomingCallOverlay, useIncomingCallPoll, GroupVideoCall, useActiveGroupCall } from "@/components/video-call";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

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

interface ChatMessage {
  id: number;
  roomId: number;
  senderId: number;
  senderName: string;
  body: string;
  messageType: string;
  createdAt: string;
  readBy?: number[];
  replyToId?: number | null;
  replyTo?: { id: number; body: string; senderName: string } | null;
  pinnedAt?: string | null;
  pinnedBy?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  reactions?: { emoji: string; userId: number; userName: string }[];
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

const EMOJI_LIST = [
  { category: "😀", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥴","😵","🤯","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"] },
  { category: "👋", emojis: ["👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","🫦","💋"] },
  { category: "❤️", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️","🔥","⭐","🌟","✨","💫","💥","💢","💦","💨","🕳️","💣","💬","💭","🗯️","💤"] },
  { category: "🎉", emojis: ["🎉","🎊","🎈","🎁","🎀","🎗️","🎟️","🎫","🏆","🥇","🥈","🥉","⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🏑","🥍","🏏","⛳","🪁","🏹","🎣","🤿","🥊","🥋","🎽","⛸️","🥌","🛷","🎿","⛷️","🏂"] },
  { category: "✅", emojis: ["✅","❌","⭕","❗","❓","‼️","⁉️","💯","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","🔺","🔻","🔸","🔹","🔶","🔷","▪️","▫️","◾","◽","◼️","◻️","⬛","⬜","🟥","🟧","🟨","🟩","🟦","🟪"] },
];

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function isImageFile(name: string): boolean {
  const ext = name.toLowerCase().split(".").pop() || "";
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
}

function renderMentionText(text: string): React.ReactNode[] {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return <span key={i} className="bg-blue-200/50 text-blue-700 font-semibold rounded px-0.5">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function InternalChat() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteRoom, setShowDeleteRoom] = useState(false);
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<ChatRoom | null>(null);
  const [replyToMsg, setReplyToMsg] = useState<ChatMessage | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<number | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);

  const [showSearchBar, setShowSearchBar] = useState(false);
  const [msgSearchText, setMsgSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searchHighlightId, setSearchHighlightId] = useState<number | null>(null);

  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [forwardSearch, setForwardSearch] = useState("");

  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const [deleteMsgTarget, setDeleteMsgTarget] = useState<ChatMessage | null>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number>(0);

  const [activeCall, setActiveCall] = useState<{ targetUserId: number; targetUserName: string } | null>(null);
  const [showGroupCall, setShowGroupCall] = useState(false);
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<number>>(new Set());

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const { data: rooms = [] } = useQuery<ChatRoom[]>({
    queryKey: ["/api/internal-chat/rooms"],
    refetchInterval: 5000,
  });

  const { data: orgUsers = [] } = useQuery<OrgUser[]>({
    queryKey: ["/api/internal-chat/users"],
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/internal-chat/rooms", selectedRoomId, "messages"],
    queryFn: () => selectedRoomId ? fetch(`/api/internal-chat/rooms/${selectedRoomId}/messages`, { credentials: "include" }).then(r => r.json()) : Promise.resolve([]),
    enabled: !!selectedRoomId,
    refetchInterval: selectedRoomId ? 3000 : false,
  });

  const { data: pinnedMessages = [], refetch: refetchPinned } = useQuery<ChatMessage[]>({
    queryKey: ["/api/internal-chat/rooms", selectedRoomId, "pinned"],
    queryFn: () => selectedRoomId ? fetch(`/api/internal-chat/rooms/${selectedRoomId}/pinned`, { credentials: "include" }).then(r => r.json()) : Promise.resolve([]),
    enabled: !!selectedRoomId && showPinnedPanel,
  });

  const { data: typingUsers = [] } = useQuery<{ userId: number; fullName: string }[]>({
    queryKey: ["/api/internal-chat/rooms", selectedRoomId, "typing"],
    queryFn: () => selectedRoomId ? fetch(`/api/internal-chat/rooms/${selectedRoomId}/typing`, { credentials: "include" }).then(r => r.json()) : Promise.resolve([]),
    enabled: !!selectedRoomId,
    refetchInterval: selectedRoomId ? 2000 : false,
  });

  const pendingCalls = useIncomingCallPoll();
  const incomingCall = pendingCalls.find(c => !dismissedCallIds.has(c.callId));
  const selectedRoomType = rooms.find(r => r.id === selectedRoomId)?.type;
  const activeGroupCall = useActiveGroupCall(selectedRoomType === "group" ? selectedRoomId : null);

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
        setMobileShowChat(false);
      }
      setShowDeleteRoom(false);
      setDeleteRoomTarget(null);
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: (data: { name?: string; type: string; memberIds: number[] }) =>
      apiRequest("POST", "/api/internal-chat/rooms", data),
    onSuccess: async (res) => {
      const room = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/internal-chat/rooms"] });
      setSelectedRoomId(room.id);
      setShowNewChat(false);
      setSelectedUserIds([]);
      setGroupName("");
      setMobileShowChat(true);
    },
  });

  const reactionMutation = useMutation({
    mutationFn: ({ msgId, emoji }: { msgId: number; emoji: string }) =>
      apiRequest("POST", `/api/internal-chat/rooms/${selectedRoomId}/messages/${msgId}/reactions`, { emoji }),
    onSuccess: () => {
      refetchMessages();
      setShowReactionPicker(null);
    },
  });

  const pinMutation = useMutation({
    mutationFn: (msgId: number) =>
      apiRequest("PATCH", `/api/internal-chat/rooms/${selectedRoomId}/messages/${msgId}/pin`),
    onSuccess: () => {
      refetchMessages();
      if (showPinnedPanel) refetchPinned();
    },
  });

  const forwardMutation = useMutation({
    mutationFn: ({ msgId, targetRoomId }: { msgId: number; targetRoomId: number }) =>
      apiRequest("POST", `/api/internal-chat/rooms/${selectedRoomId}/messages/${msgId}/forward`, { targetRoomId }),
    onSuccess: () => {
      setShowForwardDialog(false);
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
    if (selectedRoomId) {
      fetch(`/api/internal-chat/rooms/${selectedRoomId}/read`, {
        method: "PATCH",
        credentials: "include",
      });
    }
  }, [selectedRoomId, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (searchHighlightId) {
      const el = document.querySelector(`[data-testid="msg-${searchHighlightId}"]`);
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
    if ((!messageText.trim()) || !selectedRoomId) return;
    const payload: { body: string; replyToId?: number } = { body: messageText.trim() };
    if (replyToMsg) payload.replyToId = replyToMsg.id;
    sendMutation.mutate(payload);
    setMentionQuery(null);
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedRoomId) return;
    try {
      const res = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const { uploadURL, objectPath } = await res.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      sendMutation.mutate({
        body: "",
        attachmentUrl: objectPath,
        attachmentName: file.name,
        ...(replyToMsg ? { replyToId: replyToMsg.id } : {}),
      });
    } catch (e) {
      console.error("Upload failed:", e);
    }
  };

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

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const members = selectedRoom?.members || [];
    const memberUsers = members
      .filter(m => m.userId !== (user as any)?.id)
      .map(m => {
        const ou = orgUsers.find(u => u.id === m.userId);
        return { userId: m.userId, fullName: m.fullName, username: ou?.username || "" };
      });
    if (!mentionQuery) return memberUsers.slice(0, 8);
    return memberUsers.filter(u =>
      u.fullName.toLowerCase().includes(mentionQuery) ||
      u.username.toLowerCase().includes(mentionQuery)
    ).slice(0, 8);
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

  const canEditMessage = (msg: ChatMessage) => {
    if (msg.senderId !== (user as any)?.id) return false;
    if (msg.deletedAt) return false;
    const createdAt = new Date(msg.createdAt).getTime();
    return Date.now() - createdAt < 15 * 60 * 1000;
  };

  const filteredRooms = useMemo(() => {
    if (!searchText.trim()) return rooms;
    const q = searchText.toLowerCase();
    return rooms.filter(r => r.displayName?.toLowerCase().includes(q));
  }, [rooms, searchText]);

  const totalUnread = rooms.reduce((sum, r) => sum + r.unreadCount, 0);

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

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  };

  const groupedReactions = (reactions: { emoji: string; userId: number; userName: string }[]) => {
    const map: Record<string, { count: number; users: { userId: number; userName: string }[] }> = {};
    for (const r of reactions) {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, users: [] };
      map[r.emoji].count++;
      map[r.emoji].users.push({ userId: r.userId, userName: r.userName });
    }
    return map;
  };

  const typingText = useMemo(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].fullName} กำลังพิมพ์...`;
    if (typingUsers.length === 2) return `${typingUsers[0].fullName} และ ${typingUsers[1].fullName} กำลังพิมพ์...`;
    return `${typingUsers.length} คนกำลังพิมพ์...`;
  }, [typingUsers]);

  return (
    <Layout>
    <div className="h-[calc(100vh-64px)] flex bg-gray-50" data-testid="internal-chat-page">
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r bg-white flex flex-col shrink-0",
        mobileShowChat && "hidden md:flex"
      )}>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#fb9678]" />
              แชทภายใน
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{totalUnread}</span>
              )}
            </h2>
            <Button
              size="sm"
              className="bg-[#fb9678] hover:bg-[#e8856a] text-white"
              onClick={() => setShowNewChat(true)}
              data-testid="btn-new-chat"
            >
              <Plus className="h-4 w-4 mr-1" /> สร้างแชท
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ค้นหาแชท..."
              className="pl-9"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              data-testid="input-search-chat"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีแชท</p>
              <p className="text-xs mt-1">กด "สร้างแชท" เพื่อเริ่มต้น</p>
            </div>
          )}
          {filteredRooms.map(room => (
            <div
              key={room.id}
              className={cn(
                "group w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3 cursor-pointer relative",
                selectedRoomId === room.id && "bg-orange-50 border-l-2 border-l-[#fb9678]"
              )}
              onClick={() => { setSelectedRoomId(room.id); setMobileShowChat(true); }}
              data-testid={`chat-room-${room.id}`}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm",
                room.type === "group" ? "bg-[#03c9d7]" : "bg-[#fb9678]"
              )}>
                {room.type === "group"
                  ? <Users className="h-5 w-5" />
                  : (room.displayName?.charAt(0) || "?").toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-800 truncate">{room.displayName}</span>
                  {room.lastMessage && (
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{formatTime(room.lastMessage.createdAt)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-gray-500 truncate">
                    {room.lastMessage
                      ? `${room.lastMessage.senderName}: ${room.lastMessage.body}`
                      : "ยังไม่มีข้อความ"
                    }
                  </p>
                  {room.unreadCount > 0 && (
                    <span className="bg-[#fb9678] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0 ml-2">
                      {room.unreadCount > 9 ? "9+" : room.unreadCount}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                onClick={(e) => { e.stopPropagation(); setDeleteRoomTarget(room); }}
                data-testid={`btn-delete-room-${room.id}`}
                title="ลบห้องแชท"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={cn(
        "flex-1 flex flex-col bg-white",
        !mobileShowChat && "hidden md:flex"
      )}>
        {selectedRoom ? (
          <>
            <div className="h-16 border-b flex items-center px-4 gap-3 shrink-0 bg-white">
              <button
                className="md:hidden text-gray-500 hover:text-gray-700"
                onClick={() => setMobileShowChat(false)}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm",
                selectedRoom.type === "group" ? "bg-[#03c9d7]" : "bg-[#fb9678]"
              )}>
                {selectedRoom.type === "group"
                  ? <Users className="h-4 w-4" />
                  : (selectedRoom.displayName?.charAt(0) || "?").toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 truncate">{selectedRoom.displayName}</h3>
                {typingText ? (
                  <p className="text-xs text-green-500 animate-pulse" data-testid="typing-indicator">{typingText}</p>
                ) : (
                  <p className="text-xs text-gray-400">
                    {selectedRoom.type === "group"
                      ? `${selectedRoom.members.length} สมาชิก`
                      : "ส่วนตัว"
                    }
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {selectedRoom.type === "direct" && (
                  <button
                    className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-full transition-colors"
                    onClick={() => {
                      const other = selectedRoom.members.find((m: any) => m.userId !== (user as any)?.id);
                      if (other) {
                        setActiveCall({ targetUserId: other.userId, targetUserName: other.fullName });
                      }
                    }}
                    data-testid="btn-video-call"
                    title="วิดีโอคอล"
                  >
                    <Video className="h-4 w-4" />
                  </button>
                )}
                {selectedRoom.type === "group" && (
                  <button
                    className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-full transition-colors"
                    onClick={() => setShowGroupCall(true)}
                    data-testid="btn-group-video-call"
                    title="วิดีโอคอลกลุ่ม (สูงสุด 4 คน)"
                  >
                    <Video className="h-4 w-4" />
                  </button>
                )}
                <button
                  className={cn(
                    "p-2 hover:bg-gray-100 rounded-full transition-colors",
                    showSearchBar ? "text-[#fb9678] bg-orange-50" : "text-gray-400 hover:text-[#fb9678]"
                  )}
                  onClick={() => {
                    setShowSearchBar(!showSearchBar);
                    if (showSearchBar) {
                      setMsgSearchText("");
                      setSearchResults([]);
                      setSearchHighlightId(null);
                    }
                  }}
                  data-testid="btn-search-messages"
                  title="ค้นหาข้อความ"
                >
                  <Search className="h-4 w-4" />
                </button>
                <button
                  className="p-2 text-gray-400 hover:text-[#fb9678] hover:bg-gray-100 rounded-full transition-colors"
                  onClick={() => { setShowPinnedPanel(!showPinnedPanel); if (!showPinnedPanel) refetchPinned(); }}
                  data-testid="btn-pinned-messages"
                  title="ข้อความปักหมุด"
                >
                  <Pin className="h-4 w-4" />
                </button>
                {selectedRoom.type === "group" && (
                  <button
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                    onClick={() => setShowMembers(true)}
                    data-testid="btn-show-members"
                    title="ดูสมาชิก"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                      data-testid="btn-chat-menu"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {selectedRoom.type === "group" && (
                      <DropdownMenuItem onClick={() => setShowMembers(true)} data-testid="menu-view-members">
                        <Users className="w-4 h-4 mr-2" /> ดูสมาชิก
                      </DropdownMenuItem>
                    )}
                    {selectedRoom.type === "direct" && (
                      <DropdownMenuItem onClick={() => setShowMembers(true)} data-testid="menu-view-profile">
                        <Info className="w-4 h-4 mr-2" /> ข้อมูลแชท
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteConfirm(true)}
                      data-testid="menu-clear-history"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> ลบประวัติแชท
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => setShowDeleteRoom(true)}
                      data-testid="menu-delete-room"
                    >
                      <DoorOpen className="w-4 h-4 mr-2" /> ลบห้องแชท
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {showSearchBar && (
              <div className="border-b bg-white px-4 py-2 flex items-center gap-2" data-testid="msg-search-bar">
                <Search className="h-4 w-4 text-gray-400 shrink-0" />
                <Input
                  ref={searchInputRef}
                  placeholder="ค้นหาข้อความในแชท..."
                  className="flex-1 h-8 text-sm"
                  value={msgSearchText}
                  onChange={e => setMsgSearchText(e.target.value)}
                  data-testid="input-search-messages"
                />
                {searchResults.length > 0 && (
                  <span className="text-xs text-gray-400 shrink-0">
                    {searchResults.length} ผลลัพธ์
                  </span>
                )}
                <div className="flex items-center gap-1">
                  {searchResults.length > 1 && (
                    <>
                      <button
                        className="p-1 hover:bg-gray-100 rounded text-gray-500"
                        onClick={() => {
                          const idx = searchResults.findIndex(r => r.id === searchHighlightId);
                          const prev = idx > 0 ? idx - 1 : searchResults.length - 1;
                          setSearchHighlightId(searchResults[prev].id);
                        }}
                        data-testid="btn-search-prev"
                      >
                        <ArrowLeft className="h-3.5 w-3.5 rotate-90" />
                      </button>
                      <button
                        className="p-1 hover:bg-gray-100 rounded text-gray-500"
                        onClick={() => {
                          const idx = searchResults.findIndex(r => r.id === searchHighlightId);
                          const next = idx < searchResults.length - 1 ? idx + 1 : 0;
                          setSearchHighlightId(searchResults[next].id);
                        }}
                        data-testid="btn-search-next"
                      >
                        <ArrowLeft className="h-3.5 w-3.5 -rotate-90" />
                      </button>
                    </>
                  )}
                </div>
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    setShowSearchBar(false);
                    setMsgSearchText("");
                    setSearchResults([]);
                    setSearchHighlightId(null);
                  }}
                  data-testid="btn-close-search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {selectedRoom?.type === "group" && activeGroupCall?.active && !showGroupCall && (
              <div className="border-b bg-green-50 px-4 py-2 flex items-center justify-between" data-testid="group-call-banner">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm text-green-800 font-medium">
                    วิดีโอคอลกลุ่มกำลังดำเนินอยู่ ({activeGroupCall.participants?.length || 0} คน)
                  </span>
                </div>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                  onClick={() => setShowGroupCall(true)}
                  data-testid="btn-join-group-call"
                >
                  <Phone className="h-3 w-3 mr-1" /> เข้าร่วม
                </Button>
              </div>
            )}

            {showPinnedPanel && (
              <div className="border-b bg-yellow-50 p-3 max-h-60 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                    📌 ข้อความปักหมุด ({pinnedMessages.length})
                  </span>
                  <button onClick={() => setShowPinnedPanel(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {pinnedMessages.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">ไม่มีข้อความปักหมุด</p>
                ) : (
                  <div className="space-y-2">
                    {pinnedMessages.map(pm => (
                      <div key={pm.id} className="bg-white rounded-lg p-2 border border-yellow-200 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700 text-xs">{pm.senderName}</span>
                          <span className="text-[10px] text-gray-400">{formatTime(pm.createdAt)}</span>
                        </div>
                        <p className="text-gray-600 text-xs mt-1 line-clamp-2">{pm.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.map((msg, i) => {
                const isMe = msg.senderId === (user as any)?.id;
                const showAvatar = !isMe && (i === 0 || messages[i - 1]?.senderId !== msg.senderId);
                const reactions = msg.reactions || [];
                const grouped = groupedReactions(reactions);
                const isHovered = hoveredMsgId === msg.id;
                const isDeleted = !!msg.deletedAt;
                const isEditing = editingMsgId === msg.id;
                const isHighlighted = searchHighlightId === msg.id;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2 relative group",
                      isMe ? "justify-end" : "justify-start",
                      isHighlighted && "ring-2 ring-yellow-400 ring-offset-2 rounded-xl"
                    )}
                    data-testid={`msg-${msg.id}`}
                    onMouseEnter={() => setHoveredMsgId(msg.id)}
                    onMouseLeave={() => { setHoveredMsgId(null); if (showReactionPicker === msg.id) setShowReactionPicker(null); }}
                  >
                    {!isMe && (
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 bg-[#03c9d7]", !showAvatar && "invisible")}>
                        {(msg.senderName?.charAt(0) || "?").toUpperCase()}
                      </div>
                    )}
                    <div className={cn("max-w-[70%] relative", isMe && "order-first")}>
                      {showAvatar && !isMe && (
                        <p className="text-xs text-gray-500 mb-1 ml-1">{msg.senderName}</p>
                      )}

                      {isHovered && !isDeleted && !isEditing && (
                        <div className={cn(
                          "absolute top-0 z-10 flex items-center gap-0.5 bg-white border rounded-lg shadow-md px-1 py-0.5",
                          isMe ? "left-0 -translate-x-full -ml-1" : "right-0 translate-x-full ml-1"
                        )} data-testid={`msg-actions-${msg.id}`}>
                          <button
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-[#fb9678] transition-colors"
                            onClick={() => { setReplyToMsg(msg); inputRef.current?.focus(); }}
                            title="ตอบกลับ"
                            data-testid={`btn-reply-${msg.id}`}
                          >
                            <CornerUpLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-[#fb9678] transition-colors"
                            onClick={() => { setForwardMsg(msg); setShowForwardDialog(true); }}
                            title="ส่งต่อ"
                            data-testid={`btn-forward-${msg.id}`}
                          >
                            <Forward className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-[#fb9678] transition-colors"
                            onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                            title="รีแอค"
                            data-testid={`btn-react-${msg.id}`}
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className={cn("p-1 hover:bg-gray-100 rounded transition-colors", msg.pinnedAt ? "text-[#fb9678]" : "text-gray-500 hover:text-[#fb9678]")}
                            onClick={() => pinMutation.mutate(msg.id)}
                            title={msg.pinnedAt ? "เลิกปักหมุด" : "ปักหมุด"}
                            data-testid={`btn-pin-${msg.id}`}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                          {isMe && canEditMessage(msg) && (
                            <button
                              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-500 transition-colors"
                              onClick={() => { setEditingMsgId(msg.id); setEditText(msg.body); }}
                              title="แก้ไข"
                              data-testid={`btn-edit-${msg.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isMe && (
                            <button
                              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-500 transition-colors"
                              onClick={() => setDeleteMsgTarget(msg)}
                              title="ลบ"
                              data-testid={`btn-delete-msg-${msg.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {showReactionPicker === msg.id && (
                        <div className={cn(
                          "absolute z-20 bg-white border rounded-full shadow-lg px-2 py-1 flex items-center gap-1",
                          isMe ? "left-0 -translate-x-full -ml-1 top-7" : "right-0 translate-x-full ml-1 top-7"
                        )} data-testid={`reaction-picker-${msg.id}`}>
                          {QUICK_REACTIONS.map(emoji => (
                            <button
                              key={emoji}
                              className="w-7 h-7 flex items-center justify-center text-lg hover:bg-gray-100 rounded-full transition-colors hover:scale-125"
                              onClick={() => reactionMutation.mutate({ msgId: msg.id, emoji })}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      {isDeleted ? (
                        <div className={cn(
                          "px-4 py-2 rounded-2xl text-sm italic",
                          isMe
                            ? "bg-gray-200 text-gray-400 rounded-br-md"
                            : "bg-gray-100 text-gray-400 border rounded-bl-md"
                        )} data-testid={`msg-deleted-${msg.id}`}>
                          <div className="flex items-center gap-1">
                            <Ban className="h-3.5 w-3.5" />
                            ข้อความถูกลบ
                          </div>
                        </div>
                      ) : isEditing ? (
                        <div className="flex items-center gap-2" data-testid={`msg-edit-${msg.id}`}>
                          <Input
                            ref={editInputRef}
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            className="flex-1 text-sm h-8"
                            data-testid={`input-edit-${msg.id}`}
                          />
                          <Button
                            size="sm"
                            className="h-8 bg-[#fb9678] hover:bg-[#e8856a] text-white text-xs px-2"
                            onClick={() => editMutation.mutate({ msgId: msg.id, body: editText.trim() })}
                            disabled={!editText.trim() || editMutation.isPending}
                            data-testid={`btn-save-edit-${msg.id}`}
                          >
                            บันทึก
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs px-2"
                            onClick={() => { setEditingMsgId(null); setEditText(""); }}
                            data-testid={`btn-cancel-edit-${msg.id}`}
                          >
                            ยกเลิก
                          </Button>
                        </div>
                      ) : (
                        <div className={cn(
                          "px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                          isMe
                            ? "bg-[#fb9678] text-white rounded-br-md"
                            : "bg-white text-gray-800 border rounded-bl-md shadow-sm"
                        )}>
                          {msg.pinnedAt && (
                            <div className={cn("flex items-center gap-1 text-[10px] mb-1", isMe ? "text-white/70" : "text-gray-400")}>
                              <Pin className="h-2.5 w-2.5" /> ปักหมุดแล้ว
                            </div>
                          )}

                          {msg.forwardedFromRoomName && (
                            <div className={cn("flex items-center gap-1 text-[10px] mb-1", isMe ? "text-white/70" : "text-gray-400")}>
                              <Forward className="h-2.5 w-2.5" /> ส่งต่อจาก {msg.forwardedFromRoomName}
                            </div>
                          )}

                          {msg.replyTo && (
                            <div className={cn(
                              "rounded-lg px-2 py-1.5 mb-2 border-l-2 text-xs",
                              isMe
                                ? "bg-white/20 border-white/50 text-white/90"
                                : "bg-gray-100 border-gray-300 text-gray-600"
                            )}>
                              <span className="font-semibold text-[10px]">{msg.replyTo.senderName}</span>
                              <p className="truncate mt-0.5">{msg.replyTo.body}</p>
                            </div>
                          )}

                          {msg.attachmentUrl && msg.attachmentName && isImageFile(msg.attachmentName) && (
                            <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
                              <img
                                src={msg.attachmentUrl}
                                alt={msg.attachmentName}
                                className="max-w-full max-h-60 rounded-lg object-cover"
                                data-testid={`img-attachment-${msg.id}`}
                              />
                            </a>
                          )}

                          {msg.attachmentUrl && msg.attachmentName && !isImageFile(msg.attachmentName) && (
                            <a
                              href={msg.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-2 rounded-lg px-3 py-2 mb-1",
                                isMe ? "bg-white/20 hover:bg-white/30" : "bg-gray-100 hover:bg-gray-200"
                              )}
                              data-testid={`file-attachment-${msg.id}`}
                            >
                              <FileText className="h-5 w-5 shrink-0" />
                              <span className="truncate text-xs flex-1">{msg.attachmentName}</span>
                              <Download className="h-4 w-4 shrink-0" />
                            </a>
                          )}

                          {msg.body && <span>{renderMentionText(msg.body)}</span>}

                          {msg.editedAt && (
                            <span className={cn("text-[10px] ml-1", isMe ? "text-white/60" : "text-gray-400")}>(แก้ไขแล้ว)</span>
                          )}
                        </div>
                      )}

                      {!isDeleted && Object.keys(grouped).length > 0 && (
                        <div className={cn("flex flex-wrap gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
                          {Object.entries(grouped).map(([emoji, data]) => {
                            const myReaction = data.users.some(u => u.userId === (user as any)?.id);
                            return (
                              <button
                                key={emoji}
                                className={cn(
                                  "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                                  myReaction
                                    ? "bg-orange-100 border-[#fb9678] text-[#fb9678]"
                                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                )}
                                onClick={() => reactionMutation.mutate({ msgId: msg.id, emoji })}
                                title={data.users.map(u => u.userName).join(", ")}
                                data-testid={`reaction-badge-${msg.id}-${emoji}`}
                              >
                                <span>{emoji}</span>
                                <span className="font-medium">{data.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className={cn("flex items-center gap-1 mt-1", isMe ? "justify-end mr-1" : "ml-1")}>
                        <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                        {isMe && (
                          <CheckCheck className={cn("h-3 w-3", msg.readBy && msg.readBy.length > 0 ? "text-[#03c9d7]" : "text-gray-300")} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t bg-white">
              {replyToMsg && (
                <div className="px-4 pt-3 pb-1 flex items-center gap-2 bg-gray-50 border-b" data-testid="reply-bar">
                  <CornerUpLeft className="h-4 w-4 text-[#fb9678] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-[#fb9678]">{replyToMsg.senderName}</span>
                    <p className="text-xs text-gray-500 truncate">{replyToMsg.body || (replyToMsg.attachmentName ? `📎 ${replyToMsg.attachmentName}` : "")}</p>
                  </div>
                  <button
                    onClick={() => setReplyToMsg(null)}
                    className="text-gray-400 hover:text-gray-600 shrink-0"
                    data-testid="btn-cancel-reply"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="p-4 flex gap-2 items-end relative">
                <div className="relative">
                  <button
                    className="p-2 text-gray-400 hover:text-[#fb9678] hover:bg-gray-100 rounded-full transition-colors"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    data-testid="btn-emoji"
                    title="อีโมจิ"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                  {showEmojiPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                      <div className="absolute bottom-full left-0 mb-2 bg-white border rounded-xl shadow-xl z-50 w-72" data-testid="emoji-picker">
                        <div className="flex border-b px-1 pt-1">
                          {EMOJI_LIST.map((cat, idx) => (
                            <button
                              key={idx}
                              className="p-1.5 hover:bg-gray-100 rounded text-lg"
                              onClick={() => {
                                const el = document.getElementById(`emoji-cat-${idx}`);
                                el?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                            >
                              {cat.category}
                            </button>
                          ))}
                        </div>
                        <div className="max-h-48 overflow-y-auto p-2">
                          {EMOJI_LIST.map((cat, idx) => (
                            <div key={idx} id={`emoji-cat-${idx}`}>
                              <div className="flex flex-wrap">
                                {cat.emojis.map((emoji, ei) => (
                                  <button
                                    key={ei}
                                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                                    onClick={() => {
                                      setMessageText(prev => prev + emoji);
                                      inputRef.current?.focus();
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button
                  className="p-2 text-gray-400 hover:text-[#fb9678] hover:bg-gray-100 rounded-full transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="btn-attachment"
                  title="แนบไฟล์"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = "";
                  }}
                  data-testid="input-file-upload"
                />
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    placeholder="พิมพ์ข้อความ... (ใช้ @ เพื่อแท็กสมาชิก)"
                    value={messageText}
                    onChange={handleMessageInputChange}
                    onKeyDown={handleKeyDown}
                    className="w-full"
                    data-testid="input-message"
                  />
                  {mentionQuery !== null && mentionCandidates.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto" data-testid="mention-dropdown">
                      {mentionCandidates.map((c, idx) => (
                        <button
                          key={c.userId}
                          className={cn(
                            "w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-sm",
                            idx === mentionIndex && "bg-orange-50"
                          )}
                          onClick={() => insertMention(c)}
                          data-testid={`mention-option-${c.userId}`}
                        >
                          <div className="w-7 h-7 rounded-full bg-[#03c9d7] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(c.fullName?.charAt(0) || "?").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">{c.fullName}</p>
                            <p className="text-xs text-gray-400 truncate">@{c.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendMutation.isPending}
                  className="bg-[#fb9678] hover:bg-[#e8856a] text-white px-4"
                  data-testid="btn-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">เลือกแชทเพื่อเริ่มสนทนา</p>
              <p className="text-sm mt-1">หรือกด "สร้างแชท" เพื่อเริ่มแชทใหม่</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#fb9678]" />
              สร้างแชทใหม่
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedUserIds.length > 1 && (
              <Input
                placeholder="ชื่อกลุ่ม (ถ้าเป็นแชทกลุ่ม)"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                data-testid="input-group-name"
              />
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="ค้นหาผู้ใช้..."
                className="pl-9"
                value={newChatSearch}
                onChange={e => setNewChatSearch(e.target.value)}
                data-testid="input-search-users"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredOrgUsers.map(u => (
                <label
                  key={u.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedUserIds.includes(u.id) && "bg-orange-50"
                  )}
                  data-testid={`user-option-${u.id}`}
                >
                  <Checkbox
                    checked={selectedUserIds.includes(u.id)}
                    onCheckedChange={(checked) => {
                      setSelectedUserIds(prev =>
                        checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                      );
                    }}
                  />
                  <div className="w-8 h-8 rounded-full bg-[#fb9678] flex items-center justify-center text-white text-sm font-bold">
                    {(u.fullName?.charAt(0) || "?").toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{u.fullName}</p>
                    <p className="text-xs text-gray-400">{u.role}</p>
                  </div>
                </label>
              ))}
            </div>
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedUserIds.map(uid => {
                  const u = orgUsers.find(x => x.id === uid);
                  return (
                    <span key={uid} className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">
                      {u?.fullName}
                    </span>
                  );
                })}
              </div>
            )}
            <Button
              className="w-full bg-[#fb9678] hover:bg-[#e8856a] text-white"
              disabled={selectedUserIds.length === 0 || createRoomMutation.isPending}
              onClick={() => {
                createRoomMutation.mutate({
                  type: selectedUserIds.length > 1 ? "group" : "direct",
                  name: selectedUserIds.length > 1 ? groupName : undefined,
                  memberIds: selectedUserIds,
                });
              }}
              data-testid="btn-create-room"
            >
              {selectedUserIds.length > 1 ? "สร้างกลุ่ม" : "เริ่มแชท"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#03c9d7]" />
              สมาชิกในแชท
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {selectedRoom?.members.map((m: any) => (
              <div
                key={m.userId}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                data-testid={`member-${m.userId}`}
              >
                <div className="w-9 h-9 rounded-full bg-[#fb9678] flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {(m.fullName?.charAt(0) || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.fullName}</p>
                  {m.userId === (user as any)?.id && (
                    <p className="text-xs text-gray-400">คุณ</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {selectedRoom && (
            <p className="text-xs text-gray-400 text-center pt-2 border-t">
              ทั้งหมด {selectedRoom.members.length} คน
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              ลบประวัติแชท
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            ต้องการลบข้อความทั้งหมดในแชทนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              data-testid="btn-cancel-delete"
            >
              ยกเลิก
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => clearHistoryMutation.mutate()}
              disabled={clearHistoryMutation.isPending}
              data-testid="btn-confirm-delete"
            >
              {clearHistoryMutation.isPending ? "กำลังลบ..." : "ลบทั้งหมด"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteRoom || !!deleteRoomTarget} onOpenChange={(open) => { if (!open) { setShowDeleteRoom(false); setDeleteRoomTarget(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <DoorOpen className="h-5 w-5" />
              ลบห้องแชท
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            ต้องการลบห้องแชท "{deleteRoomTarget?.displayName || selectedRoom?.displayName}" ทั้งห้องหรือไม่? ข้อความและสมาชิกทั้งหมดจะถูกลบ ไม่สามารถย้อนกลับได้
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button
              variant="outline"
              onClick={() => { setShowDeleteRoom(false); setDeleteRoomTarget(null); }}
              data-testid="btn-cancel-delete-room"
            >
              ยกเลิก
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => deleteRoomMutation.mutate(deleteRoomTarget?.id || selectedRoomId || undefined)}
              disabled={deleteRoomMutation.isPending}
              data-testid="btn-confirm-delete-room"
            >
              {deleteRoomMutation.isPending ? "กำลังลบ..." : "ลบห้องแชท"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showForwardDialog} onOpenChange={(open) => { if (!open) { setShowForwardDialog(false); setForwardMsg(null); setForwardSearch(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="h-5 w-5 text-[#fb9678]" />
              ส่งต่อข้อความ
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {forwardMsg && (
              <div className="bg-gray-50 rounded-lg p-3 border text-sm">
                <p className="text-xs text-gray-400 mb-1">{forwardMsg.senderName}</p>
                <p className="text-gray-700 line-clamp-3">{forwardMsg.body || (forwardMsg.attachmentName ? `📎 ${forwardMsg.attachmentName}` : "")}</p>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="ค้นหาห้องแชท..."
                className="pl-9"
                value={forwardSearch}
                onChange={e => setForwardSearch(e.target.value)}
                data-testid="input-forward-search"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {forwardFilteredRooms.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">ไม่พบห้องแชท</p>
              )}
              {forwardFilteredRooms.map(room => (
                <button
                  key={room.id}
                  className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    if (forwardMsg) {
                      forwardMutation.mutate({ msgId: forwardMsg.id, targetRoomId: room.id });
                    }
                  }}
                  disabled={forwardMutation.isPending}
                  data-testid={`forward-room-${room.id}`}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0",
                    room.type === "group" ? "bg-[#03c9d7]" : "bg-[#fb9678]"
                  )}>
                    {room.type === "group" ? <Users className="h-4 w-4" /> : (room.displayName?.charAt(0) || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{room.displayName}</p>
                    <p className="text-xs text-gray-400">
                      {room.type === "group" ? `${room.members.length} สมาชิก` : "ส่วนตัว"}
                    </p>
                  </div>
                  <Forward className="h-4 w-4 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteMsgTarget} onOpenChange={(open) => { if (!open) setDeleteMsgTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              ลบข้อความ
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            ต้องการลบข้อความนี้หรือไม่?
          </p>
          {deleteMsgTarget && (
            <div className="bg-gray-50 rounded-lg p-3 border text-sm text-gray-700 line-clamp-3">
              {deleteMsgTarget.body || (deleteMsgTarget.attachmentName ? `📎 ${deleteMsgTarget.attachmentName}` : "")}
            </div>
          )}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteMsgTarget(null)}
              data-testid="btn-cancel-delete-msg"
            >
              ยกเลิก
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                if (deleteMsgTarget) deleteMsgMutation.mutate(deleteMsgTarget.id);
              }}
              disabled={deleteMsgMutation.isPending}
              data-testid="btn-confirm-delete-msg"
            >
              {deleteMsgMutation.isPending ? "กำลังลบ..." : "ลบข้อความ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {activeCall && (
        <VideoCall
          targetUserId={activeCall.targetUserId}
          targetUserName={activeCall.targetUserName}
          onClose={() => setActiveCall(null)}
        />
      )}

      {incomingCall && !activeCall && !showGroupCall && (
        <IncomingCallOverlay
          callId={incomingCall.callId}
          callerName={incomingCall.callerName}
          sdp={incomingCall.sdp}
          onClose={() => setDismissedCallIds(prev => new Set(prev).add(incomingCall.callId))}
        />
      )}
      {showGroupCall && selectedRoom && selectedRoom.type === "group" && (
        <GroupVideoCall
          roomId={selectedRoom.id}
          roomName={selectedRoom.name || "กลุ่ม"}
          onClose={() => setShowGroupCall(false)}
        />
      )}
    </div>
    </Layout>
  );
}
