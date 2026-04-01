import { useState, useEffect, useRef, Fragment } from "react";
import { Download, ChevronDown, ChevronRight, MessageCircle, Send, Paperclip, Image, FileIcon, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  "รอดำเนินการ": "#c4c4c4",
  "กำลังดำเนินการ": "#fdab3d",
  "รอตรวจ": "#e2445c",
  "รับยอดแล้ว": "#00c875",
  "ส่งทดลองแล้ว": "#0086c0",
  "เสร็จสิ้น": "#00c875",
};

interface BoardData {
  board: { id: number; name: string; color: string };
  companyName: string;
  groups: any[];
  columns: any[];
  items: any[];
  subitems: any[];
}

function ChatPanel({ token, itemId, itemName, userName, onClose }: { token: string; itemId: number; itemName: string; userName: string; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchUpdates = () => {
    fetch(`/api/shared/board/${token}/items/${itemId}/updates`)
      .then(r => { if (!r.ok) throw new Error("fetch failed"); return r.json(); })
      .then(d => { if (Array.isArray(d)) setUpdates(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    setUpdates([]);
    setLoading(true);
    fetchUpdates();
    const interval = setInterval(fetchUpdates, 10000);
    return () => clearInterval(interval);
  }, [itemId]);

  const handleSend = async (attachments?: any[]) => {
    const text = msg.trim();
    if (!text && (!attachments || attachments.length === 0)) return;
    setSending(true);
    try {
      const r = await fetch(`/api/shared/board/${token}/items/${itemId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, guestName: userName, attachments }),
      });
      if (!r.ok) throw new Error("Failed");
      setMsg("");
      fetchUpdates();
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 200);
    } catch { alert("ส่งไม่สำเร็จ"); }
    finally { setSending(false); }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const attachments: any[] = [];
      for (const file of Array.from(files)) {
        const urlRes = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        if (!urlRes.ok) throw new Error("upload failed");
        const { uploadUrl, publicUrl } = await urlRes.json();
        await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        attachments.push({ name: file.name, url: publicUrl, type: file.type });
      }
      handleSend(attachments);
    } catch { alert("อัปโหลดไม่สำเร็จ"); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-white shadow-2xl border-l z-50 flex flex-col">
      <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{itemName}</h3>
          <p className="text-[10px] text-gray-500">แชท / อัปโหลดไฟล์</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200"><X className="w-4 h-4" /></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-[#03c9d7] border-t-transparent rounded-full" /></div>
        ) : updates.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">ยังไม่มีข้อความ</div>
        ) : updates.map((u: any, i: number) => (
          <div key={i} className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: u.isGuest ? "#03c9d7" : "#fb9678" }}>
              {(u.authorName || "?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-xs">{u.authorName}</span>
                <span className="text-[10px] text-gray-400">{new Date(u.createdAt).toLocaleString("th-TH")}</span>
              </div>
              {u.content && <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{u.content}</p>}
              {u.attachments?.length > 0 && (
                <div className="flex flex-col gap-1 mt-1.5">
                  {u.attachments.map((att: any, ai: number) =>
                    att.type?.startsWith("image/") ? (
                      <a key={ai} href={att.url} target="_blank" rel="noreferrer">
                        <img src={att.url} alt={att.name} className="max-w-[240px] max-h-[180px] rounded-lg border object-cover" />
                      </a>
                    ) : (
                      <a key={ai} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded border text-xs text-blue-600 hover:bg-gray-100">
                        <FileIcon className="w-3.5 h-3.5" /> {att.name}
                        <Download className="w-3 h-3 ml-auto text-gray-400" />
                      </a>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t px-3 py-2 bg-gray-50">
        <div className="text-[10px] text-gray-400 mb-1">แชทในฐานะ: <span className="font-medium text-[#03c9d7]">{userName}</span></div>
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="พิมพ์ข้อความ..."
              className="w-full min-h-[38px] max-h-[120px] text-sm border rounded-lg px-3 py-2 pr-16 resize-none focus:outline-none focus:ring-1 focus:ring-[#03c9d7] bg-white"
              rows={1}
              data-testid="input-chat-message"
            />
            <div className="absolute right-1 bottom-1 flex items-center gap-0.5">
              <button onClick={() => { const inp = fileInputRef.current; if (inp) { inp.accept = ""; inp.click(); } }}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="แนบไฟล์" disabled={uploading}>
                <Paperclip className="w-4 h-4" />
              </button>
              <button onClick={() => { const inp = fileInputRef.current; if (inp) { inp.accept = "image/*"; inp.click(); } }}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="ส่งรูปภาพ" disabled={uploading}>
                <Image className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button onClick={() => handleSend()} disabled={(!msg.trim() && !uploading) || sending}
            className="p-2 rounded-lg bg-[#03c9d7] hover:bg-[#03c9d7]/90 text-white disabled:opacity-40 transition-colors flex-shrink-0"
            data-testid="btn-send-message">
            {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <input ref={fileInputRef} type="file" className="hidden" multiple
          onChange={e => { if (e.target.files?.length) handleFileUpload(e.target.files); e.target.value = ""; }} />
      </div>
    </div>
  );
}

export default function ExternalBoardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [openItem, setOpenItem] = useState<{ id: number; name: string } | null>(null);

  const boardToken = (user as any)?.externalBoardToken || sessionStorage.getItem("shared_board_token") || "";

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    if ((user as any).role !== "client_external") { navigate("/"); return; }

    const token = (user as any).externalBoardToken || sessionStorage.getItem("shared_board_token") || "";
    if (token && token !== sessionStorage.getItem("shared_board_token")) {
      sessionStorage.setItem("shared_board_token", token);
    }
    if (!token) { setError("ไม่พบข้อมูลบอร์ด"); setLoading(false); return; }

    fetch(`/api/work-boards/by-token/${token}`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error("ไม่สามารถเข้าถึงบอร์ดได้"); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [user, authLoading]);

  const toggleGroup = (gid: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid); else next.add(gid);
      return next;
    });
  };

  const exportCSV = () => {
    if (!data) return;
    const { columns, groups, items } = data;
    const header = ["กลุ่ม", "รายการ", ...columns.map((c: any) => c.name)];
    const rows = items.map((item: any) => {
      const group = groups.find((g: any) => g.id === item.groupId);
      const vals = item.cellValues || {};
      return [
        group?.name || "",
        item.name,
        ...columns.map((c: any) => {
          const v = vals[String(c.id)];
          if (v === null || v === undefined) return "";
          if (c.columnType === "checkbox") return v ? "✓" : "";
          if (c.columnType === "file") {
            try { return JSON.parse(v).map((f: any) => f.name).join(", "); } catch { return v; }
          }
          return String(v);
        }),
      ];
    });
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.board.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const renderCellValue = (col: any, value: any) => {
    if (value === null || value === undefined || value === "") return <span className="text-gray-300">—</span>;
    switch (col.columnType) {
      case "status": {
        const bg = STATUS_COLORS[value] || "#c4c4c4";
        return <span className="px-2 py-0.5 rounded text-white text-xs font-medium" style={{ backgroundColor: bg }}>{value}</span>;
      }
      case "checkbox":
        return value ? <span className="text-green-500">✓</span> : <span className="text-gray-300">—</span>;
      case "date":
        try {
          const d = new Date(value);
          return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear() + 543}`;
        } catch { return value; }
      case "file":
        try {
          const files = JSON.parse(value);
          return (
            <div className="flex flex-col gap-0.5">
              {files.map((f: any, i: number) => (
                <a key={i} href={f.url || "#"} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs flex items-center gap-1">
                  <Download className="w-3 h-3" />{f.name}
                </a>
              ))}
            </div>
          );
        } catch { return value; }
      case "email":
        return <a href={`mailto:${value}`} className="text-blue-500 hover:underline">{value}</a>;
      case "phone":
        return <a href={`tel:${value}`} className="text-blue-500 hover:underline">{value}</a>;
      case "tags":
        try {
          const tags = typeof value === "string" ? value.split(",") : [value];
          return (
            <div className="flex flex-wrap gap-1">
              {tags.map((t: string, i: number) => (
                <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{t.trim()}</span>
              ))}
            </div>
          );
        } catch { return value; }
      default:
        return <span className="truncate block max-w-[200px]">{String(value)}</span>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-[#fb9678] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">ไม่สามารถเข้าถึงบอร์ดได้</h2>
          <p className="text-gray-500 mb-4">{error || "บอร์ดไม่พบหรือยกเลิกการแชร์แล้ว"}</p>
          <Button variant="outline" onClick={handleLogout}>ออกจากระบบ</Button>
        </div>
      </div>
    );
  }

  const { board, companyName, groups, columns, items, subitems } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: board.color || "#539BFF" }}>
              <span className="text-white text-xs font-bold">{board.name[0]}</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">{board.name}</h1>
              <p className="text-xs text-gray-500">{companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 mr-2">{user?.fullName}</span>
            <Button variant="outline" size="sm" onClick={exportCSV} data-testid="btn-export-csv">
              <Download className="w-4 h-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="btn-logout"
              className="text-red-500 border-red-200 hover:bg-red-50">
              <LogOut className="w-4 h-4 mr-1.5" /> ออก
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-8"></th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 min-w-[200px]">รายการ</th>
                {columns.map((col: any) => (
                  <th key={col.id} className="text-left px-3 py-2 font-medium text-gray-600 min-w-[140px]">{col.name}</th>
                ))}
              </tr>
            </thead>
            {groups.map((group: any) => {
              const groupItems = items.filter((i: any) => i.groupId === group.id);
              const isCollapsed = collapsedGroups.has(group.id);
              return (
                <tbody key={group.id}>
                  <tr className="border-b cursor-pointer hover:bg-gray-50" onClick={() => toggleGroup(group.id)}>
                    <td className="px-3 py-2" style={{ borderLeft: `3px solid ${group.color || "#579bfc"}` }}>
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </td>
                    <td colSpan={columns.length + 1} className="px-3 py-2 font-semibold" style={{ color: group.color || "#579bfc" }}>
                      {group.name}
                      <span className="ml-2 text-xs font-normal text-gray-400">({groupItems.length} รายการ)</span>
                    </td>
                  </tr>
                  {!isCollapsed && groupItems.map((item: any) => {
                    const itemSubitems = subitems.filter((s: any) => s.itemId === item.id);
                    const vals = item.cellValues || {};
                    return (
                      <Fragment key={item.id}>
                        <tr className="border-b hover:bg-gray-50/50 group/row">
                          <td className="px-3 py-2" style={{ borderLeft: `3px solid ${group.color || "#579bfc"}` }}></td>
                          <td className="px-3 py-2 font-medium text-gray-800">
                            <div className="flex items-center gap-2">
                              <span>{item.name}</span>
                              <button onClick={() => setOpenItem({ id: item.id, name: item.name })}
                                className="opacity-0 group-hover/row:opacity-100 p-1 rounded hover:bg-blue-50 transition-opacity"
                                title="แชท / อัปโหลดไฟล์" data-testid={`btn-chat-${item.id}`}>
                                <MessageCircle className="w-3.5 h-3.5 text-[#03c9d7]" />
                              </button>
                            </div>
                          </td>
                          {columns.map((col: any) => (
                            <td key={col.id} className="px-3 py-2">{renderCellValue(col, vals[String(col.id)])}</td>
                          ))}
                        </tr>
                        {itemSubitems.map((sub: any) => {
                          const subVals = sub.cellValues || {};
                          return (
                            <tr key={`sub-${sub.id}`} className="border-b bg-gray-50/30 hover:bg-gray-50">
                              <td className="px-3 py-1.5" style={{ borderLeft: `3px solid ${group.color || "#579bfc"}` }}></td>
                              <td className="px-3 py-1.5 pl-8 text-gray-600 text-xs">↳ {sub.name}</td>
                              {columns.map((col: any) => (
                                <td key={col.id} className="px-3 py-1.5 text-xs">{renderCellValue(col, subVals[String(col.id)])}</td>
                              ))}
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>

      <div className="text-center py-6 text-xs text-gray-400">
        © E-Tax Center
      </div>

      {openItem && (
        <ChatPanel
          token={boardToken}
          itemId={openItem.id}
          itemName={openItem.name}
          userName={user?.fullName || "ผู้ใช้"}
          onClose={() => setOpenItem(null)}
        />
      )}
    </div>
  );
}
