import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/lib/company-context";
import { formatDate } from "@/lib/format";
import { useDateSettings } from "@/hooks/use-date-settings";
import ThaiDateInput from "@/components/thai-date-input";
import {
  Plus, LayoutGrid, Trash2, ChevronDown, ChevronRight, MoreHorizontal,
  Type, Hash, Calendar, User, CheckSquare, Link, Mail, Phone, FileText,
  Palette, Pencil, X, ListFilter, Search, Copy, Star, StarOff, Archive,
  Paperclip, Upload, ExternalLink, Loader2, GripVertical
} from "lucide-react";

const GROUP_COLORS = ["var(--theme-primary)", "#00c875", "#fdab3d", "#e2445c", "#a25ddc", "#037f4c", "#579bfc", "#ff642e", "#cab641", "#ff158a"];

const COLUMN_TYPES = [
  { value: "status", label: "สถานะ", desc: "ดูภาพรวมสถานะงานทันที", icon: Palette, color: "var(--theme-primary)", category: "essential" },
  { value: "person", label: "ผู้รับผิดชอบ", desc: "มอบหมายงานให้ทีมงาน", icon: User, color: "#00c875", category: "essential" },
  { value: "date", label: "วันที่", desc: "กำหนดวันครบกำหนดงาน", icon: Calendar, color: "#579bfc", category: "essential" },
  { value: "text", label: "ข้อความ", desc: "บันทึกข้อมูลข้อความอิสระ", icon: Type, color: "#fdab3d", category: "essential" },
  { value: "number", label: "ตัวเลข", desc: "จำนวน, ต้นทุน, ค่าประมาณ", icon: Hash, color: "#a25ddc", category: "essential" },
  { value: "checkbox", label: "เช็คบ็อกซ์", desc: "ติ๊กเมื่อเสร็จสิ้น", icon: CheckSquare, color: "#00c875", category: "useful" },
  { value: "link", label: "ลิงก์", desc: "แนบลิงก์เว็บไซต์", icon: Link, color: "#579bfc", category: "useful" },
  { value: "email", label: "อีเมล", desc: "บันทึกอีเมลติดต่อ", icon: Mail, color: "#ff642e", category: "useful" },
  { value: "phone", label: "โทรศัพท์", desc: "เบอร์โทรศัพท์ติดต่อ", icon: Phone, color: "#cab641", category: "useful" },
  { value: "file", label: "ไฟล์", desc: "แนบเอกสารประกอบ", icon: FileText, color: "#ff158a", category: "useful" },
];

const DEFAULT_STATUS_OPTIONS = {
  labels: [
    { label: "กำลังทำ", color: "#fdab3d" },
    { label: "เสร็จแล้ว", color: "#00c875" },
    { label: "ติดปัญหา", color: "#e2445c" },
    { label: "รอดำเนินการ", color: "#c4c4c4" },
  ],
};

function StatusCell({ value, options, onChange }: { value: string; options: any; onChange: (v: string) => void }) {
  const labels = options?.labels || DEFAULT_STATUS_OPTIONS.labels;
  const current = labels.find((l: any) => l.label === value);
  const bgColor = current?.color || "transparent";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-full px-2 py-1.5 text-xs font-medium cursor-pointer text-center truncate min-h-[32px]"
          style={{ backgroundColor: bgColor, color: bgColor === "transparent" ? "#666" : "#fff" }}
          data-testid="cell-status"
        >
          {value || <span className="text-gray-300">เลือกสถานะ</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {labels.map((l: any) => (
          <DropdownMenuItem key={l.label} onClick={() => onChange(l.label)} className="gap-2 text-xs">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: l.color }} />
            {l.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChange("")} className="text-xs text-gray-400">ล้าง</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TextCell({ value, onChange, placeholder, icon }: { value: string; onChange: (v: string) => void; placeholder?: string; icon?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(value || ""); }, [value]);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const commit = () => { setEditing(false); if (val !== (value || "")) onChange(val); };

  if (!editing) {
    return (
      <div className="w-full px-2 py-1.5 text-xs cursor-pointer hover:bg-blue-50/40 min-h-[32px] flex items-center gap-1.5 truncate" onClick={(e) => { e.stopPropagation(); setEditing(true); }} data-testid="cell-text">
        {icon && <span className="shrink-0 text-gray-400">{icon}</span>}
        <span className={value ? "text-gray-800 truncate" : "text-gray-300"}>{value || placeholder || "-"}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center min-h-[32px]">
      {icon && <span className="shrink-0 text-gray-400 ml-2">{icon}</span>}
      <input ref={inputRef} type="text" className="w-full px-2 py-1.5 text-xs border-2 border-[var(--theme-primary)] outline-none bg-white min-h-[32px]" value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(value || ""); setEditing(false); } }} />
    </div>
  );
}

function NumberCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(value || ""); }, [value]);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const commit = () => { setEditing(false); if (val !== (value || "")) onChange(val); };

  if (!editing) {
    return (
      <div className="w-full px-2 py-1.5 text-xs cursor-pointer hover:bg-blue-50/40 min-h-[32px] flex items-center justify-end truncate" onClick={(e) => { e.stopPropagation(); setEditing(true); }} data-testid="cell-number">
        <span className={value ? "text-gray-800 font-mono" : "text-gray-300"}>{value ? Number(value).toLocaleString() : "-"}</span>
      </div>
    );
  }

  return (
    <input ref={inputRef} type="number" className="w-full px-2 py-1.5 text-xs text-right border-2 border-[var(--theme-primary)] outline-none bg-white min-h-[32px] font-mono" value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(value || ""); setEditing(false); } }} />
  );
}

function CheckboxCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="w-full px-2 py-1 min-h-[32px] flex items-center justify-center" data-testid="cell-checkbox">
      <input type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "false")} className="w-4 h-4 accent-[#00c875] cursor-pointer" />
    </div>
  );
}

function DateCell({ value, onChange, dateEra, dateFmt }: { value: string; onChange: (v: string) => void; dateEra: string; dateFmt: string }) {
  return (
    <div className="w-full min-h-[32px] flex items-center" data-testid="cell-date">
      <ThaiDateInput value={value || ""} onChange={onChange} dateEra={dateEra} dateFmt={dateFmt} className="h-8 text-xs w-full" />
    </div>
  );
}

function PersonCell({ value, onChange, users }: { value: string; onChange: (v: string) => void; users: any[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full px-2 py-1.5 text-xs cursor-pointer hover:bg-blue-50/40 min-h-[32px] flex items-center gap-1.5" data-testid="cell-person">
          {value ? (
            <>
              <span className="w-7 h-7 rounded-full bg-[var(--theme-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                {value.charAt(0)}
              </span>
              <span className="whitespace-nowrap">{value}</span>
            </>
          ) : (
            <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-gray-300" />
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px] max-h-[240px] overflow-y-auto">
        <div className="px-2 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">ผู้รับผิดชอบ</div>
        {users.map((u: any) => (
          <DropdownMenuItem key={u.id} onClick={() => onChange(u.fullName)} className="text-xs gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--theme-primary)] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {u.fullName?.charAt(0) || "?"}
            </span>
            {u.fullName}
          </DropdownMenuItem>
        ))}
        {users.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">ไม่พบรายชื่อ</div>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChange("")} className="text-xs text-gray-400">ล้าง</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LinkCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(value || ""); }, [value]);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  const commit = () => { setEditing(false); if (val !== (value || "")) onChange(val); };

  if (!editing) {
    return (
      <div className="w-full px-2 py-1.5 text-xs cursor-pointer hover:bg-blue-50/40 min-h-[32px] flex items-center gap-1.5 truncate" onClick={(e) => { e.stopPropagation(); setEditing(true); }} data-testid="cell-link">
        <Link className="w-3 h-3 text-gray-400 shrink-0" />
        {value ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline truncate flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {value.replace(/^https?:\/\//, "").slice(0, 30)}
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
          </a>
        ) : (
          <span className="text-gray-300">เพิ่มลิงก์</span>
        )}
      </div>
    );
  }

  return (
    <input ref={inputRef} type="url" className="w-full px-2 py-1.5 text-xs border-2 border-[var(--theme-primary)] outline-none bg-white min-h-[32px]" value={val} placeholder="https://..." onChange={(e) => setVal(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(value || ""); setEditing(false); } }} />
  );
}

function FileCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const files: { name: string; url: string }[] = (() => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((f: any) => ({ name: f.name || f.fileName || "", url: f.url || f.path || "" }));
      if (parsed.fileName || parsed.name) return [{ name: parsed.fileName || parsed.name, url: parsed.url || parsed.path || "" }];
    } catch {}
    return [];
  })();

  const handleUpload = async (selectedFiles: FileList) => {
    setUploading(true);
    try {
      const newFiles = [...files];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append("file", file);
        const r = await fetch("/api/work-board-files/upload", { method: "POST", credentials: "include", body: formData });
        if (!r.ok) throw new Error("อัปโหลดไม่สำเร็จ");
        const data = await r.json();
        newFiles.push({ name: data.fileName, url: data.url || data.path });
      }
      onChange(JSON.stringify(newFiles));
    } catch (e: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    onChange(updated.length ? JSON.stringify(updated) : "");
  };

  const getFileExt = (name: string) => (name.split(".").pop()?.toLowerCase() || "");

  const getFileColor = (name: string) => {
    const ext = getFileExt(name);
    if (["pdf"].includes(ext)) return "#e74c3c";
    if (["xls", "xlsx", "csv"].includes(ext)) return "#27ae60";
    if (["doc", "docx"].includes(ext)) return "#2980b9";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "#8e44ad";
    if (["ppt", "pptx"].includes(ext)) return "#e67e22";
    if (["zip", "rar", "7z"].includes(ext)) return "#7f8c8d";
    return "#7c5cfc";
  };

  if (files.length === 0 && !uploading) {
    return (
      <div className="w-full px-1 py-0.5 min-h-[32px] flex items-center" data-testid="cell-file">
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={e => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />
        <button className="flex items-center gap-1 text-[11px] text-gray-300 hover:text-gray-500 rounded px-1 py-0.5" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full px-1 py-0.5 min-h-[32px] group/filecell" data-testid="cell-file">
      <div className="flex items-center gap-0.5 flex-wrap">
        {files.map((f, i) => (
          <a key={i} href={f.url} target="_blank" rel="noreferrer" className="relative flex-shrink-0 w-7 h-8 flex items-center justify-center group/ficon" title={f.name}>
            <svg viewBox="0 0 24 30" className="w-full h-full" fill="none">
              <path d="M2 2C2 0.9 2.9 0 4 0H16L22 6V28C22 29.1 21.1 30 20 30H4C2.9 30 2 29.1 2 28V2Z" fill={getFileColor(f.name)} fillOpacity="0.15" stroke={getFileColor(f.name)} strokeWidth="1.2"/>
              <path d="M16 0L22 6H18C16.9 6 16 5.1 16 4V0Z" fill={getFileColor(f.name)} fillOpacity="0.3"/>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold uppercase pt-1.5" style={{ color: getFileColor(f.name) }}>{getFileExt(f.name).slice(0, 4)}</span>
            <button className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white border border-gray-300 rounded-full items-center justify-center hidden group-hover/ficon:flex shadow-sm" onClick={e => { e.preventDefault(); e.stopPropagation(); removeFile(i); }}>
              <X className="w-2 h-2 text-red-400" />
            </button>
          </a>
        ))}
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={e => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ""; }} />
        <button className="w-6 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded opacity-0 group-hover/filecell:opacity-100 flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function CellRenderer({ column, value, onChange, users, dateEra, dateFmt }: { column: any; value: string; onChange: (v: string) => void; users: any[]; dateEra: string; dateFmt: string }) {
  const opts = column.options ? JSON.parse(column.options) : null;

  switch (column.columnType) {
    case "status":
      return <StatusCell value={value} options={opts} onChange={onChange} />;
    case "person":
      return <PersonCell value={value} onChange={onChange} users={users} />;
    case "checkbox":
      return <CheckboxCell value={value} onChange={onChange} />;
    case "date":
      return <DateCell value={value} onChange={onChange} dateEra={dateEra} dateFmt={dateFmt} />;
    case "number":
      return <NumberCell value={value} onChange={onChange} />;
    case "link":
      return <LinkCell value={value} onChange={onChange} />;
    case "email":
      return <TextCell value={value} onChange={onChange} placeholder="กรอกอีเมล" icon={<Mail className="w-3 h-3" />} />;
    case "phone":
      return <TextCell value={value} onChange={onChange} placeholder="กรอกเบอร์โทร" icon={<Phone className="w-3 h-3" />} />;
    case "file":
      return <FileCell value={value} onChange={onChange} />;
    default:
      return <TextCell value={value} onChange={onChange} />;
  }
}

const BOARD_COLORS = [
  { label: "น้ำเงิน", color: "var(--theme-primary)" },
  { label: "เขียว", color: "#00c875" },
  { label: "ส้ม", color: "#fdab3d" },
  { label: "แดง", color: "#e2445c" },
  { label: "ม่วง", color: "#a25ddc" },
  { label: "เขียวเข้ม", color: "#037f4c" },
  { label: "ฟ้า", color: "#579bfc" },
  { label: "ส้มเข้ม", color: "#ff642e" },
  { label: "เหลือง", color: "#cab641" },
  { label: "ชมพู", color: "#ff158a" },
  { label: "แซลมอน", color: "#fb9678" },
  { label: "ฟ้าอมเขียว", color: "#03c9d7" },
];

function BoardSidebar({ boards, selectedId, onSelect, onCreate, onDelete, onDuplicate, onRename, onChangeColor }: {
  boards: any[]; selectedId: number | null; onSelect: (id: number) => void; onCreate: () => void; onDelete: (id: number) => void;
  onDuplicate: (id: number) => void; onRename: (id: number, name: string) => void; onChangeColor: (id: number, color: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus();
  }, [renamingId]);

  const handleRenameSubmit = (id: number) => {
    if (renameVal.trim()) onRename(id, renameVal.trim());
    setRenamingId(null);
  };

  return (
    <div className="w-56 shrink-0 bg-white border-r flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <LayoutGrid className="w-4 h-4 text-[#fb9678]" /> บอร์ดทั้งหมด
        </h3>
        <Button size="sm" variant="ghost" onClick={onCreate} className="h-7 w-7 p-0" data-testid="button-new-board">
          <Plus className="w-4 h-4 text-[#fb9678]" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {boards.map((b: any) => (
          <div
            key={b.id}
            onClick={() => { if (renamingId !== b.id) onSelect(b.id); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer group relative ${selectedId === b.id ? "bg-[#fb9678]/10 text-[#fb9678] font-semibold" : "hover:bg-gray-50 text-gray-600"}`}
            data-testid={`board-item-${b.id}`}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: b.color || "var(--theme-primary)" }} />
            {renamingId === b.id ? (
              <input
                ref={renameRef}
                className="flex-1 text-sm border-b border-[var(--theme-primary)] outline-none bg-transparent min-w-0"
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={() => handleRenameSubmit(b.id)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit(b.id); if (e.key === "Escape") { setRenameVal(b.name); setRenamingId(null); } }}
                onClick={(e) => e.stopPropagation()}
                data-testid={`input-rename-board-${b.id}`}
              />
            ) : (
              <span className="truncate flex-1">{b.name}</span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0 hover:bg-gray-200 rounded flex items-center justify-center" data-testid={`button-board-menu-${b.id}`}>
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); setRenameVal(b.name); setRenamingId(b.id); }}
                  className="text-xs gap-2"
                  data-testid={`menu-rename-${b.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" /> เปลี่ยนชื่อ
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDuplicate(b.id); }}
                  className="text-xs gap-2"
                  data-testid={`menu-duplicate-${b.id}`}
                >
                  <Copy className="w-3.5 h-3.5" /> คัดลอกบอร์ด
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <p className="text-[11px] text-gray-400 mb-1.5 flex items-center gap-1"><Palette className="w-3 h-3" /> เปลี่ยนสี</p>
                  <div className="flex flex-wrap gap-1">
                    {BOARD_COLORS.map((c) => (
                      <button
                        key={c.color}
                        className={`w-5 h-5 rounded-sm border-2 transition-all hover:scale-110 ${b.color === c.color ? "border-gray-800 ring-1 ring-gray-300" : "border-transparent"}`}
                        style={{ backgroundColor: c.color }}
                        onClick={(e) => { e.stopPropagation(); onChangeColor(b.id, c.color); }}
                        title={c.label}
                        data-testid={`color-${c.color}-${b.id}`}
                      />
                    ))}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); if (confirm("ต้องการลบบอร์ดนี้หรือไม่? ข้อมูลทั้งหมดในบอร์ดจะถูกลบ")) onDelete(b.id); }}
                  className="text-[#f94d4d] text-xs gap-2"
                  data-testid={`menu-delete-${b.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" /> ลบบอร์ด
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {boards.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">ยังไม่มีบอร์ด</p>
        )}
      </div>
    </div>
  );
}

export default function WorkBoardPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("text");
  const [newItemNames, setNewItemNames] = useState<Record<number, string>>({});
  const [newItemCells, setNewItemCells] = useState<Record<number, Record<string, string>>>({});
  const [editingBoardName, setEditingBoardName] = useState(false);
  const [boardNameVal, setBoardNameVal] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showStatusEditor, setShowStatusEditor] = useState<number | null>(null);
  const [renamingColId, setRenamingColId] = useState<number | null>(null);
  const [renameColValue, setRenameColValue] = useState("");
  const [colCategory, setColCategory] = useState<"essential" | "useful">("essential");
  const [colSearchTerm, setColSearchTerm] = useState("");
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [nameColWidth, setNameColWidth] = useState(250);
  const resizingRef = useRef<{ colId: number | "name"; startX: number; startW: number } | null>(null);

  const { data: boardsData } = useQuery<any[]>({
    queryKey: ["/api/work-boards"],
    queryFn: async () => {
      const r = await fetch("/api/work-boards", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const boards = boardsData || [];

  const { data: boardData, isLoading: boardLoading } = useQuery<any>({
    queryKey: ["/api/work-boards", selectedBoardId, "data"],
    queryFn: async () => {
      const r = await fetch(`/api/work-boards/${selectedBoardId}/data`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedBoardId,
  });

  const { data: usersData } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const r = await fetch("/api/users", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });
  const usersList = usersData || [];

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
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/work-boards"] });
    if (selectedBoardId) queryClient.invalidateQueries({ queryKey: ["/api/work-boards", selectedBoardId, "data"] });
  };

  const createBoard = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/work-boards", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: "บอร์ดใหม่" }) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: (board) => { invalidate(); setSelectedBoardId(board.id); },
  });

  const deleteBoard = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/work-boards/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => { invalidate(); if (selectedBoardId === deleteBoard.variables) setSelectedBoardId(null); },
  });

  const updateBoard = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/work-boards/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: invalidate,
  });

  const duplicateBoard = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/work-boards/${id}/duplicate`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: (board) => { invalidate(); setSelectedBoardId(board.id); toast({ title: "คัดลอกบอร์ดเรียบร้อย" }); },
  });

  const createGroup = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch(`/api/work-boards/${selectedBoardId}/groups`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name, color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)], position: (boardData?.groups?.length || 0) }) });
      return r.json();
    },
    onSuccess: invalidate,
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/work-board-groups/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: invalidate,
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/work-board-groups/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: invalidate,
  });

  const createColumn = useMutation({
    mutationFn: async ({ name, columnType }: { name: string; columnType: string }) => {
      const body: any = { name, columnType, position: (boardData?.columns?.length || 0) };
      if (columnType === "status") {
        body.options = JSON.stringify(DEFAULT_STATUS_OPTIONS);
      }
      const r = await fetch(`/api/work-boards/${selectedBoardId}/columns`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      return r.json();
    },
    onSuccess: () => { invalidate(); setShowAddCol(false); setNewColName(""); setNewColType("text"); },
  });

  const updateColumn = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/work-board-columns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: invalidate,
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/work-board-columns/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: invalidate,
  });

  const reorderColumns = useMutation({
    mutationFn: async (columnIds: number[]) => {
      const r = await fetch(`/api/work-boards/${selectedBoardId}/reorder-columns`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ columnIds }),
      });
      return r.json();
    },
    onSuccess: invalidate,
  });

  const [dragColId, setDragColId] = useState<number | null>(null);
  const [dragOverColId, setDragOverColId] = useState<number | null>(null);

  const handleColumnDragStart = useCallback((e: React.DragEvent, colId: number) => {
    setDragColId(colId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(colId));
    const th = e.currentTarget as HTMLElement;
    th.style.opacity = "0.5";
  }, []);

  const handleColumnDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragColId(null);
    setDragOverColId(null);
  }, []);

  const handleColumnDragOver = useCallback((e: React.DragEvent, colId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (colId !== dragColId) setDragOverColId(colId);
  }, [dragColId]);

  const handleColumnDrop = useCallback((e: React.DragEvent, targetColId: number) => {
    e.preventDefault();
    if (dragColId === null || dragColId === targetColId) return;
    const cols = (boardData?.columns || []) as any[];
    const currentOrder = cols.map((c: any) => c.id);
    const fromIdx = currentOrder.indexOf(dragColId);
    const toIdx = currentOrder.indexOf(targetColId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragColId);
    reorderColumns.mutate(newOrder);
    setDragColId(null);
    setDragOverColId(null);
  }, [dragColId, boardData, reorderColumns]);

  const createItem = useMutation({
    mutationFn: async ({ name, groupId, cellValues }: { name: string; groupId: number | null; cellValues?: string }) => {
      const items = boardData?.items?.filter((i: any) => i.groupId === groupId) || [];
      const r = await fetch(`/api/work-boards/${selectedBoardId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name, groupId, position: items.length, cellValues: cellValues || "{}" }) });
      return r.json();
    },
    onSuccess: (_, vars) => {
      invalidate();
      const gKey = vars.groupId || 0;
      setNewItemNames((prev) => ({ ...prev, [gKey]: "" }));
      setNewItemCells((prev) => ({ ...prev, [gKey]: {} }));
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/work-board-items/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: invalidate,
  });

  const updateCellValues = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`/api/work-board-items/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onMutate: async ({ id, data }) => {
      const key = ["/api/work-boards", selectedBoardId, "data"];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: any) => {
        if (!old) return old;
        return { ...old, items: (old.items || []).map((it: any) => it.id === id ? { ...it, ...data, updatedAt: new Date().toISOString() } : it) };
      });
      return { prev, key };
    },
    onError: (_err, _vars, ctx) => { if (ctx) queryClient.setQueryData(ctx.key, ctx.prev); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/work-boards", selectedBoardId, "data"] }); },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/work-board-items/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: invalidate,
  });

  const handleCellChange = useCallback((item: any, columnId: number, value: string) => {
    const cells = JSON.parse(item.cellValues || "{}");
    cells[String(columnId)] = value;
    updateCellValues.mutate({ id: item.id, data: { cellValues: JSON.stringify(cells) } });
  }, [updateCellValues]);

  const getColWidth = useCallback((colId: number, fallback = 150) => colWidths[colId] || fallback, [colWidths]);

  const handleResizeStart = useCallback((e: React.MouseEvent, colId: number | "name") => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colId === "name" ? nameColWidth : (colWidths[colId as number] || 150);
    resizingRef.current = { colId, startX, startW };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const diff = ev.clientX - resizingRef.current.startX;
      const newW = Math.max(80, Math.min(600, resizingRef.current.startW + diff));
      if (resizingRef.current.colId === "name") {
        setNameColWidth(newW);
      } else {
        setColWidths(prev => ({ ...prev, [resizingRef.current!.colId as number]: newW }));
      }
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [colWidths, nameColWidth]);

  const board = boardData?.board;
  const groups: any[] = boardData?.groups || [];
  const columns: any[] = boardData?.columns || [];
  const allItems: any[] = boardData?.items || [];

  const filteredItems = searchTerm
    ? allItems.filter((item: any) => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : allItems;

  const renderGroup = (group: any) => {
    const groupItems = filteredItems.filter((i: any) => i.groupId === group.id);
    const isCollapsed = group.collapsed;
    const gKey = group.id || 0;

    return (
      <div key={group.id} className="mb-4" data-testid={`group-${group.id}`}>
        <div className="flex items-center gap-1 mb-0.5">
          <button
            className="p-0.5 hover:bg-gray-100 rounded"
            onClick={() => updateGroup.mutate({ id: group.id, data: { collapsed: !isCollapsed } })}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: group.color }} /> : <ChevronDown className="w-4 h-4" style={{ color: group.color }} />}
          </button>
          <InlineGroupName name={group.name} color={group.color} onChange={(name: string) => updateGroup.mutate({ id: group.id, data: { name } })} />
          <span className="text-xs text-gray-400 ml-1">{groupItems.length} รายการ</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 h-5 w-5 p-0 hover:bg-gray-100 rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {GROUP_COLORS.map((c) => (
                <DropdownMenuItem key={c} onClick={() => updateGroup.mutate({ id: group.id, data: { color: c } })} className="gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} /> เปลี่ยนสี
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { if (confirm("ลบกลุ่มนี้?")) deleteGroup.mutate(group.id); }} className="text-[#f94d4d] text-xs gap-2">
                <Trash2 className="w-3 h-3" /> ลบกลุ่ม
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {!isCollapsed && (
          <div className="border border-[#e6e9ef] rounded-md bg-white">
            <table className="text-sm" style={{ minWidth: nameColWidth + columns.reduce((sum: number, c: any) => sum + getColWidth(c.id), 0) + 40, tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600 border-b border-r border-[#e6e9ef] bg-[#f5f6f8] sticky top-0 left-0 z-30 relative" style={{ width: nameColWidth, minWidth: 80, maxWidth: 600 }}>
                    <div className="flex items-center gap-1" style={{ color: group.color }}>
                      <span>Item</span>
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-[var(--theme-primary)] active:bg-[var(--theme-primary)] z-20 transition-colors"
                      onMouseDown={(e) => handleResizeStart(e, "name")}
                      data-testid="resize-handle-name"
                    />
                  </th>
                  {columns.map((col: any) => {
                    const w = getColWidth(col.id);
                    const colType = COLUMN_TYPES.find(t => t.value === col.columnType);
                    const isDragOver = dragOverColId === col.id && dragColId !== col.id;
                    return (
                    <th
                      key={col.id}
                      className={`text-center py-2 px-1 text-xs font-semibold text-gray-600 border-b border-r border-[#e6e9ef] bg-[#f5f6f8] sticky top-0 z-20 relative group/col transition-all ${isDragOver ? "!bg-blue-50 !border-l-2 !border-l-[var(--theme-primary)]" : ""}`}
                      style={{ width: w, minWidth: 80, maxWidth: 600, cursor: "grab" }}
                      draggable
                      onDragStart={(e) => handleColumnDragStart(e, col.id)}
                      onDragEnd={handleColumnDragEnd}
                      onDragOver={(e) => handleColumnDragOver(e, col.id)}
                      onDrop={(e) => handleColumnDrop(e, col.id)}
                      data-testid={`col-header-${col.id}`}
                    >
                      <div className="flex items-center justify-center gap-1 pr-1">
                        <GripVertical className="w-3 h-3 shrink-0 text-gray-300 opacity-0 group-hover/col:opacity-100 cursor-grab active:cursor-grabbing" />
                        {colType && <colType.icon className="w-3 h-3 shrink-0" style={{ color: colType.color }} />}
                        {renamingColId === col.id ? (
                          <input
                            autoFocus
                            className="text-xs font-medium text-center border border-[var(--theme-primary)] rounded px-1 py-0.5 outline-none bg-white w-full"
                            value={renameColValue}
                            onChange={e => setRenameColValue(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onBlur={() => {
                              if (renameColValue.trim() && renameColValue !== col.name) {
                                updateColumn.mutate({ id: col.id, data: { name: renameColValue.trim() } });
                              }
                              setRenamingColId(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                if (renameColValue.trim() && renameColValue !== col.name) {
                                  updateColumn.mutate({ id: col.id, data: { name: renameColValue.trim() } });
                                }
                                setRenamingColId(null);
                              }
                              if (e.key === "Escape") setRenamingColId(null);
                            }}
                            data-testid={`rename-col-input-${col.id}`}
                          />
                        ) : (
                          <span
                            className="truncate cursor-text hover:bg-black/5 rounded px-1"
                            onClick={e => { e.stopPropagation(); setRenamingColId(col.id); setRenameColValue(col.name); }}
                          >
                            {col.name}
                          </span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-4 w-4 p-0 opacity-0 group-hover/col:opacity-100 pointer-events-none group-hover/col:pointer-events-auto shrink-0 hover:bg-gray-200 rounded flex items-center justify-center" onMouseDown={e => e.stopPropagation()}>
                              <MoreHorizontal className="w-3 h-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setRenamingColId(col.id); setRenameColValue(col.name); }} className="text-xs gap-2">
                              <Pencil className="w-3 h-3" /> เปลี่ยนชื่อ
                            </DropdownMenuItem>
                            {col.columnType === "status" && (
                              <DropdownMenuItem onClick={() => setShowStatusEditor(col.id)} className="text-xs gap-2">
                                <Palette className="w-3 h-3" /> แก้ไขตัวเลือก
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { if (confirm("ลบคอลัมน์นี้?")) deleteColumn.mutate(col.id); }} className="text-[#f94d4d] text-xs gap-2">
                              <Trash2 className="w-3 h-3" /> ลบคอลัมน์
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-[var(--theme-primary)] active:bg-[var(--theme-primary)] z-20 transition-colors"
                        onMouseDown={(e) => handleResizeStart(e, col.id)}
                        data-testid={`resize-handle-${col.id}`}
                      />
                    </th>
                    );
                  })}
                  <th className="py-2 px-1 text-xs bg-[#f5f6f8] border-b border-[#e6e9ef] w-[40px] sticky top-0 z-20">
                    <button
                      onClick={() => setShowAddCol(true)}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white hover:shadow-sm mx-auto border border-transparent hover:border-gray-200 transition-all"
                      title="เพิ่มคอลัมน์"
                      data-testid="button-add-column"
                    >
                      <Plus className="w-4 h-4 text-gray-400" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupItems.map((item: any, idx: number) => {
                  const cells = JSON.parse(item.cellValues || "{}");
                  const isLast = idx === groupItems.length - 1;
                  return (
                    <tr key={item.id} className="hover:bg-[#f0f5ff] group/row" data-testid={`row-item-${item.id}`}>
                      <td className={`py-0 px-0 sticky left-0 bg-white z-[5] border-r border-[#e6e9ef] ${!isLast ? "border-b border-b-[#edeef0]" : ""}`} style={{ width: nameColWidth, minWidth: 80, maxWidth: 600 }}>
                        <div className="flex items-center">
                          <div className="w-[5px] self-stretch shrink-0" style={{ backgroundColor: group.color }} />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="h-5 w-5 p-0 mx-1 opacity-0 group-hover/row:opacity-100 shrink-0 hover:bg-gray-200 rounded flex items-center justify-center">
                                <MoreHorizontal className="w-3 h-3 text-gray-400" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => { if (confirm("ลบรายการนี้?")) deleteItem.mutate(item.id); }} className="text-[#f94d4d] text-xs gap-2">
                                <Trash2 className="w-3 h-3" /> ลบ
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <TextCell
                            value={item.name}
                            onChange={(v: string) => updateItem.mutate({ id: item.id, data: { name: v } })}
                            placeholder="ชื่อรายการ"
                          />
                        </div>
                      </td>
                      {columns.map((col: any) => (
                        <td key={col.id} className={`py-0 px-0 border-r border-[#e6e9ef] ${!isLast ? "border-b border-b-[#edeef0]" : ""}`} style={{ width: getColWidth(col.id), minWidth: 80, maxWidth: 600, overflow: "visible" }}>
                          <div className="w-full" style={{ position: "relative", zIndex: 1 }}>
                            <CellRenderer
                              column={col}
                              value={cells[String(col.id)] || ""}
                              onChange={(v) => handleCellChange(item, col.id, v)}
                              users={usersList}
                              dateEra={dateEra}
                              dateFmt={dateFmt}
                            />
                          </div>
                        </td>
                      ))}
                      <td className={`w-[40px] ${!isLast ? "border-b border-b-[#edeef0]" : ""}`} />
                    </tr>
                  );
                })}
                {/* Add item row inside table */}
                <tr className="border-t border-[#e6e9ef] bg-[#fafbfc]">
                  <td className="py-0 px-0 sticky left-0 bg-[#fafbfc] z-[5] border-r border-[#e6e9ef]" style={{ width: nameColWidth, minWidth: 80, maxWidth: 600 }}>
                    <div className="flex items-center">
                      <div className="w-[5px] self-stretch shrink-0" style={{ backgroundColor: group.color, opacity: 0.3 }} />
                      <Plus className="w-3.5 h-3.5 text-gray-300 ml-2 mr-1 shrink-0" />
                      <input
                        className="text-xs text-gray-500 bg-transparent border-none outline-none py-2 flex-1 placeholder:text-gray-300"
                        placeholder="+ เพิ่มรายการ"
                        value={newItemNames[gKey] || ""}
                        onChange={(e) => setNewItemNames((p) => ({ ...p, [gKey]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (newItemNames[gKey] || "").trim()) {
                            const cellVals = newItemCells[gKey] || {};
                            createItem.mutate({
                              name: newItemNames[gKey].trim(),
                              groupId: group.id,
                              cellValues: Object.keys(cellVals).length > 0 ? JSON.stringify(cellVals) : undefined,
                            });
                          }
                        }}
                        data-testid={`input-new-item-${group.id}`}
                      />
                    </div>
                  </td>
                  {columns.map((col: any) => (
                    <td key={col.id} className="py-0 px-0 border-r border-[#e6e9ef]" style={{ width: getColWidth(col.id), minWidth: 80, maxWidth: 600 }}>
                      <div className="w-full" style={{ position: "relative", zIndex: 1 }}>
                        <CellRenderer
                          column={col}
                          value={(newItemCells[gKey] || {})[String(col.id)] || ""}
                          onChange={(v) => {
                            setNewItemCells((prev) => ({
                              ...prev,
                              [gKey]: { ...(prev[gKey] || {}), [String(col.id)]: v },
                            }));
                          }}
                          users={usersList}
                          dateEra={dateEra}
                          dateFmt={dateFmt}
                        />
                      </div>
                    </td>
                  ))}
                  <td className="w-[40px]" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-56px)]">
        <BoardSidebar
          boards={boards}
          selectedId={selectedBoardId}
          onSelect={setSelectedBoardId}
          onCreate={() => createBoard.mutate()}
          onDelete={(id) => deleteBoard.mutate(id)}
          onDuplicate={(id) => duplicateBoard.mutate(id)}
          onRename={(id, name) => updateBoard.mutate({ id, data: { name } })}
          onChangeColor={(id, color) => updateBoard.mutate({ id, data: { color } })}
        />

        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
          {!selectedBoardId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <LayoutGrid className="w-16 h-16 text-gray-200 mx-auto" />
                <h2 className="text-lg font-semibold text-gray-400">เลือกบอร์ดเพื่อเริ่มต้น</h2>
                <p className="text-sm text-gray-300">หรือสร้างบอร์ดใหม่จากเมนูด้านซ้าย</p>
                <Button onClick={() => createBoard.mutate()} className="bg-[#fb9678] hover:bg-[#e8876a] text-white gap-2" data-testid="button-create-first-board">
                  <Plus className="w-4 h-4" /> สร้างบอร์ดแรก
                </Button>
              </div>
            </div>
          ) : boardLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-pulse text-gray-400">กำลังโหลด...</div>
            </div>
          ) : board ? (
            <>
              {/* Board Header */}
              <div className="bg-white border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editingBoardName ? (
                      <input
                        className="text-xl font-bold border-b-2 border-[var(--theme-primary)] outline-none bg-transparent"
                        value={boardNameVal}
                        onChange={(e) => setBoardNameVal(e.target.value)}
                        onBlur={() => { setEditingBoardName(false); if (boardNameVal.trim() && boardNameVal !== board.name) updateBoard.mutate({ id: board.id, data: { name: boardNameVal } }); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { setEditingBoardName(false); if (boardNameVal.trim()) updateBoard.mutate({ id: board.id, data: { name: boardNameVal } }); } }}
                        autoFocus
                      />
                    ) : (
                      <h1
                        className="text-xl font-bold text-gray-800 cursor-pointer hover:text-[#fb9678]"
                        onClick={() => { setBoardNameVal(board.name); setEditingBoardName(true); }}
                        data-testid="text-board-name"
                      >
                        {board.name}
                      </h1>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        className="h-8 text-xs pl-7 w-48"
                        placeholder="ค้นหา..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        data-testid="input-search"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Board Content */}
              <div className="flex-1 overflow-auto p-4">
                {groups.map(renderGroup)}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => createGroup.mutate("กลุ่มใหม่")}
                  className="text-xs text-gray-400 hover:text-gray-600 gap-1 mt-2"
                  data-testid="button-add-group"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มกลุ่มใหม่
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Column Center Dialog */}
      <Dialog open={showAddCol} onOpenChange={setShowAddCol}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>Column Center</DialogTitle>
          </DialogHeader>
          <div className="flex h-[480px]">
            <div className="w-[150px] bg-[#f5f6f8] border-r border-[#e6e9ef] py-4 px-2 shrink-0">
              <h3 className="text-sm font-bold text-gray-800 px-2 mb-3">Column Center</h3>
              <div className="space-y-0.5">
                <button
                  onClick={() => setColCategory("essential")}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-colors ${colCategory === "essential" ? "bg-[#cce5ff] text-[#0073ea]" : "text-gray-600 hover:bg-gray-200"}`}
                >
                  พื้นฐาน
                </button>
                <button
                  onClick={() => setColCategory("useful")}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-colors ${colCategory === "useful" ? "bg-[#cce5ff] text-[#0073ea]" : "text-gray-600 hover:bg-gray-200"}`}
                >
                  ใช้งานบ่อย
                </button>
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-3 border-b border-[#e6e9ef]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="h-8 text-xs pl-8 bg-[#f5f6f8] border-[#e6e9ef]"
                    placeholder="ค้นหาประเภทคอลัมน์..."
                    value={colSearchTerm}
                    onChange={(e) => setColSearchTerm(e.target.value)}
                    data-testid="input-search-col-type"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <h4 className="text-sm font-bold text-gray-800 mb-3">
                  {colCategory === "essential" ? "พื้นฐาน" : "ใช้งานบ่อย"}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {COLUMN_TYPES
                    .filter(t => t.category === colCategory)
                    .filter(t => !colSearchTerm || t.label.includes(colSearchTerm) || t.desc.includes(colSearchTerm))
                    .map((t) => {
                    const Icon = t.icon;
                    return (
                      <div
                        key={t.value}
                        className="flex items-start gap-3 p-3 rounded-lg border border-[#e6e9ef] hover:border-[var(--theme-primary)] hover:shadow-sm transition-all bg-white group/card"
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: t.color }}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-gray-800 mb-0.5">{t.label}</div>
                          <div className="text-[11px] text-gray-400 leading-tight mb-2">{t.desc}</div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2 border-gray-300 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]"
                            onClick={() => {
                              createColumn.mutate({ name: t.label, columnType: t.value });
                            }}
                            data-testid={`col-type-add-${t.value}`}
                          >
                            เพิ่มลงบอร์ด
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Options Editor */}
      <StatusEditorDialog
        columnId={showStatusEditor}
        columns={columns}
        onClose={() => setShowStatusEditor(null)}
        onSave={(id, opts) => {
          updateColumn.mutate({ id, data: { options: JSON.stringify(opts) } });
          setShowStatusEditor(null);
        }}
      />
    </Layout>
  );
}

function InlineGroupName({ name, color, onChange }: { name: string; color: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(name); }, [name]);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [editing]);

  if (!editing) {
    return (
      <span
        className="font-bold text-sm cursor-pointer hover:opacity-70"
        style={{ color }}
        onClick={() => setEditing(true)}
      >
        {name}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      className="font-bold text-sm border-b-2 outline-none bg-transparent"
      style={{ color, borderColor: color }}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { setEditing(false); if (val.trim() && val !== name) onChange(val); }}
      onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (val.trim()) onChange(val); } }}
    />
  );
}

function StatusEditorDialog({ columnId, columns, onClose, onSave }: {
  columnId: number | null; columns: any[]; onClose: () => void; onSave: (id: number, opts: any) => void;
}) {
  const col = columns.find((c: any) => c.id === columnId);
  const [labels, setLabels] = useState<any[]>([]);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (col) {
      const opts = col.options ? JSON.parse(col.options) : DEFAULT_STATUS_OPTIONS;
      setLabels(opts.labels || []);
    }
  }, [col]);

  if (!columnId || !col) return null;

  const STATUS_COLORS = ["#00c875", "#fdab3d", "#e2445c", "#c4c4c4", "var(--theme-primary)", "#a25ddc", "#037f4c", "#ff642e", "#cab641", "#ff158a", "#579bfc", "#66ccff"];

  return (
    <Dialog open={!!columnId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">แก้ไขตัวเลือกสถานะ: {col.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {labels.map((l: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-6 h-6 rounded-sm shrink-0 border" style={{ backgroundColor: l.color }} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <div className="grid grid-cols-4 gap-1 p-1">
                    {STATUS_COLORS.map((c) => (
                      <button key={c} className="w-6 h-6 rounded-sm" style={{ backgroundColor: c }} onClick={() => {
                        const updated = [...labels];
                        updated[idx] = { ...updated[idx], color: c };
                        setLabels(updated);
                      }} />
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <Input
                className="h-7 text-xs flex-1"
                value={l.label}
                onChange={(e) => {
                  const updated = [...labels];
                  updated[idx] = { ...updated[idx], label: e.target.value };
                  setLabels(updated);
                }}
              />
              <button onClick={() => setLabels(labels.filter((_: any, i: number) => i !== idx))} className="text-gray-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              className="h-7 text-xs flex-1"
              placeholder="เพิ่มตัวเลือกใหม่"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLabel.trim()) {
                  setLabels([...labels, { label: newLabel.trim(), color: STATUS_COLORS[labels.length % STATUS_COLORS.length] }]);
                  setNewLabel("");
                }
              }}
            />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
              if (newLabel.trim()) {
                setLabels([...labels, { label: newLabel.trim(), color: STATUS_COLORS[labels.length % STATUS_COLORS.length] }]);
                setNewLabel("");
              }
            }}>เพิ่ม</Button>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>ยกเลิก</Button>
            <Button
              size="sm"
              className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-white"
              onClick={() => onSave(columnId, { labels })}
            >
              บันทึก
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
