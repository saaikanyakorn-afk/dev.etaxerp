import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import ThaiDateInput from "@/components/thai-date-input";
import { useDateSettings } from "@/hooks/use-date-settings";
import { useSearch } from "wouter";
import { objectPathToUrl } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList } from "recharts";
import EtaxCenterLayout from "@/components/etax-center-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  Trash2,
  Kanban,
  X,
  Filter,
  ArrowUpDown,
  EyeOff,
  LayoutGrid,
  ListCollapse,
  Building2,
  Upload,
  Pencil,
  ArrowUp,
  ArrowDown,
  Copy,
  Type,
  Hash,
  Calendar,
  Tag,
  SortAsc,
  SortDesc,
  ChevronsUpDown,
  ChevronsUp,
  ChevronsDown,
  Phone,
  Mail,
  AlignLeft,
  CheckSquare,
  ListFilter,
  Columns,
  Paperclip,
  FileIcon,
  Download,
  MessageCircle,
  Send,
  Image,
  UserPlus,
  Share2,
  Link2,
  ClipboardCopy,
  QrCode,
  MessageSquare,
  Check,
  Loader2,
  Users,
  Shield,
  ShieldCheck,
  Eye,
  Crown,
  Save,
  Archive,
  FileDown,
  ArrowRightLeft,
  BarChart3,
  CalendarDays,
  TrendingUp,
  CircleDot,
  User,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  LinkIcon,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  ArrowRight,
  Layers,
  CalendarRange,
  Minus,
  RefreshCw,
} from "lucide-react";

const GROUP_COLORS = [
  "#037f4c", "#00c875", "#9cd326", "#cab641", "#ffcb00",
  "#fdab3d", "#ff642e", "#e2445c", "#bb3354", "#ff158a",
  "#a25ddc", "#784bd1", "#579bfc", "#0086c0", "#66ccff",
  "#225091", "#7f5347", "#c4c4c4", "#808080", "#333333",
];

const STATUS_PRESETS = [
  { label: "ยังไม่เริ่ม", color: "#c4c4c4" },
  { label: "กำลังดำเนินการ", color: "#fdab3d" },
  { label: "รอตรวจ", color: "#e2445c" },
  { label: "รับยอดแล้ว", color: "#579bfc" },
  { label: "ส่งทดลองแล้ว", color: "#0086c0" },
  { label: "เสร็จสิ้น", color: "#00c875" },
  { label: "เกินกำหนด", color: "#e2445c" },
];

const MONTHS_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

const PERSON_COLORS_CHART = [
  "#fb9678", "#03c9d7", "#579bfc", "#00c875", "#fec90f",
  "#f94d4d", "#a25ddc", "#ec4899", "#14b8a6", "#f97316",
];

const COLUMN_TYPES = [
  { value: "text", label: "ข้อความ", icon: Type, color: "#579bfc" },
  { value: "long_text", label: "ข้อความยาว", icon: AlignLeft, color: "#579bfc" },
  { value: "number", label: "ตัวเลข", icon: Hash, color: "#a25ddc" },
  { value: "date", label: "วันที่", icon: Calendar, color: "#fdab3d" },
  { value: "status", label: "สถานะ", icon: ListFilter, color: "#00c875" },
  { value: "phone", label: "เบอร์โทร", icon: Phone, color: "#66ccff" },
  { value: "person", label: "ผู้รับผิดชอบ", icon: Users, color: "#0086c0" },
  { value: "email", label: "อีเมล", icon: Mail, color: "#fdab3d" },
  { value: "dropdown", label: "ดรอปดาวน์", icon: ListFilter, color: "#00c875" },
  { value: "tags", label: "แท็ก", icon: Tag, color: "#a25ddc" },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare, color: "#00c875" },
  { value: "progress", label: "ความคืบหน้า (%)", icon: TrendingUp, color: "#579bfc" },
  { value: "timeline", label: "ไทม์ไลน์", icon: CalendarRange, color: "#fdab3d" },
  { value: "file", label: "แนบไฟล์", icon: Paperclip, color: "#ff642e" },
  { value: "firm_client", label: "ลูกค้า", icon: Building2, color: "#0086c0" },
];

const LABEL_COLORS = [
  "#00c875", "#9cd326", "#cab641", "#ffcb00", "#fdab3d",
  "#ff642e", "#e2445c", "#bb3354", "#ff158a", "#a25ddc",
  "#784bd1", "#579bfc", "#0086c0", "#66ccff", "#7f5347",
  "#c4c4c4", "#808080", "#333333",
];

function StatusCell({ value, options, onChange, onUpdateLabels }: { value: string; options: any[]; onChange: (v: string) => void; onUpdateLabels?: (labels: any[]) => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editLabels, setEditLabels] = useState<any[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [colorPickerIdx, setColorPickerIdx] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const labels = options?.length ? options : STATUS_PRESETS;
  const current = labels.find((l: any) => l.label === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
        setColorPickerIdx(null);
        setNewLabel("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative h-full" ref={ref}>
      <div
        className="h-full flex items-center justify-center px-2 text-xs font-medium text-white cursor-pointer select-none truncate"
        style={{ backgroundColor: current?.color || (value ? "#c4c4c4" : "transparent"), minHeight: 37 }}
        onClick={() => { setOpen(!open); if (open) { setEditing(false); setColorPickerIdx(null); setNewLabel(""); } }}
        data-testid="cell-status"
      >
        {value || ""}
      </div>
      {open && !editing && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-1.5 min-w-[180px]">
          {labels.map((l: any, i: number) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer text-sm"
              onClick={() => { onChange(l.label); setOpen(false); }}
            >
              <div className="w-4 h-4 rounded" style={{ backgroundColor: l.color }} />
              <span className="text-gray-700">{l.label}</span>
            </div>
          ))}
          <div className="border-t mt-1 pt-1 space-y-0.5">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-xs text-gray-400"
              onClick={() => { onChange(""); setOpen(false); }}
            >
              <X className="w-3 h-3" /> ล้างค่า
            </div>
            {onUpdateLabels && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-xs text-gray-500"
                onClick={() => { setEditLabels([...labels]); setEditing(true); }}
                data-testid="btn-edit-labels"
              >
                <Pencil className="w-3 h-3" /> Edit Labels
              </div>
            )}
          </div>
        </div>
      )}
      {open && editing && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 p-3 min-w-[280px]" data-testid="edit-labels-panel">
          <div className="text-xs font-semibold text-gray-700 mb-2">Edit Labels</div>
          <div className="space-y-1.5 mb-3 max-h-[300px]" style={{ overflowY: colorPickerIdx !== null ? "visible" : "auto" }}>
            {editLabels.map((l, i) => (
              <div key={i} className="flex items-center gap-2 group/label">
                <div className="relative">
                  <div
                    className="w-6 h-6 rounded cursor-pointer border border-gray-200 hover:ring-2 hover:ring-[#579bfc] transition-all"
                    style={{ backgroundColor: l.color }}
                    onClick={() => setColorPickerIdx(colorPickerIdx === i ? null : i)}
                  />
                  {colorPickerIdx === i && (
                    <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg p-2 z-[60] grid grid-cols-6 gap-1 w-[156px]">
                      {LABEL_COLORS.map(c => (
                        <div
                          key={c}
                          className={`w-5 h-5 rounded cursor-pointer hover:ring-2 hover:ring-gray-400 ${l.color === c ? "ring-2 ring-[#579bfc]" : ""}`}
                          style={{ backgroundColor: c }}
                          onClick={() => {
                            const next = [...editLabels];
                            next[i] = { ...next[i], color: c };
                            setEditLabels(next);
                            setColorPickerIdx(null);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <input
                  className="flex-1 border rounded px-2 py-1 text-sm bg-white"
                  value={l.label}
                  onChange={e => {
                    const next = [...editLabels];
                    next[i] = { ...next[i], label: e.target.value };
                    setEditLabels(next);
                  }}
                />
                <button
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover/label:opacity-100 transition-opacity"
                  onClick={() => setEditLabels(editLabels.filter((_, j) => j !== i))}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              className="flex-1 border rounded px-2 py-1 text-sm placeholder:text-gray-400"
              placeholder="New label..."
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newLabel.trim()) {
                  setEditLabels([...editLabels, { label: newLabel.trim(), color: LABEL_COLORS[editLabels.length % LABEL_COLORS.length] }]);
                  setNewLabel("");
                }
              }}
            />
            <button
              className="text-xs text-[#579bfc] hover:text-[#4a8de8] font-medium shrink-0"
              onClick={() => {
                if (newLabel.trim()) {
                  setEditLabels([...editLabels, { label: newLabel.trim(), color: LABEL_COLORS[editLabels.length % LABEL_COLORS.length] }]);
                  setNewLabel("");
                }
              }}
            >
              + Add
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-2">
            <button
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 rounded"
              onClick={() => { setEditing(false); setColorPickerIdx(null); }}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1 text-xs bg-[#579bfc] text-white rounded hover:bg-[#4a8de8] font-medium"
              onClick={() => {
                const cleaned = editLabels.filter(l => l.label.trim());
                const unique = cleaned.filter((l, i, arr) => arr.findIndex(x => x.label === l.label) === i);
                if (unique.length === 0) return;
                if (onUpdateLabels) onUpdateLabels(unique);
                setEditing(false);
                setColorPickerIdx(null);
              }}
              data-testid="btn-save-labels"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const PERSON_COLORS = [
  "#03c9d7", "#fb9678", "#579bfc", "#a25ddc", "#00c875",
  "#ff642e", "#fdab3d", "#e2445c", "#cab641", "#037f4c",
  "#784bd1", "#bb3354", "#0086c0", "#ff158a", "#7f5347",
];
function getPersonColor(id: number | string): string {
  return PERSON_COLORS[Math.abs(Number(id)) % PERSON_COLORS.length];
}

function PersonCell({ value, employees, onChange }: { value: string; employees: any[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filtered = employees.filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    (e.nickname || "").toLowerCase().includes(search.toLowerCase())
  );
  const display = value ? (employees.find(e => String(e.id) === String(value)) || employees.find(e => String(e.userId) === String(value))) : null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative h-full" ref={ref}>
      <div
        className="h-full flex items-center cursor-pointer px-2 gap-1.5"
        onClick={() => setOpen(!open)}
        data-testid="cell-person"
        style={{ minHeight: 37 }}
      >
        {display ? (
          <>
            <div className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: getPersonColor(display.id) }}>
              {(display.nickname || display.firstName || "?").charAt(0)}
            </div>
            <span className="text-xs text-gray-700 whitespace-nowrap">{display.nickname || display.firstName}</span>
          </>
        ) : (
          <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
            <Users className="w-3 h-3 text-gray-300" />
          </div>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 w-[220px]">
          <div className="p-2 border-b">
            <Input placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs" autoFocus />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.map(e => (
              <div key={e.id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer text-sm" onClick={() => { onChange(String(e.id)); setOpen(false); setSearch(""); }}>
                <div className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: getPersonColor(e.id) }}>{(e.nickname || e.firstName || "?").charAt(0)}</div>
                <span className="text-gray-700">{e.nickname || `${e.firstName} ${e.lastName}`}</span>
              </div>
            ))}
          </div>
          {value && (
            <div className="border-t p-1">
              <div className="px-3 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-xs text-gray-400 flex items-center gap-1" onClick={() => { onChange(""); setOpen(false); }}>
                <X className="w-3 h-3" /> ล้าง
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDateDMY(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (y && m && d && y.length === 4) return `${d}/${m}/${y}`;
  const parsed = new Date(iso);
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, "0");
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const yyyy = String(parsed.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }
  return iso;
}

function DateCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showInput, setShowInput] = useState(false);
  if (showInput) {
    return (
      <div className="h-full flex items-center justify-center px-2" style={{ minHeight: 37 }}>
        <input
          ref={inputRef}
          type="date"
          value={value || ""}
          onChange={e => { onChange(e.target.value); setShowInput(false); }}
          onBlur={() => setShowInput(false)}
          className="h-7 text-xs border border-gray-300 rounded px-1 w-full"
          autoFocus
          data-testid="cell-date-input"
        />
      </div>
    );
  }
  return (
    <div
      className="h-full flex items-center justify-center px-2 cursor-pointer hover:bg-blue-50/50"
      style={{ minHeight: 37 }}
      onClick={() => setShowInput(true)}
      data-testid="cell-date"
    >
      <span className="text-xs text-gray-600">
        {value ? formatDateDMY(value) : <span className="text-gray-300">dd/mm/yyyy</span>}
      </span>
    </div>
  );
}

function TextCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  useEffect(() => setVal(value || ""), [value]);
  if (editing) {
    return (
      <div className="h-full flex items-center px-2" style={{ minHeight: 37 }}>
        <Input value={val} onChange={e => setVal(e.target.value)} onBlur={() => { onChange(val); setEditing(false); }} onKeyDown={e => { if (e.key === "Enter") { onChange(val); setEditing(false); } }} className="h-7 text-xs border-gray-300" autoFocus />
      </div>
    );
  }
  return (
    <div className="h-full flex items-center px-3 text-xs text-gray-600 cursor-pointer hover:bg-blue-50/50 truncate" onClick={() => setEditing(true)} data-testid="cell-text" style={{ minHeight: 37 }}>
      {value || <span className="text-gray-300">—</span>}
    </div>
  );
}

function CheckboxCell({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const state = value === "na" ? "na" : value ? "checked" : "unchecked";
  const cycle = () => {
    if (state === "unchecked") onChange(true);
    else if (state === "checked") onChange("na");
    else onChange(false);
  };
  return (
    <div className="h-full flex items-center justify-center cursor-pointer select-none" style={{ minHeight: 37 }} onClick={cycle} data-testid="cell-checkbox">
      {state === "checked" && (
        <div className="w-5 h-5 rounded bg-[#00c875] flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      {state === "na" && (
        <div className="w-5 h-5 rounded bg-[#c4c4c4] flex items-center justify-center" title="ไม่เกี่ยวข้อง">
          <Minus className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      {state === "unchecked" && (
        <div className="w-5 h-5 rounded border-2 border-gray-300" />
      )}
    </div>
  );
}

function ProgressCell({ percent }: { percent: number }) {
  const color = percent === 100 ? "#00c875" : percent > 0 ? "#579bfc" : "#c4c4c4";
  return (
    <div className="h-full flex items-center justify-center gap-2 px-2" style={{ minHeight: 37 }} data-testid="cell-progress">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold min-w-[32px] text-right" style={{ color }}>{percent}%</span>
    </div>
  );
}

function LongTextCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);
  if (editing) {
    return (
      <textarea
        autoFocus
        className="w-full min-h-[60px] px-2 py-1 text-xs border border-[#579bfc] outline-none resize-y bg-white"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { if (val !== value) onChange(val); setEditing(false); }}
        onKeyDown={e => { if (e.key === "Escape") { setVal(value); setEditing(false); } }}
      />
    );
  }
  return (
    <div className="px-2 py-1 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 min-h-[32px] flex items-center whitespace-pre-wrap" onClick={() => setEditing(true)}>
      {value || <span className="text-gray-300">—</span>}
    </div>
  );
}

function DropdownCell({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const labels = options?.length ? options : [];
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <div className="px-2 py-1 text-xs text-center cursor-pointer hover:bg-gray-50 min-h-[32px] flex items-center justify-center" onClick={() => setOpen(!open)}>
        {value ? <Badge className="text-[10px] bg-gray-100 text-gray-700 border-gray-200">{value}</Badge> : <span className="text-gray-300">—</span>}
      </div>
      {open && labels.length > 0 && (
        <div className="absolute z-50 top-full left-0 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[140px] p-1">
          {labels.map(l => (
            <div key={l} className={`px-3 py-1.5 text-xs cursor-pointer rounded hover:bg-gray-100 ${value === l ? "bg-gray-50 font-medium" : ""}`}
              onClick={() => { onChange(l); setOpen(false); }}>{l}</div>
          ))}
          {value && <div className="px-3 py-1.5 text-xs cursor-pointer rounded hover:bg-red-50 text-red-400 border-t mt-1" onClick={() => { onChange(""); setOpen(false); }}>ล้าง</div>}
        </div>
      )}
    </div>
  );
}

function TagsCell({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const [inputVal, setInputVal] = useState("");
  const tags: string[] = Array.isArray(value) ? value : (value ? String(value).split(",").filter(Boolean) : []);
  return (
    <div className="px-1 py-0.5 flex flex-wrap gap-0.5 items-center min-h-[32px] cursor-pointer" onClick={e => { const input = (e.currentTarget as HTMLElement).querySelector("input"); input?.focus(); }}>
      {tags.map((t, i) => (
        <Badge key={i} className="text-[10px] h-5 px-1.5 bg-[#a25ddc]/10 text-[#a25ddc] border-[#a25ddc]/20 gap-0.5">
          {t}
          <X className="w-2.5 h-2.5 cursor-pointer" onClick={e => { e.stopPropagation(); onChange(tags.filter((_, j) => j !== i).join(",")); }} />
        </Badge>
      ))}
      <input
        className="text-xs outline-none bg-transparent w-16 min-w-[40px]"
        placeholder={tags.length ? "" : "เพิ่มแท็ก..."}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && inputVal.trim()) { onChange([...tags, inputVal.trim()].join(",")); setInputVal(""); }
          if (e.key === "Backspace" && !inputVal && tags.length) { onChange(tags.slice(0, -1).join(",")); }
        }}
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

function TimelineCell({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const parsed = useMemo(() => {
    if (!value) return { start: "", end: "" };
    if (typeof value === "string") {
      try { const p = JSON.parse(value); return { start: p.start || "", end: p.end || "" }; } catch { return { start: "", end: "" }; }
    }
    return { start: value.start || "", end: value.end || "" };
  }, [value]);

  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(parsed.start);
  const [end, setEnd] = useState(parsed.end);
  useEffect(() => { setStart(parsed.start); setEnd(parsed.end); }, [parsed.start, parsed.end]);

  const save = () => {
    setEditing(false);
    if (start || end) {
      onChange(JSON.stringify({ start, end }));
    } else {
      onChange("");
    }
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
  };

  const getDays = () => {
    if (!parsed.start || !parsed.end) return null;
    const s = new Date(parsed.start);
    const e = new Date(parsed.end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (editing) {
    return (
      <div className="px-1 py-0.5 flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <input type="date" className="border rounded px-1 py-0.5 text-[11px] flex-1" value={start} onChange={e => setStart(e.target.value)} />
          <span className="text-[10px] text-gray-400">→</span>
          <input type="date" className="border rounded px-1 py-0.5 text-[11px] flex-1" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <button className="text-[10px] px-2 py-0.5 bg-[#579bfc] text-white rounded" onClick={save}>OK</button>
          <button className="text-[10px] px-2 py-0.5 bg-gray-100 rounded" onClick={() => setEditing(false)}>ยกเลิก</button>
        </div>
      </div>
    );
  }

  const days = getDays();

  if (!parsed.start && !parsed.end) {
    return (
      <div className="px-2 py-1 text-center cursor-pointer hover:bg-gray-50 min-h-[32px] flex items-center justify-center" onClick={() => setEditing(true)}>
        <span className="text-[11px] text-gray-300">— กำหนดวัน —</span>
      </div>
    );
  }

  return (
    <div className="px-1 py-0.5 cursor-pointer hover:bg-gray-50 min-h-[32px] flex items-center" onClick={() => setEditing(true)}>
      <div className="flex-1 relative">
        <div className="h-6 rounded-full bg-[#579bfc]/20 flex items-center justify-between px-2">
          <span className="text-[10px] font-medium text-[#579bfc]">{formatDate(parsed.start)}</span>
          <span className="text-[10px] font-medium text-[#579bfc]">{formatDate(parsed.end)}</span>
        </div>
        {days !== null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-bold text-[#579bfc]">{days}d</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FirmClientCell({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const { user } = useAuth();
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/firm-clients-list", user?.tenantId],
    queryFn: async () => {
      const r = await fetch("/api/firm-clients?limit=500", { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : (data.clients || []);
    },
    enabled: !!user?.tenantId,
    staleTime: 60000,
  });
  const selectedClient = clients.find((c: any) => String(c.id) === String(value));
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = clients.filter((c: any) => !search || c.name?.toLowerCase().includes(search.toLowerCase()));
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) { setOpen(false); setSearch(""); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={wrapperRef} className="px-1 py-0.5 min-h-[32px] relative">
      <button
        className="w-full text-left text-[11px] px-1.5 py-1 rounded hover:bg-gray-50 truncate flex items-center gap-1"
        onClick={() => setOpen(!open)}
        data-testid="firm-client-cell"
      >
        {selectedClient ? (
          <span className="text-gray-800 truncate">{selectedClient.name}</span>
        ) : (
          <span className="text-gray-400">เลือกลูกค้า</span>
        )}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden" data-testid="firm-client-dropdown">
          <input
            className="w-full px-3 py-2 text-xs border-b border-gray-100 outline-none"
            placeholder="ค้นหาลูกค้า..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            data-testid="firm-client-search"
          />
          <div className="overflow-y-auto max-h-48">
            {value && (
              <button className="w-full text-left px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-50" onClick={() => { onChange(""); setOpen(false); setSearch(""); }}>
                ยกเลิกการเลือก
              </button>
            )}
            {filtered.map((c: any) => (
              <button
                key={c.id}
                className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-blue-50 truncate ${String(c.id) === String(value) ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"}`}
                onClick={() => { onChange(String(c.id)); setOpen(false); setSearch(""); }}
                data-testid={`firm-client-option-${c.id}`}
              >
                {c.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">ไม่พบลูกค้า</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function FileCell({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const files: { name: string; path: string; size?: number }[] = (() => {
    if (!value) return [];
    if (typeof value === "string") { try { const p = JSON.parse(value); return Array.isArray(p) ? p : [p]; } catch { return []; } }
    if (Array.isArray(value)) return value;
    return [value];
  })();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const newFiles = [...files];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const res = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
          credentials: "include",
        });
        if (!res.ok) throw new Error("Upload failed");
        const { uploadURL, objectPath } = await res.json();
        const up = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!up.ok) throw new Error("Upload failed");
        newFiles.push({ name: file.name, path: objectPath, size: file.size });
      }
      onChange(JSON.stringify(newFiles));
    } catch (err) {
      console.error("File upload error:", err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    onChange(updated.length ? JSON.stringify(updated) : "");
  };

  const getFileExt = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ext;
  };

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
      <div className="px-1 py-0.5 min-h-[32px] flex items-center">
        <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} multiple />
        <button
          className="flex items-center gap-1 text-[11px] text-gray-300 hover:text-gray-500 rounded px-1 py-0.5"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-1 py-0.5 min-h-[32px] group/filecell">
      <div className="flex items-center gap-0.5 flex-wrap">
        {files.map((f, i) => (
          <a
            key={i}
            href={f.path}
            target="_blank"
            rel="noreferrer"
            className="relative flex-shrink-0 w-7 h-8 flex items-center justify-center group/ficon"
            title={f.name}
          >
            <svg viewBox="0 0 24 30" className="w-full h-full" fill="none">
              <path d="M2 2C2 0.9 2.9 0 4 0H16L22 6V28C22 29.1 21.1 30 20 30H4C2.9 30 2 29.1 2 28V2Z" fill={getFileColor(f.name)} fillOpacity="0.15" stroke={getFileColor(f.name)} strokeWidth="1.2"/>
              <path d="M16 0L22 6H18C16.9 6 16 5.1 16 4V0Z" fill={getFileColor(f.name)} fillOpacity="0.3"/>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold uppercase pt-1.5" style={{ color: getFileColor(f.name) }}>
              {getFileExt(f.name).slice(0, 4)}
            </span>
            <button
              className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white border border-gray-300 rounded-full items-center justify-center hidden group-hover/ficon:flex shadow-sm"
              onClick={e => { e.preventDefault(); e.stopPropagation(); removeFile(i); }}
            >
              <X className="w-2 h-2 text-red-400" />
            </button>
          </a>
        ))}
        <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} multiple />
        <button
          className="w-6 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded opacity-0 group-hover/filecell:opacity-100 flex-shrink-0"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

const CellRenderer = memo(function CellRenderer({ col, value, employees, onChange, onUpdateLabels }: { col: any; value: any; employees: any[]; onChange: (v: any) => void; onUpdateLabels?: (labels: any[]) => void }) {
  const opts = col.options ? (typeof col.options === "string" ? JSON.parse(col.options) : col.options) : null;
  switch (col.columnType) {
    case "status": return <StatusCell value={value || ""} options={opts?.labels || STATUS_PRESETS} onChange={onChange} onUpdateLabels={onUpdateLabels} />;
    case "person": return <PersonCell value={value || ""} employees={employees} onChange={onChange} />;
    case "date": return <DateCell value={value || ""} onChange={onChange} />;
    case "number": return <TextCell value={value || ""} onChange={onChange} />;
    case "checkbox": return <CheckboxCell value={value} onChange={onChange} />;
    case "progress": return <ProgressCell percent={typeof value === "number" ? value : (parseInt(value) || 0)} />;
    case "long_text": return <LongTextCell value={value || ""} onChange={onChange} />;
    case "phone": return <TextCell value={value || ""} onChange={onChange} />;
    case "email": return <TextCell value={value || ""} onChange={onChange} />;
    case "dropdown": return <DropdownCell value={value || ""} options={opts?.items || []} onChange={onChange} />;
    case "tags": return <TagsCell value={value} onChange={onChange} />;
    case "timeline": return <TimelineCell value={value} onChange={onChange} />;
    case "file": return <FileCell value={value} onChange={onChange} />;
    case "firm_client": return <FirmClientCell value={value} onChange={onChange} />;
    default: return <TextCell value={value || ""} onChange={onChange} />;
  }
});

function InlineEdit({ value, onSave, className, style, testId }: { value: string; onSave: (v: string) => void; className?: string; style?: React.CSSProperties; testId?: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);

  if (editing) {
    return (
      <Input
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { if (val.trim() && val !== value) onSave(val.trim()); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === "Enter") { if (val.trim() && val !== value) onSave(val.trim()); setEditing(false); }
          if (e.key === "Escape") { setVal(value); setEditing(false); }
        }}
        className="h-7 text-sm px-1 w-auto min-w-[100px]"
        autoFocus
        onClick={e => e.stopPropagation()}
      />
    );
  }
  return (
    <span className={`cursor-pointer hover:bg-black/5 rounded px-1 py-0.5 ${className || ""}`} style={style} onClick={() => setEditing(true)} data-testid={testId}>
      {value}
    </span>
  );
}

export default function EtaxHubClientBoard({ defaultTab }: { defaultTab?: string } = {}) {
  const { user } = useAuth();
  const { selectedCompanyId, primaryCompanyId } = useCompany();
  const { toast } = useToast();
  const { dateEra, dateFmt } = useDateSettings();
  const qc = useQueryClient();
  const isExternalUser = (user as any)?.role === "client_external";

  const searchString = useSearch();
  const selectedBoardId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("boardId") ? Number(params.get("boardId")) : null;
  }, [searchString]);

  const [newItemNames, setNewItemNames] = useState<Record<number, string>>({});
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [boardContainerWidth, setBoardContainerWidth] = useState(0);
  useEffect(() => {
    const el = boardScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setBoardContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setBoardContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const [newSubitemNames, setNewSubitemNames] = useState<Record<number, string>>({});
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("text");
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState<{ headers: string[]; rows: any[][] } | null>(null);
  const [importMapping, setImportMapping] = useState<Record<number, string>>({});
  const [importTargetGroup, setImportTargetGroup] = useState<number | "">("");
  const [importPending, setImportPending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ ids: number[]; timer: ReturnType<typeof setTimeout>; countdown: number } | null>(null);
  const pendingDeleteRef = useRef(pendingDelete);
  pendingDeleteRef.current = pendingDelete;
  const [personFilter, setPersonFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterYear, setFilterYear] = useState(now.getFullYear() + 543);
  const isAdminLevel = user?.role === "admin" || user?.role === "super_admin" || user?.role === "manager";
  const [activeTab, setActiveTab] = useState(defaultTab || (isAdminLevel || isExternalUser ? "main" : "mywork"));
  const [showUploadLinks, setShowUploadLinks] = useState(false);
  const [showSaveView, setShowSaveView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [renamingViewId, setRenamingViewId] = useState<number | null>(null);
  const [renameViewValue, setRenameViewValue] = useState("");
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const resizingRef = useRef<{ colId: number; startX: number; startW: number } | null>(null);
  const [renamingColId, setRenamingColId] = useState<number | null>(null);
  const [renameColValue, setRenameColValue] = useState("");
  const [sortConfig, setSortConfig] = useState<{ colId: number; dir: "asc" | "desc" } | null>(null);
  const [hiddenTabs, setHiddenTabs] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`etax-hub-hidden-tabs-${user?.id}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  useEffect(() => {
    if (user?.id) localStorage.setItem(`etax-hub-hidden-tabs-${user.id}`, JSON.stringify([...hiddenTabs]));
  }, [hiddenTabs, user?.id]);
  const [hiddenCols, setHiddenCols] = useState<Set<number>>(new Set());
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showHidePanel, setShowHidePanel] = useState(false);
  const [filterRules, setFilterRules] = useState<Array<{ colId: number | null; condition: string; value: string }>>([]);
  const [filterColId, setFilterColId] = useState<number | null>(null);
  const [filterValue, setFilterValue] = useState("");
  const [collapsedCols, setCollapsedCols] = useState<Set<number>>(new Set());
  const [openItemId, setOpenItemId] = useState<number | null>(null);
  const [dragItemId, setDragItemId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ groupId: number; position: number } | null>(null);
  const [dragColId, setDragColId] = useState<number | null>(null);
  const [dragOverColId, setDragOverColId] = useState<number | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteTab, setInviteTab] = useState<"link" | "email" | "line" | "qr" | "group-links">("link");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLineId, setInviteLineId] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [shareLinks, setShareLinks] = useState<any[]>([]);
  const [shareLinksLoading, setShareLinksLoading] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkGroupIds, setNewLinkGroupIds] = useState<number[]>([]);
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [addMemberUserId, setAddMemberUserId] = useState<number | null>(null);
  const [addMemberRole, setAddMemberRole] = useState<"editor" | "viewer" | "owner">("editor");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const selectedItemIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => { selectedItemIdsRef.current = selectedItemIds; }, [selectedItemIds]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { colId, startX, startW } = resizingRef.current;
      const diff = e.clientX - startX;
      const newW = Math.max(80, startW + diff);
      setColWidths(prev => ({ ...prev, [colId]: newW }));
    };
    const onMouseUp = () => {
      if (resizingRef.current) {
        resizingRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const boardCompanyId = primaryCompanyId || selectedCompanyId;
  const { data: boardsRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/etax-hub/boards", boardCompanyId, isExternalUser],
    queryFn: async () => {
      const r = await fetch(`/api/etax-hub/boards?companyId=${boardCompanyId || 0}`, { credentials: "include" });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: isExternalUser || !!boardCompanyId,
  });
  const boards = Array.isArray(boardsRaw) ? boardsRaw : [];

  useEffect(() => {
    if (isExternalUser && boards.length > 0 && !selectedBoardId) {
      const boardId = boards[0].id;
      window.history.replaceState(null, "", `/etax-hub/board?boardId=${boardId}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [isExternalUser, boards, selectedBoardId]);

  const { data: boardData } = useQuery<any>({
    queryKey: ["/api/etax-hub/boards", selectedBoardId, "data", boardCompanyId],
    queryFn: async () => {
      const r = await fetch(`/api/etax-hub/boards/${selectedBoardId}/data?companyId=${boardCompanyId || 0}`, { credentials: "include" });
      if (!r.ok) return { groups: [], columns: [], items: [], subitems: [] };
      return r.json();
    },
    enabled: !!selectedBoardId && (isExternalUser || !!boardCompanyId),
    staleTime: 10000,
  });

  const firmCompanyId = primaryCompanyId || selectedCompanyId;
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees", firmCompanyId],
    queryFn: () => fetch(`/api/employees?companyId=${firmCompanyId}&status=active`, { credentials: "include" }).then(r => r.json()).then(d => Array.isArray(d) ? d : d.employees || []),
    enabled: !!firmCompanyId,
  });

  const myRoleQuery = useQuery({
    queryKey: ["/api/etax-hub/boards", selectedBoardId, "my-role"],
    queryFn: () => selectedBoardId ? fetch(`/api/etax-hub/boards/${selectedBoardId}/my-role?companyId=${boardCompanyId || 0}`, { credentials: "include" }).then(r => r.json()) : null,
    enabled: !!selectedBoardId,
  });

  const groups = boardData?.groups || [];
  const allColumns = boardData?.columns || [];
  const columns = allColumns.filter((c: any) => (c.level || "main") === "main");
  const subitemColumns = allColumns.filter((c: any) => c.level === "subitem");
  const items = boardData?.items || [];
  const subitems = boardData?.subitems || [];
  const updateCounts: Record<number, number> = boardData?.updateCounts || {};
  const updaters: Record<number, { id: number; name: string }> = boardData?.updaters || {};
  const myBoardRole: string | null = boardData?.myRole || (myRoleQuery.data as any)?.role || null;
  const canEdit = myBoardRole === "owner" || myBoardRole === "editor";
  const isOwnerRole = myBoardRole === "owner";
  const currentBoard = boards.find((b: any) => b.id === selectedBoardId);

  const apiCall = useCallback(async (url: string, method: string, body?: any) => {
    const enrichedBody = body ? { ...body, companyId: body.companyId ?? boardCompanyId } : undefined;
    const separator = url.includes("?") ? "&" : "?";
    const urlWithCompany = method === "GET" || method === "DELETE"
      ? `${url}${separator}companyId=${boardCompanyId}`
      : url;
    const res = await fetch(urlWithCompany, {
      method,
      headers: enrichedBody ? { "Content-Type": "application/json" } : {},
      credentials: "include",
      body: enrichedBody ? JSON.stringify(enrichedBody) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Error");
    }
    return res.json();
  }, [boardCompanyId]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["/api/etax-hub/boards"] });
    if (selectedBoardId) {
      qc.invalidateQueries({ queryKey: ["/api/etax-hub/boards", selectedBoardId, "data"] });
    }
    qc.invalidateQueries({ queryKey: ["/api/etax-hub/stats"] });
  }, [qc, selectedBoardId]);

  const createGroup = useMutation({
    mutationFn: (name?: string) => apiCall(`/api/etax-hub/boards/${selectedBoardId}/groups`, "POST", {
      name: name || "กลุ่มใหม่",
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
    }),
    onSuccess: invalidate,
  });

  const importCompanies = useMutation({
    mutationFn: (groupId: number) => apiCall("/api/etax-hub/items/import-companies", "POST", {
      boardId: selectedBoardId,
      groupId,
      companyId: boardCompanyId,
    }),
    onSuccess: (data) => {
      invalidate();
      toast({ title: "นำเข้าสำเร็จ", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const syncAssignments = useMutation({
    mutationFn: () => apiCall(`/api/etax-hub/boards/${selectedBoardId}/sync-assignments`, "POST", {
      companyId: boardCompanyId,
    }),
    onSuccess: (data: any) => {
      invalidate();
      toast({ title: "Sync สำเร็จ", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const updateGroup = useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/api/etax-hub/groups/${id}`, "PUT", data),
    onSuccess: invalidate,
  });

  const deleteGroup = useMutation({
    mutationFn: (id: number) => apiCall(`/api/etax-hub/groups/${id}`, "DELETE"),
    onSuccess: invalidate,
  });

  const createColumn = useMutation({
    mutationFn: (data: any) => apiCall(`/api/etax-hub/boards/${selectedBoardId}/columns`, "POST", data),
    onSuccess: () => { invalidate(); setAddColumnOpen(false); setNewColName(""); setNewColType("text"); },
  });

  const deleteColumn = useMutation({
    mutationFn: (id: number) => apiCall(`/api/etax-hub/columns/${id}`, "DELETE"),
    onSuccess: invalidate,
  });
  const viewsQuery = useQuery({
    queryKey: ["/api/etax-hub/boards", selectedBoardId, "views"],
    queryFn: () => selectedBoardId ? fetch(`/api/etax-hub/boards/${selectedBoardId}/views?companyId=${boardCompanyId}`, { credentials: "include" }).then(r => r.json()) : [],
    enabled: !!selectedBoardId,
  });
  const savedViews: any[] = Array.isArray(viewsQuery.data) ? viewsQuery.data : [];
  const createView = useMutation({
    mutationFn: (data: { name: string; filters: any; isShared?: boolean }) =>
      apiCall(`/api/etax-hub/boards/${selectedBoardId}/views?companyId=${boardCompanyId}`, "POST", data),
    onSuccess: (view: any) => {
      qc.invalidateQueries({ queryKey: ["/api/etax-hub/boards", selectedBoardId, "views"] });
      setActiveTab(`view-${view.id}`);
      setShowSaveView(false);
      setNewViewName("");
    },
  });
  const updateView = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; filters?: any }) =>
      apiCall(`/api/etax-hub/views/${id}`, "PUT", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/etax-hub/boards", selectedBoardId, "views"] }),
  });
  const deleteView = useMutation({
    mutationFn: (id: number) => apiCall(`/api/etax-hub/views/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/etax-hub/boards", selectedBoardId, "views"] });
      setActiveTab("main");
    },
  });
  const membersQuery = useQuery({
    queryKey: ["/api/etax-hub/boards", selectedBoardId, "members"],
    queryFn: () => selectedBoardId ? fetch(`/api/etax-hub/boards/${selectedBoardId}/members`, { credentials: "include" }).then(r => r.json()) : null,
    enabled: !!selectedBoardId && showMembersDialog,
  });
  const addMember = useMutation({
    mutationFn: (data: { userId: number; role: string }) =>
      apiCall(`/api/etax-hub/boards/${selectedBoardId}/members`, "POST", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/etax-hub/boards", selectedBoardId, "members"] }); setAddMemberUserId(null); },
  });
  const updateMemberRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: string }) =>
      apiCall(`/api/etax-hub/boards/${selectedBoardId}/members/${memberId}`, "PUT", { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/etax-hub/boards", selectedBoardId, "members"] }),
  });
  const removeMember = useMutation({
    mutationFn: (memberId: number) =>
      apiCall(`/api/etax-hub/boards/${selectedBoardId}/members/${memberId}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/etax-hub/boards", selectedBoardId, "members"] }),
  });
  const reorderColumns = useMutation({
    mutationFn: (columnIds: number[]) => apiCall("/api/etax-hub/columns/reorder", "PUT", { boardId: selectedBoardId, columnIds }),
    onSuccess: invalidate,
  });

  const handleColumnDragStart = useCallback((e: React.DragEvent, colId: number) => {
    setDragColId(colId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(colId));
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
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
    const cols = columns as any[];
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
  }, [dragColId, columns, reorderColumns]);

  const reorderItem = useMutation({
    mutationFn: (data: { itemId: number; targetGroupId: number; targetPosition: number }) => apiCall("/api/etax-hub/items/reorder", "PUT", data),
    onSuccess: invalidate,
  });
  const updateColumn = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; columnType?: string; options?: any }) => apiCall(`/api/etax-hub/columns/${id}`, "PUT", data),
    onSuccess: () => { invalidate(); setRenamingColId(null); setRenameColValue(""); },
  });
  const duplicateColumn = useMutation({
    mutationFn: (col: any) => apiCall(`/api/etax-hub/boards/${selectedBoardId}/columns`, "POST", { name: `${col.name} (สำเนา)`, columnType: col.columnType, options: col.options }),
    onSuccess: invalidate,
  });

  const createItem = useMutation({
    mutationFn: (data: any) => apiCall(`/api/etax-hub/items`, "POST", data),
    onSuccess: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/api/etax-hub/items/${id}`, "PUT", data),
    onSuccess: invalidate,
  });

  const updateCellOnly = useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/api/etax-hub/items/${id}`, "PUT", data),
    onMutate: async ({ id, ...data }) => {
      const key = ["/api/etax-hub/boards", selectedBoardId, "data", boardCompanyId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: any) => {
        if (!old) return old;
        return { ...old, items: (old.items || []).map((it: any) => it.id === id ? { ...it, ...data } : it) };
      });
      return { prev, key };
    },
    onError: (_err: any, _vars: any, ctx: any) => { if (ctx) qc.setQueryData(ctx.key, ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["/api/etax-hub/boards", selectedBoardId, "data", boardCompanyId] }); },
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => apiCall(`/api/etax-hub/items/${id}`, "DELETE"),
    onSuccess: invalidate,
  });

  const bulkDeleteItems = useMutation({
    mutationFn: async (ids: number[]) => {
      const safeIds = ids.filter(n => !isNaN(n) && n > 0);
      if (!safeIds.length) return { deleted: 0, lastErr: "No valid IDs" };
      const result = await apiCall("/api/etax-hub/items/batch-delete", "DELETE", { itemIds: safeIds });
      return { deleted: result.deleted || 0, lastErr: "" };
    },
    onSuccess: ({ deleted, lastErr }) => {
      invalidate();
      setSelectedItemIds(new Set());
      if (deleted > 0) {
        toast({ title: `ลบ ${deleted} รายการสำเร็จ` });
      } else if (lastErr) {
        toast({ title: "ลบไม่สำเร็จ", description: lastErr, variant: "destructive" });
      }
    },
  });

  const bulkMoveItems = useMutation({
    mutationFn: async ({ ids, targetGroupId }: { ids: number[]; targetGroupId: number }) => {
      let moved = 0;
      let lastErr = "";
      for (const id of ids) {
        try { await apiCall("/api/etax-hub/items/reorder", "PUT", { itemId: id, targetGroupId, targetPosition: 999 }); moved++; } catch (e: any) { lastErr = e.message || "Error"; }
      }
      return { moved, lastErr };
    },
    onSuccess: ({ moved, lastErr }) => {
      invalidate();
      setSelectedItemIds(new Set());
      if (moved > 0) {
        toast({ title: `ย้าย ${moved} รายการสำเร็จ` });
      } else if (lastErr) {
        toast({ title: "ย้ายไม่สำเร็จ", description: lastErr, variant: "destructive" });
      }
    },
  });

  const bulkMoveToBoard = useMutation({
    mutationFn: async ({ ids, targetBoardId, targetGroupId }: { ids: number[]; targetBoardId: number; targetGroupId?: number }) => {
      return await apiCall("/api/etax-hub/items/move-to-board", "PUT", { itemIds: ids, targetBoardId, targetGroupId });
    },
    onSuccess: (data: any) => {
      invalidate();
      setSelectedItemIds(new Set());
      toast({ title: `ย้ายข้ามบอร์ด ${data.moved || 0} รายการสำเร็จ` });
    },
    onError: (err: any) => {
      toast({ title: "ย้ายไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const createSubitem = useMutation({
    mutationFn: (data: any) => apiCall(`/api/etax-hub/subitems`, "POST", data),
    onSuccess: invalidate,
  });

  const updateSubitem = useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/api/etax-hub/subitems/${id}`, "PUT", data),
    onSuccess: invalidate,
  });

  const updateSubitemCellOnly = useMutation({
    mutationFn: ({ id, ...data }: any) => apiCall(`/api/etax-hub/subitems/${id}`, "PUT", data),
    onMutate: async ({ id, ...data }) => {
      const key = ["/api/etax-hub/boards", selectedBoardId, "data", boardCompanyId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          subitems: (old.subitems || []).map((si: any) => si.id === id ? { ...si, ...data } : si),
        };
      });
      return { prev, key };
    },
    onError: (_err: any, _vars: any, ctx: any) => { if (ctx) qc.setQueryData(ctx.key, ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["/api/etax-hub/boards", selectedBoardId, "data", boardCompanyId] }); },
  });

  const deleteSubitem = useMutation({
    mutationFn: (id: number) => apiCall(`/api/etax-hub/subitems/${id}`, "DELETE"),
    onSuccess: invalidate,
  });

  const bulkUpdateCells = useMutation({
    mutationFn: async ({ columnId, value, itemIds }: { columnId: number; value: any; itemIds: number[] }) => {
      const res = await apiCall("/api/etax-hub/items/bulk-update", "PUT", { itemIds, columnId, value });
      return { ...res, count: itemIds.length };
    },
    onSuccess: (data: any) => {
      invalidate();
      toast({ title: `อัปเดต ${data.updated || data.count} รายการสำเร็จ` });
    },
    onError: (err: any) => {
      toast({ title: "อัปเดตไม่สำเร็จ", description: err.message || "เกิดข้อผิดพลาด", variant: "destructive" });
    },
  });

  const handleCellChange = useCallback((item: any, colId: number, value: any) => {
    if (!colId || isNaN(colId)) return;
    const currentSelected = selectedItemIdsRef.current;
    if (currentSelected.size > 1 && currentSelected.has(item.id)) {
      const safeIds = Array.from(currentSelected).filter(id => id && !isNaN(id));
      if (!safeIds.length) return;
      bulkUpdateCells.mutate({ columnId: colId, value, itemIds: safeIds });
      return;
    }
    const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
    cv[String(colId)] = value;

    const changedCol = columns.find((c: any) => c.id === colId);
    if (changedCol?.columnType === "checkbox") {
      const checkboxCols = columns.filter((c: any) => c.columnType === "checkbox");
      const progressCol = columns.find((c: any) => c.columnType === "progress");
      if (progressCol && checkboxCols.length > 0) {
        const done = checkboxCols.filter((c: any) => { const v = cv[String(c.id)]; return v === true || v === "na"; }).length;
        cv[String(progressCol.id)] = Math.round((done / checkboxCols.length) * 100);
      }
    }

    updateCellOnly.mutate({ id: item.id, cellValues: JSON.stringify(cv) });
  }, [updateCellOnly, bulkUpdateCells, columns]);

  const handleSubitemCellChange = useCallback((si: any, colId: number, value: any) => {
    const cv = typeof si.cellValues === "string" ? JSON.parse(si.cellValues || "{}") : (si.cellValues || {});
    cv[String(colId)] = value;
    updateSubitemCellOnly.mutate({ id: si.id, cellValues: JSON.stringify(cv) });
  }, [updateSubitemCellOnly]);

  const activeView = activeTab.startsWith("view-") ? savedViews.find((v: any) => `view-${v.id}` === activeTab) : null;
  const isMyWorkTab = activeTab === "mywork";
  const myUserId = String(user?.id || "");
  const myEmployee = employees.find((e: any) => String(e.userId) === myUserId);
  const myPersonIds = myEmployee ? [myUserId, String(myEmployee.id)] : [myUserId];
  const effectivePersonFilter = activeView ? (activeView.filters as any)?.personFilter || "" : personFilter;
  const effectiveStatusFilter = activeView ? (activeView.filters as any)?.statusFilter || "" : statusFilter;
  const effectiveFilterRules = activeView ? (activeView.filters as any)?.filterRules || [] : filterRules;

  const dateCols = useMemo(() => columns.filter((c: any) => c.columnType === "date"), [columns]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (pendingDelete) {
      const pendingSet = new Set(pendingDelete.ids);
      filtered = filtered.filter((it: any) => !pendingSet.has(it.id));
    }
    if (searchQuery) {
      filtered = filtered.filter((it: any) => it.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (dateCols.length > 0 && filterMonth > 0) {
      const targetYear = filterYear - 543;
      const targetMonth = filterMonth;
      filtered = filtered.filter((it: any) => {
        const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
        const hasAnyDate = dateCols.some((col: any) => cv[String(col.id)]);
        if (!hasAnyDate) return true;
        return dateCols.some((col: any) => {
          const dateStr = cv[String(col.id)];
          if (!dateStr) return false;
          const d = new Date(dateStr);
          return d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth;
        });
      });
    }
    if (isMyWorkTab) {
      filtered = filtered.filter((it: any) => {
        const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
        const personCols = columns.filter((c: any) => c.columnType === "person");
        return personCols.some((col: any) => myPersonIds.includes(String(cv[col.id] || "")));
      });
    } else if (!isMyWorkTab) {
      const pf = effectivePersonFilter;
      if (pf) {
        filtered = filtered.filter((it: any) => {
          const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
          const personCols = columns.filter((c: any) => c.columnType === "person");
          return personCols.some((col: any) => String(cv[col.id]) === pf);
        });
      }
    }
    const sf = effectiveStatusFilter;
    if (sf) {
      filtered = filtered.filter((it: any) => {
        const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
        const statusCols = columns.filter((c: any) => c.columnType === "status");
        return statusCols.some((col: any) => String(cv[col.id]) === sf);
      });
    }
    if (filterColId && filterValue) {
      filtered = filtered.filter((it: any) => {
        const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
        const val = String(cv[filterColId] || "").toLowerCase();
        return val.includes(filterValue.toLowerCase());
      });
    }
    const activeRules = effectiveFilterRules.filter((r: any) => r.colId && r.value);
    if (activeRules.length > 0) {
      filtered = filtered.filter((it: any) => {
        const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
        return activeRules.every(rule => {
          const val = String(cv[rule.colId!] || "").toLowerCase();
          const target = rule.value.toLowerCase();
          switch (rule.condition) {
            case "contains": return val.includes(target);
            case "not_contains": return !val.includes(target);
            case "is": return val === target;
            case "is_not": return val !== target;
            case "is_empty": return !val;
            case "is_not_empty": return !!val;
            default: return val.includes(target);
          }
        });
      });
    }
    if (sortConfig) {
      filtered = [...filtered].sort((a: any, b: any) => {
        const cvA = typeof a.cellValues === "string" ? JSON.parse(a.cellValues || "{}") : (a.cellValues || {});
        const cvB = typeof b.cellValues === "string" ? JSON.parse(b.cellValues || "{}") : (b.cellValues || {});
        const valA = String(cvA[sortConfig.colId] || "");
        const valB = String(cvB[sortConfig.colId] || "");
        const cmp = valA.localeCompare(valB, "th");
        return sortConfig.dir === "asc" ? cmp : -cmp;
      });
    }
    return filtered;
  }, [items, searchQuery, effectivePersonFilter, effectiveStatusFilter, sortConfig, columns, filterMonth, filterYear, dateCols, isMyWorkTab, myPersonIds, filterColId, filterValue, effectiveFilterRules]);

  return (
    <EtaxCenterLayout fullWidth>
      <div className="flex flex-col h-full bg-white">
        {!selectedBoardId || !currentBoard ? (
          <div className="flex-1 flex items-center justify-center bg-[#f6f7fb]">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                <Kanban className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-xl font-medium text-gray-500 mb-2">เลือกบอร์ดจากเมนูซ้ายเพื่อเริ่มต้น</p>
              <p className="text-sm text-gray-400">หรือสร้างบอร์ดใหม่ที่หัวข้อ Workspaces</p>
            </div>
          </div>
        ) : (
          <>
            {/* Board Header */}
            <div className="px-6 pt-5 pb-0 bg-white shrink-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="text-board-name">
                  {currentBoard.name}
                </h1>
                <ChevronDown className="w-4 h-4 text-gray-400" />
                {myBoardRole && (
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
                    myBoardRole === "owner" ? "bg-[#fb9678]/15 text-[#fb9678]" :
                    myBoardRole === "editor" ? "bg-[#05b187]/15 text-[#05b187]" :
                    "bg-[#539BFF]/15 text-[#539BFF]"
                  }`} data-testid="badge-my-role">
                    {myBoardRole === "owner" ? <Crown className="w-3 h-3" /> : myBoardRole === "editor" ? <ShieldCheck className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {myBoardRole === "owner" ? "Owner" : myBoardRole === "editor" ? "Editor" : "Viewer"}
                  </span>
                )}
                <button
                  onClick={() => setShowMembersDialog(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#fb9678] text-[#fb9678] hover:bg-[#fb9678]/10 rounded-lg text-sm font-medium transition-colors"
                  data-testid="btn-manage-members"
                >
                  <Users className="w-4 h-4" />
                  สิทธิ์
                </button>
                {currentBoard.visibility === "shareable" && currentBoard.shareToken && (
                  <button
                    onClick={() => { setShowInviteDialog(true); setInviteTab("link"); setInviteResult(null); setQrData(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#03c9d7] hover:bg-[#03c9d7]/90 text-white rounded-lg text-sm font-medium transition-colors"
                    data-testid="btn-invite-board"
                  >
                    <UserPlus className="w-4 h-4" />
                    เชิญ
                  </button>
                )}
              </div>

              {/* Tab bar */}
              <div className="flex items-center border-b mt-3">
                {(user?.role === "admin" || user?.role === "super_admin" || user?.role === "manager" || myBoardRole === "owner") && (
                <button
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "main" ? "border-[#579bfc] text-[#579bfc]" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => { setActiveTab("main"); setPersonFilter(""); setStatusFilter(""); }}
                  data-testid="tab-main"
                >
                  Main table
                </button>
                )}
                <button
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "mywork" ? "border-[#579bfc] text-[#579bfc]" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => { setActiveTab("mywork"); setPersonFilter(""); setStatusFilter(""); }}
                  data-testid="tab-mywork"
                >
                  งานของฉัน
                </button>
                {(user?.role === "admin" || user?.role === "super_admin" || user?.role === "manager" || myBoardRole === "owner") && (
                <button
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "dashboard" ? "border-[#579bfc] text-[#579bfc]" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setActiveTab("dashboard")}
                  data-testid="tab-dashboard"
                >
                  แดชบอร์ด
                </button>
                )}
                {savedViews.map((v: any) => (
                  <div key={v.id} className="relative group/tab flex items-center">
                    {renamingViewId === v.id ? (
                      <input
                        className="px-3 py-2 text-sm border-b-2 border-[#579bfc] outline-none w-28"
                        value={renameViewValue}
                        onChange={e => setRenameViewValue(e.target.value)}
                        onBlur={() => { if (renameViewValue.trim()) updateView.mutate({ id: v.id, name: renameViewValue.trim() }); setRenamingViewId(null); }}
                        onKeyDown={e => { if (e.key === "Enter") { if (renameViewValue.trim()) updateView.mutate({ id: v.id, name: renameViewValue.trim() }); setRenamingViewId(null); } }}
                        autoFocus
                      />
                    ) : (
                      <button
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === `view-${v.id}` ? "border-[#579bfc] text-[#579bfc]" : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                        onClick={() => setActiveTab(`view-${v.id}`)}
                        onDoubleClick={() => { setRenamingViewId(v.id); setRenameViewValue(v.name); }}
                        data-testid={`tab-view-${v.id}`}
                      >
                        {v.name}
                        {v.isShared && <span className="ml-1 text-[10px] text-[#03c9d7]">●</span>}
                      </button>
                    )}
                    <button
                      className="absolute -right-1 -top-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none hidden group-hover/tab:flex items-center justify-center z-10"
                      onClick={e => { e.stopPropagation(); if (confirm("ลบ View นี้?")) { deleteView.mutate(v.id); if (activeTab === `view-${v.id}`) setActiveTab("main"); } }}
                      data-testid={`btn-delete-view-${v.id}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {showSaveView ? (
                  <div className="flex items-center gap-1 px-2">
                    <input
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
                      placeholder="ชื่อ View..."
                      value={newViewName}
                      onChange={e => setNewViewName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && newViewName.trim()) {
                          createView.mutate({ name: newViewName.trim(), filters: { personFilter, statusFilter, filterRules: filterRules.filter(r => r.colId && r.value) } });
                        }
                        if (e.key === "Escape") setShowSaveView(false);
                      }}
                      autoFocus
                      data-testid="input-view-name"
                    />
                    <button
                      onClick={() => { if (newViewName.trim()) createView.mutate({ name: newViewName.trim(), filters: { personFilter, statusFilter, filterRules: filterRules.filter(r => r.colId && r.value) } }); }}
                      disabled={!newViewName.trim()}
                      className="text-[#579bfc] hover:text-[#4a8de8] text-sm font-medium disabled:opacity-40"
                      data-testid="btn-save-view"
                    >
                      บันทึก
                    </button>
                    <button onClick={() => setShowSaveView(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
                  </div>
                ) : (
                  <button
                    className="px-3 py-2.5 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowSaveView(true)}
                    title="บันทึก View ปัจจุบัน"
                    data-testid="btn-add-view"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                {hiddenTabs.size > 0 && (
                  <button
                    className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-[#579bfc] hover:bg-[#579bfc]/5 rounded transition-colors flex items-center gap-1"
                    onClick={() => setHiddenTabs(new Set())}
                    title="แสดงแท็บที่ซ่อนไว้"
                    data-testid="btn-restore-tabs"
                  >
                    <Eye className="w-3 h-3" />
                    แสดงแท็บที่ซ่อน ({hiddenTabs.size})
                  </button>
                )}
                <div className="flex items-center gap-1.5 ml-auto">
                  <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                  <select
                    className="text-xs border rounded px-1.5 py-1 text-gray-600 bg-white"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(Number(e.target.value))}
                    data-testid="filter-month-tab"
                  >
                    <option value={0}>ทั้งหมด</option>
                    {MONTHS_TH.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select
                    className="text-xs border rounded px-1.5 py-1 text-gray-600 bg-white"
                    value={filterYear}
                    onChange={(e) => setFilterYear(Number(e.target.value))}
                    data-testid="filter-year-tab"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const y = (new Date().getFullYear() + 543) - 2 + i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
              </div>
            </div>

            {activeTab === "dashboard" ? (
              <BoardDashboardTab
                boardId={selectedBoardId!}
                items={items}
                columns={columns}
                groups={groups}
                employees={employees}
                boardName={currentBoard?.name || ""}
                filterMonth={filterMonth}
                filterYear={filterYear}
                isExternal={isExternalUser}
              />
            ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-6 py-2.5 border-b bg-white shrink-0">
              <div className="inline-flex">
                <Button
                  size="sm"
                  className="bg-[#579bfc] hover:bg-[#4a8de8] text-white h-8 rounded-l-md rounded-r-none pl-3 pr-2 text-sm font-medium"
                  onClick={() => {
                    const g = groups[0];
                    if (g) {
                      setNewItemNames(prev => ({ ...prev, [g.id]: "" }));
                      setTimeout(() => {
                        const input = document.querySelector(`[data-testid="input-new-item-${g.id}"]`) as HTMLInputElement;
                        if (input) input.focus();
                      }, 100);
                    }
                  }}
                  data-testid="btn-new-item"
                >
                  New item
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="inline-flex items-center justify-center h-8 px-1.5 rounded-l-none rounded-r-md text-white"
                      style={{ backgroundColor: "#579bfc", borderLeft: "1px solid rgba(255,255,255,0.3)" }}
                      data-testid="btn-new-item-dropdown"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem onClick={() => createGroup.mutate("New group of items")}>
                      <ListCollapse className="w-4 h-4 mr-2" /> New group of items
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (!groups.length) {
                        toast({ title: "กรุณาสร้างกลุ่มก่อน", variant: "destructive" });
                        return;
                      }
                      setImportTargetGroup(groups[0]?.id || "");
                      setImportOpen(true);
                    }}>
                      <Upload className="w-4 h-4 mr-2" /> Import Excel
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        const g = groups[0];
                        if (!g) {
                          toast({ title: "กรุณาสร้างกลุ่มก่อน", description: "กดปุ่ม Group by เพื่อสร้างกลุ่มแรก", variant: "destructive" });
                          return;
                        }
                        importCompanies.mutate(g.id);
                      }}
                      disabled={importCompanies.isPending}
                    >
                      <Building2 className="w-4 h-4 mr-2" />
                      {importCompanies.isPending ? "กำลังดึงข้อมูล..." : "ดึงข้อมูลจากบริษัท"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => syncAssignments.mutate()}
                      disabled={syncAssignments.isPending}
                      data-testid="btn-sync-assignments"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${syncAssignments.isPending ? "animate-spin" : ""}`} />
                      {syncAssignments.isPending ? "กำลัง Sync..." : "Sync ผู้รับผิดชอบ → มอบหมายงาน"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="w-px h-5 bg-gray-200 mx-1" />

              {showSearchBar ? (
                <div className="flex items-center gap-1.5 bg-gray-50 border rounded-lg px-2.5 py-1">
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  <input
                    className="bg-transparent border-none outline-none text-sm w-40 placeholder:text-gray-400"
                    placeholder="ค้นหารายการ..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    autoFocus
                    data-testid="input-toolbar-search"
                  />
                  <button onClick={() => { setSearchQuery(""); setShowSearchBar(false); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                  onClick={() => setShowSearchBar(true)}
                  data-testid="btn-toolbar-search"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>
              )}
              <div className="relative">
                <button
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded ${personFilter ? "bg-[#579bfc]/10 text-[#579bfc] font-medium" : "text-gray-600 hover:bg-gray-100"}`}
                  onClick={() => { setShowPersonPicker(!showPersonPicker); setShowFilterPanel(false); setShowSortPanel(false); setShowHidePanel(false); }}
                  data-testid="btn-toolbar-person"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Person</span>
                  {personFilter && <X className="w-3 h-3 ml-0.5" onClick={e => { e.stopPropagation(); setPersonFilter(""); }} />}
                </button>
                {showPersonPicker && (
                  <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPersonPicker(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 w-56 py-1 max-h-64 overflow-y-auto" data-testid="person-picker">
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-gray-500"
                      onClick={() => { setPersonFilter(""); setShowPersonPicker(false); }}
                    >
                      ทั้งหมด
                    </button>
                    {employees.map((emp: any) => (
                      <button
                        key={emp.id}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${String(personFilter) === String(emp.id) ? "bg-[#579bfc]/10 text-[#579bfc]" : "text-gray-700"}`}
                        onClick={() => { setPersonFilter(String(emp.id)); setShowPersonPicker(false); }}
                      >
                        {emp.fullName || `${emp.firstName} ${emp.lastName}`}
                      </button>
                    ))}
                  </div>
                  </>
                )}
              </div>
              <div className="relative">
                <button
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded ${filterRules.length > 0 ? "bg-[#579bfc]/10 text-[#579bfc] font-medium" : "text-gray-600 hover:bg-gray-100"}`}
                  onClick={() => { setShowFilterPanel(!showFilterPanel); setShowPersonPicker(false); setShowSortPanel(false); setShowHidePanel(false); }}
                  data-testid="btn-toolbar-filter"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter</span>
                  {filterRules.length > 0 && (
                    <X className="w-3 h-3 ml-0.5" onClick={e => { e.stopPropagation(); setFilterRules([]); setFilterColId(null); setFilterValue(""); }} />
                  )}
                </button>
                {showFilterPanel && (
                  <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilterPanel(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded-xl shadow-xl z-50 w-[580px] p-4" data-testid="filter-panel">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">Advanced filters</span>
                        <span className="text-xs text-gray-400">
                          Showing {filteredItems.length} of {items.length} items
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {filterRules.length > 0 && (
                          <button
                            className="text-xs text-gray-400 hover:text-gray-600"
                            onClick={() => { setFilterRules([]); setFilterColId(null); setFilterValue(""); }}
                          >
                            Clear all
                          </button>
                        )}
                        <button
                          className="text-xs text-gray-400 hover:text-[#579bfc] disabled:opacity-30 disabled:hover:text-gray-400"
                          disabled={filterRules.filter(r => r.colId && r.value).length === 0 && !personFilter && !statusFilter}
                          onClick={() => { setShowSaveView(true); setShowFilterPanel(false); }}
                          data-testid="btn-save-view-from-filter"
                        >
                          Save as new view
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      {filterRules.map((rule, idx) => {
                        const col = columns.find((c: any) => c.id === rule.colId);
                        const isStatus = col?.columnType === "status";
                        const isPerson = col?.columnType === "person";
                        const rawOpts = isStatus && col?.options ? (typeof col.options === "string" ? JSON.parse(col.options) : col.options) : [];
                        const definedOpts = Array.isArray(rawOpts) ? rawOpts : (rawOpts?.labels || rawOpts?.options || []);
                        const liveValues = new Set<string>();
                        if (col) {
                          items.forEach((it: any) => {
                            const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
                            const v = cv[String(col.id)];
                            if (v !== undefined && v !== null && v !== "") liveValues.add(String(v));
                          });
                        }
                        const definedLabels = new Set(definedOpts.map((o: any) => o.label || String(o)));
                        const extraValues = [...liveValues].filter(v => !definedLabels.has(v)).sort();
                        const statusOpts = [...definedOpts, ...extraValues.map(v => ({ label: v, color: "#c4c4c4" }))];
                        const valueUpdater = (val: string) => {
                          const newRules = [...filterRules];
                          newRules[idx] = { ...newRules[idx], value: val };
                          setFilterRules(newRules);
                        };
                        return (
                          <div key={idx} className="flex items-center gap-2" data-testid={`filter-rule-${idx}`}>
                            <span className="text-xs text-gray-400 w-12 text-right shrink-0">{idx === 0 ? "Where" : "And"}</span>
                            <select
                              className="border rounded px-2 py-1.5 text-sm bg-white min-w-[140px]"
                              value={rule.colId || ""}
                              onChange={e => {
                                const newRules = [...filterRules];
                                newRules[idx] = { ...newRules[idx], colId: e.target.value ? Number(e.target.value) : null, value: "" };
                                setFilterRules(newRules);
                              }}
                            >
                              <option value="">Column</option>
                              {columns.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <select
                              className="border rounded px-2 py-1.5 text-sm bg-white min-w-[120px]"
                              value={rule.condition}
                              onChange={e => {
                                const newRules = [...filterRules];
                                newRules[idx] = { ...newRules[idx], condition: e.target.value };
                                setFilterRules(newRules);
                              }}
                            >
                              <option value="contains">contains</option>
                              <option value="not_contains">does not contain</option>
                              <option value="is">is</option>
                              <option value="is_not">is not</option>
                              <option value="is_empty">is empty</option>
                              <option value="is_not_empty">is not empty</option>
                            </select>
                            {rule.condition !== "is_empty" && rule.condition !== "is_not_empty" && (
                              isStatus ? (
                                <select
                                  className="border rounded px-2 py-1.5 text-sm bg-white min-w-[140px] flex-1"
                                  value={rule.value}
                                  onChange={e => valueUpdater(e.target.value)}
                                >
                                  <option value="">Value</option>
                                  {statusOpts.map((opt: any) => (
                                    <option key={opt.label} value={opt.label}>{opt.label}</option>
                                  ))}
                                </select>
                              ) : isPerson ? (
                                <select
                                  className="border rounded px-2 py-1.5 text-sm bg-white min-w-[140px] flex-1"
                                  value={rule.value}
                                  onChange={e => valueUpdater(e.target.value)}
                                >
                                  <option value="">Value</option>
                                  {employees.map((emp: any) => (
                                    <option key={emp.id} value={String(emp.id)}>{emp.fullName || `${emp.firstName} ${emp.lastName}`}</option>
                                  ))}
                                </select>
                              ) : liveValues.size > 0 && liveValues.size <= 200 ? (
                                <select
                                  className="border rounded px-2 py-1.5 text-sm bg-white min-w-[140px] flex-1"
                                  value={rule.value}
                                  onChange={e => valueUpdater(e.target.value)}
                                >
                                  <option value="">Value</option>
                                  {[...liveValues].sort((a, b) => a.localeCompare(b, "th")).map(v => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className="border rounded px-2 py-1.5 text-sm flex-1 min-w-[140px] placeholder:text-gray-400"
                                  placeholder="Value"
                                  value={rule.value}
                                  onChange={e => valueUpdater(e.target.value)}
                                />
                              )
                            )}
                            <button
                              className="text-gray-300 hover:text-red-500 shrink-0"
                              onClick={() => setFilterRules(filterRules.filter((_, i) => i !== idx))}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        className="text-sm text-[#579bfc] hover:text-[#4a8de8] font-medium"
                        onClick={() => setFilterRules([...filterRules, { colId: null, condition: "contains", value: "" }])}
                        data-testid="btn-add-filter"
                      >
                        + New filter
                      </button>
                    </div>
                  </div>
                  </>
                )}
              </div>
              <div className="relative">
                <button
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded ${sortConfig ? "bg-[#579bfc]/10 text-[#579bfc] font-medium" : "text-gray-600 hover:bg-gray-100"}`}
                  onClick={() => { setShowSortPanel(!showSortPanel); setShowPersonPicker(false); setShowFilterPanel(false); setShowHidePanel(false); }}
                  data-testid="btn-toolbar-sort"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>Sort</span>
                  {sortConfig && <X className="w-3 h-3 ml-0.5" onClick={e => { e.stopPropagation(); setSortConfig(null); }} />}
                </button>
                {showSortPanel && (
                  <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSortPanel(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 w-64 p-3" data-testid="sort-panel">
                    <div className="text-xs font-medium text-gray-500 mb-2">เรียงตามคอลัมน์</div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {columns.map((c: any) => (
                        <button
                          key={c.id}
                          className={`w-full text-left px-2.5 py-1.5 text-sm rounded flex items-center justify-between ${sortConfig?.colId === c.id ? "bg-[#579bfc]/10 text-[#579bfc] font-medium" : "hover:bg-gray-100 text-gray-700"}`}
                          onClick={() => {
                            if (sortConfig?.colId === c.id) {
                              if (sortConfig.dir === "asc") setSortConfig({ colId: c.id, dir: "desc" });
                              else setSortConfig(null);
                            } else {
                              setSortConfig({ colId: c.id, dir: "asc" });
                            }
                            setShowSortPanel(false);
                          }}
                          data-testid={`sort-col-${c.id}`}
                        >
                          <span>{c.name}</span>
                          {sortConfig?.colId === c.id && (
                            <span className="text-xs">{sortConfig.dir === "asc" ? "น้อย→มาก" : "มาก→น้อย"}</span>
                          )}
                        </button>
                      ))}
                    </div>
                    {sortConfig && (
                      <button
                        className="mt-2 text-xs text-red-500 hover:text-red-700"
                        onClick={() => { setSortConfig(null); setShowSortPanel(false); }}
                      >
                        ยกเลิกการเรียง
                      </button>
                    )}
                  </div>
                  </>
                )}
              </div>
              <div className="relative">
                <button
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded ${hiddenCols.size > 0 ? "bg-[#579bfc]/10 text-[#579bfc] font-medium" : "text-gray-600 hover:bg-gray-100"}`}
                  onClick={() => { setShowHidePanel(!showHidePanel); setShowPersonPicker(false); setShowFilterPanel(false); setShowSortPanel(false); }}
                  data-testid="btn-toolbar-hide"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide</span>
                  {hiddenCols.size > 0 && <span className="text-xs ml-0.5">({hiddenCols.size})</span>}
                </button>
                {showHidePanel && (
                  <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowHidePanel(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 w-64 p-3" data-testid="hide-panel">
                    <div className="text-xs font-medium text-gray-500 mb-2">ซ่อน/แสดงคอลัมน์</div>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {columns.map((c: any) => (
                        <label key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-gray-100 rounded cursor-pointer" data-testid={`hide-toggle-${c.id}`}>
                          <input
                            type="checkbox"
                            checked={!hiddenCols.has(c.id)}
                            onChange={() => {
                              setHiddenCols(prev => {
                                const next = new Set(prev);
                                if (next.has(c.id)) next.delete(c.id);
                                else next.add(c.id);
                                return next;
                              });
                            }}
                            className="rounded border-gray-300 text-[#579bfc] focus:ring-[#579bfc]"
                          />
                          <span className={hiddenCols.has(c.id) ? "text-gray-400 line-through" : "text-gray-700"}>{c.name}</span>
                        </label>
                      ))}
                    </div>
                    {hiddenCols.size > 0 && (
                      <button
                        className="mt-2 text-xs text-[#579bfc] hover:text-[#4a8de8]"
                        onClick={() => setHiddenCols(new Set())}
                      >
                        แสดงทั้งหมด
                      </button>
                    )}
                  </div>
                  </>
                )}
              </div>
              {(personFilter || statusFilter) && !activeView && (
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-[#579bfc] hover:bg-[#579bfc]/10 rounded font-medium"
                  onClick={() => setShowSaveView(true)}
                  data-testid="btn-save-current-filter"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>บันทึก View</span>
                </button>
              )}
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                onClick={() => createGroup.mutate()}
                data-testid="btn-add-group"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Group by</span>
              </button>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded ml-auto"
                onClick={() => setAddColumnOpen(true)}
                data-testid="btn-add-column"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Column</span>
              </button>
            </div>

            {/* Board Table */}
            <div
              ref={boardScrollRef}
              className={`flex-1 overflow-auto bg-[#f6f7fb] relative ${selectedItemIds.size > 0 ? "pb-20" : ""}`}
              onScroll={e => {
                const el = e.currentTarget;
                setShowScrollTop(el.scrollTop > 300);
              }}
            >
              {groups.length === 0 && (
                <div className="flex items-center justify-center py-20 text-gray-400">
                  <div className="text-center">
                    <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">ยังไม่มีกลุ่ม คลิก "Group by" หรือ "New item" เพื่อเริ่มต้น</p>
                  </div>
                </div>
              )}

              {groups.map((group: any, gIdx: number) => {
                const groupItems = filteredItems.filter((it: any) => it.groupId === group.id);
                const isCollapsed = collapsedGroups.has(group.id);
                const gColor = group.color || GROUP_COLORS[gIdx % GROUP_COLORS.length];

                const tableW = Math.max(700, 33 + (colWidths[-1] || 280) + columns.filter((c: any) => !hiddenCols.has(c.id)).reduce((sum: number, c: any) => sum + (collapsedCols.has(c.id) ? 40 : (colWidths[c.id] || 150)), 0) + 140 + 40) + 48;

                return (
                  <div key={group.id} className="mb-6">
                    <div className="sticky top-0 z-30 bg-[#f6f7fb]" style={{ minWidth: tableW }}>
                      <div className="sticky left-0 w-fit">
                        <div className="flex items-center gap-1 px-6 py-1.5 select-none">
                      <button
                        className="p-0.5 rounded hover:bg-black/5"
                        onClick={() => setCollapsedGroups(prev => {
                          const next = new Set(prev);
                          isCollapsed ? next.delete(group.id) : next.add(group.id);
                          return next;
                        })}
                      >
                        {isCollapsed
                          ? <ChevronRight className="w-4 h-4" style={{ color: gColor }} />
                          : <ChevronDown className="w-4 h-4" style={{ color: gColor }} />
                        }
                      </button>
                      <InlineEdit
                        value={group.name}
                        onSave={name => updateGroup.mutate({ id: group.id, name })}
                        className="font-bold text-lg"
                        style={{ color: gColor }}
                        testId={`inline-edit-group-${group.id}`}
                      />
                      <span className="text-xs text-gray-400 ml-1">{groupItems.length} items</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="ml-2 p-1 rounded hover:bg-black/10" data-testid={`btn-group-menu-${group.id}`}>
                            <MoreHorizontal className="w-4 h-4 text-gray-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuItem onClick={() => {
                            setCollapsedGroups(prev => {
                              const next = new Set(prev);
                              isCollapsed ? next.delete(group.id) : next.add(group.id);
                              return next;
                            });
                          }}>
                            {isCollapsed ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                            {isCollapsed ? "Expand this group" : "Collapse this group"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            if (collapsedGroups.size === groups.length) {
                              setCollapsedGroups(new Set());
                            } else {
                              setCollapsedGroups(new Set(groups.map((g: any) => g.id)));
                            }
                          }}>
                            <LayoutGrid className="w-4 h-4 mr-2" />
                            {collapsedGroups.size === groups.length ? "Expand all groups" : "Collapse all groups"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => createGroup.mutate()}>
                            <Plus className="w-4 h-4 mr-2" /> Add group
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 rounded-sm">
                                <ArrowUpDown className="w-4 h-4" />
                                <span>Move group</span>
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" className="min-w-[160px]">
                              {gIdx > 0 && (
                                <DropdownMenuItem onClick={() => updateGroup.mutate({ id: group.id, position: 0 })}>
                                  <ChevronsUp className="w-4 h-4 mr-2" /> Move to top
                                </DropdownMenuItem>
                              )}
                              {gIdx > 0 && (
                                <DropdownMenuItem onClick={() => updateGroup.mutate({ id: group.id, position: groups[gIdx - 1].position })}>
                                  <ChevronUp className="w-4 h-4 mr-2" /> Move up
                                </DropdownMenuItem>
                              )}
                              {gIdx < groups.length - 1 && (
                                <DropdownMenuItem onClick={() => updateGroup.mutate({ id: group.id, position: groups[gIdx + 1].position })}>
                                  <ChevronDown className="w-4 h-4 mr-2" /> Move down
                                </DropdownMenuItem>
                              )}
                              {gIdx < groups.length - 1 && (
                                <DropdownMenuItem onClick={() => updateGroup.mutate({ id: group.id, position: groups[groups.length - 1].position })}>
                                  <ChevronsDown className="w-4 h-4 mr-2" /> Move to bottom
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <DropdownMenuItem onClick={() => {
                            const el = document.querySelector(`[data-testid="inline-edit-group-${group.id}"]`) as HTMLElement;
                            if (el) el.click();
                          }}>
                            <Pencil className="w-4 h-4 mr-2" /> Rename group
                          </DropdownMenuItem>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 rounded-sm">
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: gColor }} />
                                <span>Change group color</span>
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" className="p-2">
                              <div className="grid grid-cols-5 gap-1.5">
                                {GROUP_COLORS.map(c => (
                                  <div
                                    key={c}
                                    className="w-6 h-6 rounded cursor-pointer hover:scale-110 transition-all"
                                    style={{ backgroundColor: c, outline: group.color === c ? "2px solid #333" : "none", outlineOffset: "1px" }}
                                    onClick={() => updateGroup.mutate({ id: group.id, color: c })}
                                  />
                                ))}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-500" onClick={() => { if (confirm("ลบกลุ่มนี้?")) deleteGroup.mutate(group.id); }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> ลบกลุ่ม
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                        </div>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="mx-6">
                        <div className="bg-white rounded-t-lg shadow-sm">
                            <table className="table-fixed" style={{ width: Math.max(700, 33 + (colWidths[-1] || 280) + columns.filter((c: any) => !hiddenCols.has(c.id)).reduce((sum: number, c: any) => sum + (collapsedCols.has(c.id) ? 40 : (colWidths[c.id] || 150)), 0) + 140 + 40), borderCollapse: "separate", borderSpacing: 0 }}>
                              <colgroup>
                                <col style={{ width: 3 }} />
                                <col style={{ width: 30 }} />
                                <col style={{ width: colWidths[-1] || 280 }} />
                                {columns.filter((c: any) => !hiddenCols.has(c.id)).map((col: any) => (
                                  <col key={col.id} style={{ width: collapsedCols.has(col.id) ? 40 : (colWidths[col.id] || 150) }} />
                                ))}
                                <col style={{ width: 140 }} />
                                <col style={{ width: 40 }} />
                              </colgroup>
                              <thead>
                                <tr>
                                  <th className="w-[3px] min-w-[3px] max-w-[3px] p-0 sticky top-[36px] left-0 z-30" style={{ backgroundColor: gColor, boxShadow: "0 1px 0 #e5e7eb" }} />
                                  <th className="w-[30px] min-w-[30px] max-w-[30px] px-1 py-2 bg-white border-b border-r border-gray-200 sticky top-[36px] left-[3px] z-30" style={{ boxShadow: "0 1px 0 #e5e7eb, 1px 0 0 #e5e7eb" }}>
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-[#0073ea]"
                                      checked={groupItems.length > 0 && groupItems.every((it: any) => selectedItemIds.has(it.id))}
                                      onChange={() => {
                                        const allGroupIds = groupItems.map((it: any) => it.id);
                                        const allSelected = allGroupIds.every((id: number) => selectedItemIds.has(id));
                                        setSelectedItemIds(prev => {
                                          const next = new Set(prev);
                                          if (allSelected) {
                                            allGroupIds.forEach((id: number) => next.delete(id));
                                          } else {
                                            allGroupIds.forEach((id: number) => next.add(id));
                                          }
                                          return next;
                                        });
                                      }}
                                      data-testid={`checkbox-group-all-${group.id}`}
                                    />
                                  </th>
                                  <th
                                    className="text-left px-4 py-2 text-xs font-medium text-gray-500 bg-white border-b border-r border-gray-200 relative sticky top-[36px] left-[33px] z-30"
                                    style={{ width: colWidths[-1] || 280, minWidth: 180, boxShadow: "0 1px 0 #e5e7eb, 1px 0 0 #e5e7eb" }}
                                  >
                                    Item
                                    <div
                                      className="absolute top-0 -right-[3px] w-[7px] h-full cursor-col-resize z-40"
                                      style={{ cursor: "col-resize" }}
                                      onMouseDown={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const th = (e.target as HTMLElement).closest("th")!;
                                        resizingRef.current = { colId: -1, startX: e.clientX, startW: th.offsetWidth };
                                        document.body.style.cursor = "col-resize";
                                        document.body.style.userSelect = "none";
                                      }}
                                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#579bfc")}
                                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                                    />
                                  </th>
                                  {columns.filter((col: any) => !hiddenCols.has(col.id)).map((col: any) => {
                                    const isColDragOver = dragOverColId === col.id && dragColId !== col.id;
                                    return (
                                    <th
                                      key={col.id}
                                      className={`text-center px-3 py-2 text-xs font-medium text-gray-500 bg-white border-b border-r border-gray-200 relative sticky top-[36px] z-20 transition-all ${isColDragOver ? "!bg-blue-50 !border-l-2 !border-l-[#579bfc]" : ""}`}
                                      style={{ width: collapsedCols.has(col.id) ? 40 : (colWidths[col.id] || 150), minWidth: collapsedCols.has(col.id) ? 40 : 80, cursor: renamingColId === col.id ? "default" : "grab", boxShadow: "0 1px 0 #e5e7eb" }}
                                      draggable={renamingColId !== col.id}
                                      onDragStart={e => handleColumnDragStart(e, col.id)}
                                      onDragEnd={handleColumnDragEnd}
                                      onDragOver={e => handleColumnDragOver(e, col.id)}
                                      onDrop={e => handleColumnDrop(e, col.id)}
                                    >
                                      <div className="flex items-center justify-center gap-1 group/col">
                                        {renamingColId === col.id ? (
                                          <input
                                            autoFocus
                                            className="text-xs font-medium text-center border border-[#579bfc] rounded px-1 py-0.5 outline-none bg-white w-full"
                                            value={renameColValue}
                                            onChange={e => setRenameColValue(e.target.value)}
                                            onClick={e => e.stopPropagation()}
                                            onMouseDown={e => e.stopPropagation()}
                                            onBlur={() => {
                                              if (renameColValue.trim() && renameColValue !== col.name) {
                                                updateColumn.mutate({ id: col.id, name: renameColValue.trim() });
                                              } else {
                                                setRenamingColId(null);
                                              }
                                            }}
                                            onKeyDown={e => {
                                              if (e.key === "Enter") {
                                                if (renameColValue.trim() && renameColValue !== col.name) {
                                                  updateColumn.mutate({ id: col.id, name: renameColValue.trim() });
                                                } else {
                                                  setRenamingColId(null);
                                                }
                                              }
                                              if (e.key === "Escape") setRenamingColId(null);
                                            }}
                                          />
                                        ) : (
                                          <>
                                            <span
                                              className={`cursor-text hover:bg-black/5 rounded px-1 ${collapsedCols.has(col.id) ? "writing-mode-vertical" : ""}`}
                                              onClick={e => { e.stopPropagation(); setRenamingColId(col.id); setRenameColValue(col.name); }}
                                            >
                                              {collapsedCols.has(col.id) ? col.name.charAt(0) + "…" : col.name}
                                            </span>
                                            {sortConfig?.colId === col.id && (
                                              <span className="text-[#579bfc]">{sortConfig.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}</span>
                                            )}
                                          </>
                                        )}
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <button className="opacity-0 group-hover/col:opacity-100 pointer-events-none group-hover/col:pointer-events-auto p-0.5 rounded hover:bg-gray-200" data-no-drag>
                                              <MoreHorizontal className="w-3 h-3" />
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="start" className="w-52">
                                            <DropdownMenuItem onClick={() => {
                                              setSortConfig(prev => prev?.colId === col.id && prev.dir === "asc" ? { colId: col.id, dir: "desc" } : { colId: col.id, dir: "asc" });
                                            }}>
                                              <ChevronsUpDown className="w-3.5 h-3.5 mr-2" /> เรียงลำดับ {sortConfig?.colId === col.id ? (sortConfig.dir === "asc" ? "มาก→น้อย" : "ยกเลิก") : "น้อย→มาก"}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                              if (sortConfig?.colId === col.id) setSortConfig(null);
                                              else setSortConfig({ colId: col.id, dir: "asc" });
                                            }}>
                                              <SortAsc className="w-3.5 h-3.5 mr-2" /> เรียง น้อย → มาก
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                              if (sortConfig?.colId === col.id) setSortConfig(null);
                                              else setSortConfig({ colId: col.id, dir: "desc" });
                                            }}>
                                              <SortDesc className="w-3.5 h-3.5 mr-2" /> เรียง มาก → น้อย
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => {
                                              setCollapsedCols(prev => {
                                                const s = new Set(prev);
                                                if (s.has(col.id)) s.delete(col.id); else s.add(col.id);
                                                return s;
                                              });
                                            }}>
                                              <EyeOff className="w-3.5 h-3.5 mr-2" /> {collapsedCols.has(col.id) ? "ขยายคอลัมน์" : "ย่อคอลัมน์"}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => duplicateColumn.mutate(col)}>
                                              <Copy className="w-3.5 h-3.5 mr-2" /> คัดลอกคอลัมน์
                                            </DropdownMenuItem>
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                <Plus className="w-3.5 h-3.5 mr-2" /> เพิ่มคอลัมน์ถัดไป
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent className="w-48">
                                                {COLUMN_TYPES.map(ct => {
                                                  const Icon = ct.icon;
                                                  return (
                                                    <DropdownMenuItem key={ct.value} onClick={() => createColumn.mutate({ name: ct.label, columnType: ct.value, afterColumnId: col.id })}>
                                                      <div className="w-5 h-5 rounded flex items-center justify-center mr-2" style={{ backgroundColor: ct.color }}>
                                                        <Icon className="w-3 h-3 text-white" />
                                                      </div>
                                                      {ct.label}
                                                    </DropdownMenuItem>
                                                  );
                                                })}
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuSub>
                                              <DropdownMenuSubTrigger>
                                                <Columns className="w-3.5 h-3.5 mr-2" /> เปลี่ยนประเภทคอลัมน์
                                              </DropdownMenuSubTrigger>
                                              <DropdownMenuSubContent className="w-48">
                                                <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">
                                                  เปลี่ยน <b>{col.name}</b> เป็น:
                                                </div>
                                                {COLUMN_TYPES.filter(ct => ct.value !== col.columnType).map(ct => {
                                                  const Icon = ct.icon;
                                                  return (
                                                    <DropdownMenuItem key={ct.value} onClick={() => updateColumn.mutate({ id: col.id, columnType: ct.value })}>
                                                      <div className="w-5 h-5 rounded flex items-center justify-center mr-2" style={{ backgroundColor: ct.color }}>
                                                        <Icon className="w-3 h-3 text-white" />
                                                      </div>
                                                      {ct.label}
                                                    </DropdownMenuItem>
                                                  );
                                                })}
                                              </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            <DropdownMenuItem onClick={() => { setRenamingColId(col.id); setRenameColValue(col.name); }}>
                                              <Pencil className="w-3.5 h-3.5 mr-2" /> เปลี่ยนชื่อ
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {(() => {
                                              const colIdx = columns.findIndex((c: any) => c.id === col.id);
                                              return (
                                                <>
                                                  <DropdownMenuItem
                                                    disabled={colIdx <= 0}
                                                    onClick={() => {
                                                      const ids = columns.map((c: any) => c.id);
                                                      [ids[colIdx - 1], ids[colIdx]] = [ids[colIdx], ids[colIdx - 1]];
                                                      reorderColumns.mutate(ids);
                                                    }}
                                                  >
                                                    <ArrowLeft className="w-3.5 h-3.5 mr-2" /> ย้ายไปซ้าย
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    disabled={colIdx >= columns.length - 1}
                                                    onClick={() => {
                                                      const ids = columns.map((c: any) => c.id);
                                                      [ids[colIdx], ids[colIdx + 1]] = [ids[colIdx + 1], ids[colIdx]];
                                                      reorderColumns.mutate(ids);
                                                    }}
                                                  >
                                                    <ArrowRight className="w-3.5 h-3.5 mr-2" /> ย้ายไปขวา
                                                  </DropdownMenuItem>
                                                </>
                                              );
                                            })()}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-500" onClick={() => deleteColumn.mutate(col.id)}>
                                              <Trash2 className="w-3.5 h-3.5 mr-2" /> ลบคอลัมน์
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                      <div
                                        className="absolute top-0 -right-[3px] w-[7px] h-full cursor-col-resize z-30"
                                        style={{ cursor: "col-resize" }}
                                        onMouseDown={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const th = (e.target as HTMLElement).closest("th")!;
                                          resizingRef.current = { colId: col.id, startX: e.clientX, startW: th.offsetWidth };
                                          document.body.style.cursor = "col-resize";
                                          document.body.style.userSelect = "none";
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#579bfc")}
                                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                                      />
                                    </th>
                                    );
                                  })}
                                  <th className="bg-white border-b border-r border-gray-200 text-center px-3 py-2 text-xs font-medium text-gray-500 min-w-[140px] whitespace-nowrap sticky top-[36px] z-20" style={{ boxShadow: "0 1px 0 #e5e7eb" }}>Last updated</th>
                                  <th className="w-10 bg-white border-b border-gray-200 sticky top-[36px] z-20" style={{ boxShadow: "0 1px 0 #e5e7eb" }}>
                                    <button className="p-1.5 rounded hover:bg-gray-100 mx-auto block" onClick={() => setAddColumnOpen(true)}>
                                      <Plus className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupItems.map((item: any) => {
                                  const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
                                  const isExpanded = expandedItems.has(item.id);
                                  const itemSubitems = subitems.filter((s: any) => s.itemId === item.id);

                                  const itemIndex = groupItems.indexOf(item);
                                  return (
                                    <ItemRow
                                      key={item.id}
                                      item={item}
                                      cv={cv}
                                      columns={columns.filter((c: any) => !hiddenCols.has(c.id))}
                                      employees={employees}
                                      isExpanded={isExpanded}
                                      itemSubitems={itemSubitems}
                                      groupColor={gColor}
                                      updateCount={updateCounts[item.id] || 0}
                                      updaters={updaters}
                                      isDragging={dragItemId === item.id}
                                      isDropTarget={dropTarget?.groupId === group.id && dropTarget?.position === itemIndex}
                                      isSelected={selectedItemIds.has(item.id)}
                                      onToggleSelect={() => {
                                        setSelectedItemIds(prev => {
                                          const next = new Set(prev);
                                          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                          return next;
                                        });
                                      }}
                                      onDragStart={() => setDragItemId(item.id)}
                                      onDragOver={(e: React.DragEvent) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = "move";
                                        if (dragItemId !== null && dragItemId !== item.id) {
                                          setDropTarget({ groupId: group.id, position: itemIndex });
                                        }
                                      }}
                                      onDrop={() => {
                                        if (dragItemId !== null && dragItemId !== item.id) {
                                          reorderItem.mutate({ itemId: dragItemId, targetGroupId: group.id, targetPosition: itemIndex });
                                        }
                                        setDragItemId(null);
                                        setDropTarget(null);
                                      }}
                                      onDragEnd={() => { setDragItemId(null); setDropTarget(null); }}
                                      onOpenItem={() => setOpenItemId(item.id)}
                                      onToggleExpand={() => setExpandedItems(prev => {
                                        const next = new Set(prev);
                                        isExpanded ? next.delete(item.id) : next.add(item.id);
                                        return next;
                                      })}
                                      onCellChange={(colId: number, val: any) => handleCellChange(item, colId, val)}
                                      onDeleteItem={() => { if (confirm("ลบรายการนี้?")) deleteItem.mutate(item.id); }}
                                      onUpdateItemName={(name: string) => updateItem.mutate({ id: item.id, name })}
                                      newSubitemName={newSubitemNames[item.id] || ""}
                                      onSubitemNameChange={(val: string) => setNewSubitemNames(prev => ({ ...prev, [item.id]: val }))}
                                      onCreateSubitem={() => {
                                        const name = newSubitemNames[item.id]?.trim();
                                        if (name) {
                                          createSubitem.mutate({ itemId: item.id, name });
                                          setNewSubitemNames(prev => ({ ...prev, [item.id]: "" }));
                                        }
                                      }}
                                      onSubitemCellChange={(si: any, colId: number, val: any) => handleSubitemCellChange(si, colId, val)}
                                      onDeleteSubitem={(id: number) => { if (confirm("ลบ?")) deleteSubitem.mutate(id); }}
                                      onUpdateSubitemName={(si: any, name: string) => updateSubitem.mutate({ id: si.id, name })}
                                      collapsedCols={collapsedCols}
                                      onUpdateColumnLabels={(colId: number, labels: any[]) => {
                                        updateColumn.mutate({ id: colId, options: JSON.stringify({ labels }) });
                                      }}
                                      subitemColumns={subitemColumns}
                                      onCreateSubitemColumn={(data: any) => createColumn.mutate({ ...data, level: "subitem" })}
                                      onDeleteSubitemColumn={(id: number) => deleteColumn.mutate(id)}
                                    />
                                  );
                                })}
                                <tr className="group/addrow">
                                  <td className="p-0 w-[3px] min-w-[3px] max-w-[3px] sticky left-0 z-10" style={{ backgroundColor: gColor, opacity: 0.4 }} />
                                  <td className="px-1 py-0 w-[30px] min-w-[30px] max-w-[30px] border-b border-r border-gray-200 sticky left-[3px] z-10 bg-white" />
                                  <td className="px-4 py-0 border-b border-gray-200 sticky left-[33px] z-10 bg-white" colSpan={columns.length + 3}>
                                    <Input
                                      placeholder="+ Add item"
                                      value={newItemNames[group.id] || ""}
                                      onChange={e => setNewItemNames(prev => ({ ...prev, [group.id]: e.target.value }))}
                                      onKeyDown={e => {
                                        if (e.key === "Enter") {
                                          const name = newItemNames[group.id]?.trim();
                                          if (name) {
                                            createItem.mutate({ boardId: selectedBoardId, groupId: group.id, name });
                                            setNewItemNames(prev => ({ ...prev, [group.id]: "" }));
                                          }
                                        }
                                      }}
                                      className="h-9 text-sm border-0 shadow-none focus-visible:ring-0 bg-transparent placeholder:text-gray-400"
                                      data-testid={`input-new-item-${group.id}`}
                                    />
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
            )}
          </>
        )}
      </div>

      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>เพิ่มคอลัมน์</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="ชื่อคอลัมน์" value={newColName} onChange={e => setNewColName(e.target.value)} data-testid="input-col-name" />
            <Select value={newColType} onValueChange={setNewColType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLUMN_TYPES.map(ct => {
                  const Icon = ct.icon;
                  return (
                    <SelectItem key={ct.value} value={ct.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ct.color }}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        {ct.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              className="w-full bg-[#579bfc] hover:bg-[#4a8de8]"
              disabled={!newColName.trim()}
              onClick={() => {
                const opts = newColType === "status" ? JSON.stringify({ labels: STATUS_PRESETS }) : undefined;
                createColumn.mutate({ name: newColName.trim(), columnType: newColType, options: opts });
              }}
              data-testid="btn-create-column"
            >
              เพิ่ม
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) { setImportOpen(false); setImportData(null); setImportMapping({}); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>นำเข้าข้อมูลจาก Excel</DialogTitle>
          </DialogHeader>
          {!importData ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">เลือกไฟล์ Excel (.xlsx, .xls) ที่ต้องการนำเข้า คอลัมน์แรกจะถูกใช้เป็นชื่อ Item</p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  id="import-excel-input"
                  data-testid="import-excel-input"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const XLSX = await import("xlsx");
                      const data = await file.arrayBuffer();
                      const wb = XLSX.read(data, { type: "array", cellDates: true });
                      const ws = wb.Sheets[wb.SheetNames[0]];
                      const ref = ws["!ref"];
                      if (!ref) {
                        toast({ title: "ไฟล์ว่างเปล่า", variant: "destructive" });
                        return;
                      }
                      const range = XLSX.utils.decode_range(ref);
                      const totalCols = range.e.c + 1;
                      const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
                      const padded = json.map(row => {
                        const r = Array.isArray(row) ? [...row] : [];
                        while (r.length < totalCols) r.push("");
                        return r;
                      });
                      if (padded.length < 2) {
                        toast({ title: "ไฟล์ว่างเปล่า", description: "ต้องมีอย่างน้อย 1 แถวหัวตาราง + 1 แถวข้อมูล", variant: "destructive" });
                        return;
                      }
                      const headers = (padded[0] || []).map((h: any) => String(h ?? "").trim());
                      const rows = padded.slice(1).filter((row: any[]) => row.some(cell => cell !== null && cell !== undefined && cell !== ""));
                      setImportData({ headers, rows });
                      const autoMap: Record<number, string> = {};
                      autoMap[0] = "__item_name__";
                      headers.forEach((h, i) => {
                        if (i === 0) return;
                        const matchedCol = columns.find((c: any) => c.name.toLowerCase() === h.toLowerCase());
                        if (matchedCol) autoMap[i] = String(matchedCol.id);
                      });
                      setImportMapping(autoMap);
                    } catch (err: any) {
                      toast({ title: "ไม่สามารถอ่านไฟล์ได้", description: err.message, variant: "destructive" });
                    }
                    e.target.value = "";
                  }}
                />
                <label htmlFor="import-excel-input" className="cursor-pointer">
                  <span className="text-sm font-medium text-[#579bfc] hover:underline">เลือกไฟล์</span>
                  <p className="text-xs text-gray-400 mt-1">รองรับ .xlsx, .xls, .csv</p>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium whitespace-nowrap">นำเข้าไปกลุ่ม:</label>
                <select
                  className="border rounded px-2 py-1 text-sm flex-1"
                  value={importTargetGroup}
                  onChange={e => setImportTargetGroup(Number(e.target.value))}
                  data-testid="import-target-group"
                >
                  {groups.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="text-sm text-gray-500">พบ <b>{importData.rows.length}</b> แถวข้อมูล, <b>{importData.headers.length}</b> คอลัมน์</div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-500 border-b">คอลัมน์ Excel</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 border-b">→ คอลัมน์บอร์ด</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500 border-b">ตัวอย่าง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importData.headers.map((h, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className="px-3 py-1.5 font-medium">{h || `Column ${i + 1}`}</td>
                        <td className="px-3 py-1.5">
                          <select
                            className="border rounded px-1.5 py-1 text-xs w-full"
                            value={importMapping[i] || ""}
                            onChange={e => setImportMapping(prev => ({ ...prev, [i]: e.target.value }))}
                            data-testid={`import-mapping-${i}`}
                          >
                            <option value="">— ข้าม —</option>
                            <option value="__item_name__">📌 ชื่อ Item</option>
                            {columns.map((col: any) => (
                              <option key={col.id} value={String(col.id)}>{col.name} ({col.columnType})</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-gray-400 truncate max-w-[150px]">
                          {importData.rows[0]?.[i] !== undefined ? String(importData.rows[0][i]) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setImportData(null); setImportMapping({}); }} data-testid="btn-import-reset">
                  เลือกไฟล์ใหม่
                </Button>
                <Button
                  className="bg-[#579bfc] hover:bg-[#4a8de8]"
                  disabled={importPending || !Object.values(importMapping).includes("__item_name__")}
                  onClick={async () => {
                    if (!importData || !importTargetGroup) return;
                    setImportPending(true);
                    try {
                      const nameColIdx = Object.entries(importMapping).find(([, v]) => v === "__item_name__")?.[0];
                      if (nameColIdx === undefined) {
                        toast({ title: "กรุณาเลือกคอลัมน์ชื่อ Item", variant: "destructive" });
                        setImportPending(false);
                        return;
                      }
                      const XLSX = await import("xlsx");
                      const items: { name: string; cellValues: string }[] = [];
                      for (const row of importData.rows) {
                        const name = String(row[Number(nameColIdx)] || "").trim();
                        if (!name) continue;
                        const cellValues: Record<string, any> = {};
                        for (const [idxStr, target] of Object.entries(importMapping)) {
                          if (target === "__item_name__" || !target) continue;
                          const idx = Number(idxStr);
                          const val = row[idx];
                          if (val !== undefined && val !== null && val !== "") {
                            const col = columns.find((c: any) => String(c.id) === target);
                            if (col?.columnType === "checkbox") {
                              cellValues[target] = val === true || val === 1 || String(val).toLowerCase() === "true" || val === "✓" || val === "✔";
                            } else if (col?.columnType === "number") {
                              cellValues[target] = Number(val) || 0;
                            } else if (col?.columnType === "date") {
                              if (typeof val === "number") {
                                const d = XLSX.SSF.parse_date_code(val);
                                if (d) cellValues[target] = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
                              } else {
                                cellValues[target] = String(val);
                              }
                            } else {
                              cellValues[target] = String(val);
                            }
                          }
                        }
                        items.push({ name, cellValues: JSON.stringify(cellValues) });
                      }
                      const totalRows = importData.rows.length;
                      const skipped = totalRows - items.length;
                      const result = await apiCall("/api/etax-hub/items/batch-create", "POST", {
                        boardId: selectedBoardId,
                        groupId: Number(importTargetGroup),
                        items,
                      });
                      invalidate();
                      toast({ title: `นำเข้า ${result.created} รายการสำเร็จ`, description: skipped > 0 ? `ข้าม ${skipped} แถวที่ไม่มีชื่อ Item` : undefined });
                      setImportOpen(false);
                      setImportData(null);
                      setImportMapping({});
                    } catch (err: any) {
                      toast({ title: "นำเข้าไม่สำเร็จ", description: err.message, variant: "destructive" });
                    } finally {
                      setImportPending(false);
                    }
                  }}
                  data-testid="btn-import-confirm"
                >
                  {importPending ? "กำลังนำเข้า..." : `นำเข้า ${importData.rows.length} รายการ`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {openItemId && (() => {
        const allItems = boardData?.items || [];
        const openItem = allItems.find((i: any) => i.id === openItemId);
        return openItem ? (
          <ItemUpdatePanel
            itemId={openItemId}
            itemName={openItem.name}
            onClose={() => setOpenItemId(null)}
            selectedCompanyId={boardCompanyId || selectedCompanyId}
          />
        ) : null;
      })()}

      {showInviteDialog && currentBoard?.shareToken && (() => {
        const shareUrl = `${window.location.origin}/shared/board/${currentBoard.shareToken}`;
        const loadQr = () => {
          if (qrData) return;
          setQrLoading(true);
          fetch(`/api/etax-hub/boards/${currentBoard.id}/qrcode?companyId=${boardCompanyId}`, { credentials: "include" })
            .then(r => r.json())
            .then(d => { setQrData(d.qrDataUrl); setQrLoading(false); })
            .catch(() => setQrLoading(false));
        };
        const loadShareLinks = () => {
          setShareLinksLoading(true);
          fetch(`/api/etax-hub/boards/${currentBoard.id}/share-links?companyId=${boardCompanyId}`, { credentials: "include" })
            .then(r => r.json())
            .then(d => { setShareLinks(d); setShareLinksLoading(false); })
            .catch(() => setShareLinksLoading(false));
        };
        const createShareLink = async () => {
          if (!newLinkLabel.trim() || newLinkGroupIds.length === 0) return;
          try {
            const r = await fetch(`/api/etax-hub/boards/${currentBoard.id}/share-links`, {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ companyId: boardCompanyId, label: newLinkLabel, allowedGroupIds: newLinkGroupIds }),
            });
            if (r.ok) {
              setNewLinkLabel(""); setNewLinkGroupIds([]);
              loadShareLinks();
            }
          } catch {}
        };
        const deleteShareLink = async (linkId: number) => {
          if (!confirm("ลบลิงก์แชร์นี้?")) return;
          await fetch(`/api/etax-hub/share-links/${linkId}`, { method: "DELETE", credentials: "include" });
          loadShareLinks();
        };
        const toggleLinkActive = async (linkId: number, active: boolean) => {
          await fetch(`/api/etax-hub/share-links/${linkId}`, {
            method: "PATCH", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active }),
          });
          loadShareLinks();
        };
        const boardGroups = (boardData?.groups || []) as any[];
        const sendInvite = async (method: "email" | "line") => {
          setInviteSending(true);
          setInviteResult(null);
          try {
            const body: any = { method, companyId: boardCompanyId };
            if (method === "email") body.email = inviteEmail.trim();
            if (method === "line") body.lineUserId = inviteLineId.trim();
            const r = await fetch(`/api/etax-hub/boards/${currentBoard.id}/invite?companyId=${boardCompanyId}`, {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const d = await r.json();
            setInviteResult({ ok: r.ok, msg: d.message || "สำเร็จ" });
            if (r.ok && method === "email") setInviteEmail("");
            if (r.ok && method === "line") setInviteLineId("");
          } catch { setInviteResult({ ok: false, msg: "เกิดข้อผิดพลาด" }); }
          finally { setInviteSending(false); }
        };
        const closeDialog = () => {
          setShowInviteDialog(false);
          setInviteTab("link");
          setInviteEmail("");
          setInviteLineId("");
          setInviteResult(null);
          setQrData(null);
        };
        return (
          <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center" data-testid="invite-dialog">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl mx-4 w-full overflow-hidden max-h-[90vh] flex flex-col">
              <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#03c9d7]" /> เชิญลูกค้าดูบอร์ด
                </h3>
                <button onClick={closeDialog} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="px-6 flex gap-1 border-b">
                {[
                  { key: "link" as const, icon: Link2, label: "คัดลอกลิงก์" },
                  { key: "group-links" as const, icon: Users, label: "แชร์ตามกรุ๊ป" },
                  { key: "email" as const, icon: Mail, label: "อีเมล" },
                  { key: "line" as const, icon: MessageSquare, label: "LINE" },
                  { key: "qr" as const, icon: QrCode, label: "QR Code" },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => {
                      setInviteTab(t.key); setInviteResult(null);
                      if (t.key === "qr") loadQr();
                      if (t.key === "group-links") loadShareLinks();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      inviteTab === t.key
                        ? "border-[#03c9d7] text-[#03c9d7]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                    data-testid={`tab-invite-${t.key}`}
                  >
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              <div className="px-6 py-5 min-h-[180px] overflow-y-auto flex-1">
                {inviteTab === "link" && (
                  <div>
                    <p className="text-sm text-gray-600 mb-3">ลิงก์นี้สามารถแชร์ให้คนภายนอกเข้ามาดูบอร์ดได้</p>
                    <div className="bg-gray-50 rounded-lg p-3 mb-2 flex items-center gap-2">
                      <input
                        readOnly
                        className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                        value={shareUrl}
                        data-testid="input-invite-link"
                      />
                      <button
                        className="shrink-0 px-3 py-1.5 bg-[#03c9d7] hover:bg-[#03c9d7]/90 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                        data-testid="btn-copy-invite-link"
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }}
                      >
                        {copySuccess ? <><Check className="w-3.5 h-3.5" /> คัดลอกแล้ว!</> : <><ClipboardCopy className="w-3.5 h-3.5" /> คัดลอก</>}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">ลูกค้าสามารถดูบอร์ด ดาวน์โหลดไฟล์ และแชทในรายการได้</p>
                  </div>
                )}

                {inviteTab === "email" && (
                  <div>
                    <p className="text-sm text-gray-600 mb-3">ส่งอีเมลเชิญพร้อมลิงก์บอร์ดไปยังลูกค้า</p>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && inviteEmail.includes("@")) sendInvite("email"); }}
                          placeholder="email@example.com"
                          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#03c9d7]"
                          data-testid="input-board-invite-email"
                        />
                      </div>
                      <button
                        onClick={() => sendInvite("email")}
                        disabled={!inviteEmail.includes("@") || inviteSending}
                        className="px-4 py-2 bg-[#03c9d7] hover:bg-[#03c9d7]/90 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                        data-testid="btn-board-send-email"
                      >
                        {inviteSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        ส่งเชิญ
                      </button>
                    </div>
                    {inviteResult && (
                      <p className={`text-sm ${inviteResult.ok ? "text-green-600" : "text-red-500"}`}>{inviteResult.msg}</p>
                    )}
                  </div>
                )}

                {inviteTab === "line" && (
                  <div>
                    <p className="text-sm text-gray-600 mb-3">ส่งข้อความ LINE เชิญพร้อมลิงก์บอร์ดไปยังลูกค้า</p>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 relative">
                        <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={inviteLineId}
                          onChange={e => setInviteLineId(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && inviteLineId.trim()) sendInvite("line"); }}
                          placeholder="LINE User ID (Uxxxx...)"
                          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#06C755]"
                          data-testid="input-board-invite-line"
                        />
                      </div>
                      <button
                        onClick={() => sendInvite("line")}
                        disabled={!inviteLineId.trim() || inviteSending}
                        className="px-4 py-2 bg-[#06C755] hover:bg-[#06C755]/90 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                        data-testid="btn-board-send-line"
                      >
                        {inviteSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        ส่ง LINE
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">LINE User ID หาได้จากระบบ LINE OA หรือ LINE Bot webhook</p>
                    {inviteResult && (
                      <p className={`text-sm ${inviteResult.ok ? "text-green-600" : "text-red-500"}`}>{inviteResult.msg}</p>
                    )}
                  </div>
                )}

                {inviteTab === "qr" && (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-4">ให้ลูกค้าสแกน QR Code เพื่อเข้าดูบอร์ด</p>
                    {qrLoading && (
                      <div className="py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-[#03c9d7] mx-auto" />
                      </div>
                    )}
                    {qrData && !qrLoading && (
                      <div>
                        <div className="inline-block p-4 bg-white border-2 border-gray-100 rounded-xl shadow-sm mb-3">
                          <img src={qrData} alt="QR Code" className="w-[200px] h-[200px]" data-testid="img-board-qr" />
                        </div>
                        <p className="text-xs text-gray-500 mb-3">{currentBoard.name}</p>
                        <button
                          onClick={() => {
                            const link = document.createElement("a");
                            link.download = `qr-${currentBoard.name}.png`;
                            link.href = qrData!;
                            link.click();
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          data-testid="btn-board-download-qr"
                        >
                          <QrCode className="w-4 h-4" /> ดาวน์โหลด QR Code
                        </button>
                      </div>
                    )}
                    {!qrData && !qrLoading && (
                      <p className="text-sm text-gray-400 py-8">ไม่สามารถสร้าง QR Code ได้</p>
                    )}
                  </div>
                )}

                {inviteTab === "group-links" && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">สร้างลิงก์แยกตามกรุ๊ป — แต่ละลิงก์เห็นเฉพาะกรุ๊ปที่เลือก</p>

                    <div className="bg-gray-50 rounded-lg p-3 space-y-3" data-testid="form-new-share-link">
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">ชื่อลิงก์ (เช่น ชื่อคนที่จะแชร์ให้)</label>
                        <input
                          type="text"
                          value={newLinkLabel}
                          onChange={e => setNewLinkLabel(e.target.value)}
                          placeholder="เช่น นายเอ, ลูกค้า A"
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#03c9d7]"
                          data-testid="input-share-link-label"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1.5 block">เลือกกรุ๊ปที่จะแชร์</label>
                        <div className="flex flex-wrap gap-2">
                          {boardGroups.map((g: any) => (
                            <button
                              key={g.id}
                              onClick={() => setNewLinkGroupIds(prev =>
                                prev.includes(g.id) ? prev.filter(x => x !== g.id) : [...prev, g.id]
                              )}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                newLinkGroupIds.includes(g.id)
                                  ? "text-white border-transparent shadow-sm"
                                  : "text-gray-600 bg-white hover:bg-gray-50"
                              }`}
                              style={newLinkGroupIds.includes(g.id) ? { backgroundColor: g.color || "#539BFF" } : {}}
                              data-testid={`btn-toggle-group-${g.id}`}
                            >
                              {g.name}
                            </button>
                          ))}
                          {boardGroups.length === 0 && (
                            <p className="text-xs text-gray-400">ไม่มีกรุ๊ปในบอร์ดนี้</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={createShareLink}
                        disabled={!newLinkLabel.trim() || newLinkGroupIds.length === 0}
                        className="w-full px-4 py-2 bg-[#03c9d7] hover:bg-[#03c9d7]/90 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
                        data-testid="btn-create-share-link"
                      >
                        <Plus className="w-4 h-4" /> สร้างลิงก์แชร์
                      </button>
                    </div>

                    {shareLinksLoading && (
                      <div className="py-4 text-center">
                        <Loader2 className="w-5 h-5 animate-spin text-[#03c9d7] mx-auto" />
                      </div>
                    )}

                    {!shareLinksLoading && shareLinks.length > 0 && (
                      <div className="space-y-2" data-testid="list-share-links">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ลิงก์ที่สร้างแล้ว</h4>
                        {shareLinks.map((sl: any) => {
                          const slUrl = `${window.location.origin}/shared/board/${sl.token}`;
                          const groupNames = (sl.allowedGroupIds || []).map((gid: number) => {
                            const g = boardGroups.find((bg: any) => bg.id === gid);
                            return g?.name || `#${gid}`;
                          });
                          return (
                            <div key={sl.id} className={`border rounded-lg p-3 ${sl.active ? "bg-white" : "bg-gray-50 opacity-60"}`} data-testid={`share-link-${sl.id}`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-semibold text-gray-800">{sl.label}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => toggleLinkActive(sl.id, !sl.active)}
                                    className="p-1 rounded hover:bg-gray-100 text-gray-400"
                                    title={sl.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                    data-testid={`btn-toggle-active-${sl.id}`}
                                  >
                                    {sl.active ? <ToggleRight className="w-5 h-5 text-[#05b187]" /> : <ToggleLeft className="w-5 h-5 text-gray-300" />}
                                  </button>
                                  <button
                                    onClick={() => deleteShareLink(sl.id)}
                                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                                    data-testid={`btn-delete-link-${sl.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 mb-2">
                                {groupNames.map((gn: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">{gn}</span>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  readOnly
                                  className="flex-1 bg-gray-50 text-xs text-gray-500 rounded px-2 py-1.5 outline-none border"
                                  value={slUrl}
                                />
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(slUrl);
                                    setCopiedLinkId(sl.id);
                                    setTimeout(() => setCopiedLinkId(null), 2000);
                                  }}
                                  className="shrink-0 px-3 py-1.5 bg-[#03c9d7] hover:bg-[#03c9d7]/90 text-white rounded text-xs font-medium flex items-center gap-1"
                                  data-testid={`btn-copy-link-${sl.id}`}
                                >
                                  {copiedLinkId === sl.id ? <><Check className="w-3 h-3" /> คัดลอกแล้ว</> : <><ClipboardCopy className="w-3 h-3" /> คัดลอก</>}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!shareLinksLoading && shareLinks.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-3">ยังไม่มีลิงก์แชร์ตามกรุ๊ป — สร้างลิงก์ด้านบน</p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 pb-5 flex justify-end">
                <button onClick={closeDialog} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" data-testid="btn-close-invite">ปิด</button>
              </div>
            </div>
          </div>
        );
      })()}

      {showMembersDialog && selectedBoardId && (() => {
        const membersData = membersQuery.data as any;
        const members = membersData?.members || [];
        const boardCreatorId = membersData?.createdBy;
        const myRole = (myRoleQuery.data as any)?.role;
        const isOwner = myRole === "owner";
        const existingUserIds = new Set(members.map((m: any) => m.userId));
        const availableUsers = employees.filter((e: any) => !existingUserIds.has(e.userId) && e.userId);
        const roleLabels: Record<string, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" };
        const roleIcons: Record<string, any> = { owner: Crown, editor: ShieldCheck, viewer: Eye };
        const roleColors: Record<string, string> = { owner: "#fb9678", editor: "#05b187", viewer: "#539BFF" };

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => setShowMembersDialog(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()} data-testid="dialog-members">
              <div className="px-6 pt-5 pb-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#fb9678]" />
                  <h2 className="text-lg font-bold text-gray-900">จัดการสิทธิ์บอร์ด</h2>
                </div>
                <button onClick={() => setShowMembersDialog(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>

              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
                  <div className="flex items-center gap-1"><Crown className="w-3 h-3 text-[#fb9678]" /> Owner — จัดการทุกอย่าง + กำหนดสิทธิ์</div>
                  <span>·</span>
                  <div className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-[#05b187]" /> Editor — แก้ไขข้อมูล</div>
                  <span>·</span>
                  <div className="flex items-center gap-1"><Eye className="w-3 h-3 text-[#539BFF]" /> Viewer — ดูอย่างเดียว</div>
                </div>
              </div>

              {isOwner && (
                <div className="px-6 pb-3 border-b">
                  <div className="flex gap-2">
                    <select
                      value={addMemberUserId ?? ""}
                      onChange={e => setAddMemberUserId(e.target.value ? parseInt(e.target.value) : null)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      data-testid="select-add-member"
                    >
                      <option value="">เลือกผู้ใช้...</option>
                      {availableUsers.map((e: any) => (
                        <option key={e.userId || e.id} value={e.userId || e.id}>{e.fullName || e.name}</option>
                      ))}
                    </select>
                    <select
                      value={addMemberRole}
                      onChange={e => setAddMemberRole(e.target.value as any)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28"
                      data-testid="select-add-role"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button
                      onClick={() => addMemberUserId && addMember.mutate({ userId: addMemberUserId, role: addMemberRole })}
                      disabled={!addMemberUserId || addMember.isPending}
                      className="px-4 py-2 bg-[#fb9678] text-white rounded-lg text-sm font-medium hover:bg-[#fb9678]/90 disabled:opacity-50 transition-colors"
                      data-testid="btn-add-member"
                    >
                      เพิ่ม
                    </button>
                  </div>
                </div>
              )}

              <div className="px-6 py-4 max-h-72 overflow-y-auto">
                {members.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีสมาชิก — ทุกคนในบริษัทเข้าถึงได้</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((m: any) => {
                      const RoleIcon = roleIcons[m.role] || Shield;
                      const isCreator = m.userId === boardCreatorId;
                      return (
                        <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50" data-testid={`member-row-${m.userId}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: roleColors[m.role] || "#999" }}>
                              {(m.fullName || m.username || "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                                {m.fullName || m.username}
                                {isCreator && <span className="text-[10px] px-1.5 py-0.5 bg-[#fb9678]/15 text-[#fb9678] rounded font-medium">ผู้สร้าง</span>}
                              </div>
                              <div className="text-xs text-gray-400">{m.email || m.username}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isOwner && !isCreator ? (
                              <>
                                <select
                                  value={m.role}
                                  onChange={e => updateMemberRole.mutate({ memberId: m.id, role: e.target.value })}
                                  className="border border-gray-200 rounded px-2 py-1 text-xs"
                                  data-testid={`select-role-${m.userId}`}
                                >
                                  <option value="owner">Owner</option>
                                  <option value="editor">Editor</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                                <button
                                  onClick={() => confirm("ลบสมาชิกนี้?") && removeMember.mutate(m.id)}
                                  className="text-gray-400 hover:text-red-500 text-sm"
                                  data-testid={`btn-remove-member-${m.userId}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded" style={{ color: roleColors[m.role], backgroundColor: `${roleColors[m.role]}15` }}>
                                <RoleIcon className="w-3 h-3" />
                                {roleLabels[m.role]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="px-6 pb-5 flex justify-end border-t pt-3">
                <button onClick={() => setShowMembersDialog(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" data-testid="btn-close-members">ปิด</button>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedItemIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center" data-testid="board-selection-bar">
          <div className="mb-4 flex items-center gap-1 rounded-lg bg-[#292f4c] px-3 py-2 shadow-2xl relative">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#0073ea] text-white text-sm font-bold mr-2">
              {selectedItemIds.size}
            </div>
            <span className="text-white text-sm font-medium mr-3">Items selected</span>
            <div className="w-px h-7 bg-gray-600 mx-1" />
            <button
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              data-testid="btn-bulk-duplicate"
              onClick={() => {
                toast({ title: "ฟีเจอร์นี้กำลังพัฒนา" });
              }}
            >
              <Copy className="h-4 w-4" />
              <span className="text-[10px]">Duplicate</span>
            </button>
            <button
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              data-testid="btn-bulk-export"
              onClick={() => {
                toast({ title: "ฟีเจอร์นี้กำลังพัฒนา" });
              }}
            >
              <FileDown className="h-4 w-4" />
              <span className="text-[10px]">Export</span>
            </button>
            <button
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              data-testid="btn-bulk-archive"
              onClick={() => {
                toast({ title: "ฟีเจอร์นี้กำลังพัฒนา" });
              }}
            >
              <Archive className="h-4 w-4" />
              <span className="text-[10px]">Archive</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                  data-testid="btn-bulk-move"
                  disabled={bulkMoveItems.isPending || bulkMoveToBoard.isPending}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  <span className="text-[10px]">{(bulkMoveItems.isPending || bulkMoveToBoard.isPending) ? "กำลังย้าย..." : "Move to"}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="center" className="w-56 mb-1 max-h-80 overflow-y-auto">
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b">ย้ายภายในบอร์ดนี้</div>
                {groups.map((g: any, gi: number) => {
                  const gColor = g.color || GROUP_COLORS[gi % GROUP_COLORS.length];
                  return (
                    <DropdownMenuItem
                      key={g.id}
                      className="gap-2 cursor-pointer"
                      data-testid={`btn-move-to-group-${g.id}`}
                      onClick={() => {
                        bulkMoveItems.mutate({ ids: Array.from(selectedItemIds), targetGroupId: g.id });
                      }}
                    >
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: gColor }} />
                      <span className="truncate">{g.name}</span>
                    </DropdownMenuItem>
                  );
                })}
                {boards.filter((b: any) => b.id !== selectedBoardId).length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b">ย้ายไปบอร์ดอื่น</div>
                    {boards.filter((b: any) => b.id !== selectedBoardId).map((b: any) => (
                      <DropdownMenuItem
                        key={`board-${b.id}`}
                        className="gap-2 cursor-pointer"
                        data-testid={`btn-move-to-board-${b.id}`}
                        onClick={() => {
                          bulkMoveToBoard.mutate({ ids: Array.from(selectedItemIds), targetBoardId: b.id });
                        }}
                      >
                        <LayoutGrid className="w-3 h-3 text-[#579bfc] flex-shrink-0" />
                        <span className="truncate">{b.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-red-500/20 text-gray-300 hover:text-red-400 transition-colors"
              data-testid="btn-bulk-delete"
              disabled={bulkDeleteItems.isPending || !!pendingDelete}
              onClick={() => {
                const ids = Array.from(selectedItemIds);
                setSelectedItemIds(new Set());
                let remaining = 5;
                const tick = () => {
                  setPendingDelete(prev => {
                    if (!prev) return null;
                    return { ...prev, countdown: remaining };
                  });
                };
                const countdownInterval = setInterval(() => {
                  remaining--;
                  if (remaining <= 0) {
                    clearInterval(countdownInterval);
                    bulkDeleteItems.mutate(ids);
                    setPendingDelete(null);
                  } else {
                    tick();
                  }
                }, 1000);
                setPendingDelete({ ids, timer: countdownInterval as any, countdown: 5 });
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-[10px]">Delete</span>
            </button>
            <div className="w-px h-7 bg-gray-600 mx-1" />
            <button
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              data-testid="btn-clear-selection"
              onClick={() => setSelectedItemIds(new Set())}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {pendingDelete && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#333] text-white px-5 py-3 rounded-lg shadow-2xl" data-testid="undo-delete-bar">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-400" />
            <span className="text-sm">กำลังจะลบ {pendingDelete.ids.length} รายการ</span>
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-gray-500 flex items-center justify-center text-xs font-bold">
            {pendingDelete.countdown}
          </div>
          <button
            className="px-4 py-1.5 bg-[#579bfc] hover:bg-[#4a8de8] text-white text-sm font-medium rounded transition-colors"
            data-testid="btn-undo-delete"
            onClick={() => {
              clearInterval(pendingDelete.timer);
              setPendingDelete(null);
              toast({ title: "ยกเลิกการลบแล้ว" });
            }}
          >
            Undo
          </button>
        </div>
      )}
      {showUploadLinks && (
        <UploadLinksPanel onClose={() => setShowUploadLinks(false)} />
      )}
      {showScrollTop && (
        <button
          className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-[#579bfc] text-white shadow-lg hover:bg-[#4a8de8] transition-all flex items-center justify-center"
          onClick={() => boardScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          data-testid="btn-scroll-to-top"
          title="เลื่อนขึ้นบนสุด"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </EtaxCenterLayout>
  );
}

function UploadLinksPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFirmClientId, setNewFirmClientId] = useState("");
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const { data: links = [] } = useQuery<any[]>({
    queryKey: ["/api/client-upload-links"],
    queryFn: () => fetch("/api/client-upload-links", { credentials: "include" }).then(r => r.json()),
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/firm-clients"],
    queryFn: () => fetch("/api/firm-clients", { credentials: "include" }).then(r => r.json()),
  });

  const { data: selectedFiles = [] } = useQuery<any[]>({
    queryKey: ["/api/client-upload-links", selectedLinkId, "files"],
    queryFn: () => fetch(`/api/client-upload-links/${selectedLinkId}/files`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedLinkId,
  });

  const createLink = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/client-upload-links", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/client-upload-links"] }); setShowCreate(false); setNewLabel(""); setNewFirmClientId(""); },
  });

  const toggleLink = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/client-upload-links/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ isActive }) });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/client-upload-links"] }),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/client-upload-links/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/client-upload-links"] }); if (selectedLinkId) setSelectedLinkId(null); },
  });

  const markRead = useMutation({
    mutationFn: async (fileId: number) => {
      await fetch(`/api/client-upload-files/${fileId}/read`, { method: "PATCH", credentials: "include" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/client-upload-links", selectedLinkId, "files"] });
      qc.invalidateQueries({ queryKey: ["/api/client-upload-links"] });
    },
  });

  const getUploadUrl = (token: string) => `${window.location.origin}/upload/${token}`;

  const copyLink = (token: string, id: number) => {
    navigator.clipboard.writeText(getUploadUrl(token));
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getClientName = (fcId: number | null) => {
    if (!fcId) return "ไม่ระบุลูกค้า";
    const c = clients.find((c: any) => c.id === fcId);
    return c?.name || `#${fcId}`;
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b bg-white">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-[#fb9678]" />
            <h2 className="text-base font-bold text-gray-800">
              {selectedLinkId ? "ไฟล์ที่ได้รับ" : "ลิงก์อัพโหลด"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {selectedLinkId && (
              <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => setSelectedLinkId(null)} data-testid="back-to-links">
                กลับ
              </button>
            )}
            <button className="p-1.5 hover:bg-gray-100 rounded-lg" onClick={onClose} data-testid="close-upload-panel">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {selectedLinkId ? (
            <div className="space-y-3">
              {selectedFiles.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">ยังไม่มีไฟล์ที่ได้รับ</div>
              ) : (
                selectedFiles.map((f: any) => (
                  <div
                    key={f.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${!f.isRead ? "bg-blue-50/50 border-blue-200" : "bg-white"}`}
                    data-testid={`upload-file-${f.id}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {f.mimeType?.startsWith("image/") ? <Image className="w-4 h-4 text-blue-500" /> :
                       f.mimeType?.includes("pdf") ? <FileText className="w-4 h-4 text-red-500" /> :
                       <FileIcon className="w-4 h-4 text-gray-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <a
                        href={objectPathToUrl(f.objectPath)}
                        target="_blank"
                        rel="noopener"
                        className="text-sm font-medium text-gray-800 hover:text-[#fb9678] truncate block"
                      >
                        {f.fileName}
                      </a>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                        {f.uploaderName && <span>{f.uploaderName}</span>}
                        <span>{f.category}</span>
                        <span>{new Date(f.createdAt).toLocaleDateString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        {f.fileSize && <span>{(f.fileSize / 1024).toFixed(0)} KB</span>}
                      </div>
                      {f.uploaderNote && <p className="text-xs text-gray-500 mt-1">{f.uploaderNote}</p>}
                    </div>
                    {!f.isRead && (
                      <button
                        className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex-shrink-0"
                        onClick={() => markRead.mutate(f.id)}
                        data-testid={`mark-read-${f.id}`}
                      >
                        อ่านแล้ว
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              {!showCreate && (
                <button
                  className="w-full mb-4 py-2.5 border-2 border-dashed border-[#fb9678]/40 text-[#fb9678] rounded-xl text-sm font-medium hover:bg-[#fb9678]/5 transition-colors flex items-center justify-center gap-2"
                  onClick={() => setShowCreate(true)}
                  data-testid="btn-create-link"
                >
                  <Plus className="w-4 h-4" />
                  สร้างลิงก์ใหม่
                </button>
              )}

              {showCreate && (
                <div className="mb-4 p-4 border rounded-xl bg-gray-50 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อลิงก์</label>
                    <input
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="เช่น ส่งเอกสารเดือน มี.ค. 2569"
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      data-testid="input-link-label"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ลูกค้า (ถ้ามี)</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      value={newFirmClientId}
                      onChange={e => setNewFirmClientId(e.target.value)}
                      data-testid="select-link-client"
                    >
                      <option value="">ไม่ระบุ — ใช้ทั่วไป</option>
                      {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700" onClick={() => setShowCreate(false)}>ยกเลิก</button>
                    <button
                      className="px-4 py-1.5 bg-[#fb9678] text-white rounded-lg text-sm font-medium hover:bg-[#e8856a] disabled:opacity-50"
                      disabled={createLink.isPending}
                      onClick={() => createLink.mutate({ label: newLabel || null, firmClientId: newFirmClientId ? Number(newFirmClientId) : null })}
                      data-testid="btn-confirm-create-link"
                    >
                      สร้างลิงก์
                    </button>
                  </div>
                </div>
              )}

              {links.length === 0 && !showCreate ? (
                <div className="text-center py-12">
                  <LinkIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">ยังไม่มีลิงก์อัพโหลด</p>
                  <p className="text-xs text-gray-400 mt-1">สร้างลิงก์แล้วส่งให้ลูกค้าเพื่อรับเอกสาร</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map((link: any) => (
                    <div key={link.id} className="border rounded-xl p-4 hover:border-gray-300 transition-colors" data-testid={`link-card-${link.id}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800 truncate">{link.label || "ลิงก์อัพโหลด"}</span>
                            {link.unreadCount > 0 && (
                              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{link.unreadCount}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{getClientName(link.firmClientId)}</p>
                        </div>
                        <button
                          className="flex-shrink-0"
                          onClick={() => toggleLink.mutate({ id: link.id, isActive: !link.isActive })}
                          title={link.isActive ? "ปิดลิงก์" : "เปิดลิงก์"}
                          data-testid={`toggle-link-${link.id}`}
                        >
                          {link.isActive ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-300" />}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-500 truncate font-mono">
                          {getUploadUrl(link.token)}
                        </div>
                        <button
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            copied === link.id ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                          onClick={() => copyLink(link.token, link.id)}
                          data-testid={`copy-link-${link.id}`}
                        >
                          {copied === link.id ? "คัดลอกแล้ว!" : "คัดลอก"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>{link.fileCount || 0} ไฟล์</span>
                          <span>{link.isActive ? "เปิดใช้งาน" : "ปิดแล้ว"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {link.fileCount > 0 && (
                            <button
                              className="text-xs text-[#579bfc] hover:underline"
                              onClick={() => setSelectedLinkId(link.id)}
                              data-testid={`view-files-${link.id}`}
                            >
                              ดูไฟล์
                            </button>
                          )}
                          <button
                            className="text-xs text-red-400 hover:text-red-600"
                            onClick={() => { if (confirm("ลบลิงก์นี้?")) deleteLink.mutate(link.id); }}
                            data-testid={`delete-link-${link.id}`}
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemUpdatePanel({ itemId, itemName, onClose, selectedCompanyId }: { itemId: number; itemName: string; onClose: () => void; selectedCompanyId: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: updates = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/etax-hub/items", itemId, "updates"],
    queryFn: () => fetch(`/api/etax-hub/items/${itemId}/updates?companyId=${selectedCompanyId}`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { content: string; attachments?: any[] }) => {
      const r = await fetch(`/api/etax-hub/items/${itemId}/updates?companyId=${selectedCompanyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/etax-hub/items", itemId, "updates"] });
      setMsg("");
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/etax-hub/updates/${id}?companyId=${selectedCompanyId}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/etax-hub/items", itemId, "updates"] }),
  });

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const attachments: any[] = [];
      for (const file of Array.from(files)) {
        const urlRes = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        if (!urlRes.ok) throw new Error("Upload URL failed");
        const { uploadURL, objectPath } = await urlRes.json();
        await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        const fileUrl = objectPath.startsWith("/") ? objectPath : `/${objectPath}`;
        attachments.push({ name: file.name, path: objectPath, url: fileUrl, size: file.size, type: file.type });
      }
      sendMutation.mutate({ content: msg.trim(), attachments });
    } catch {
      alert("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const handleSend = () => {
    const text = msg.trim();
    if (!text) return;
    sendMutation.mutate({ content: text });
  };

  const formatTime = (d: string) => {
    const dt = new Date(d);
    const day = dt.getDate().toString().padStart(2, "0");
    const mon = (dt.getMonth() + 1).toString().padStart(2, "0");
    const hr = dt.getHours().toString().padStart(2, "0");
    const min = dt.getMinutes().toString().padStart(2, "0");
    return `${day}/${mon} ${hr}:${min}`;
  };

  const getInitialColor = (id: number) => {
    const colors = ["#579bfc", "#a25ddc", "#00c875", "#fdab3d", "#e2445c", "#0086c0", "#ff642e", "#ff158a"];
    return colors[id % colors.length];
  };

  const isImage = (type?: string) => type?.startsWith("image/");

  const sorted = [...updates].reverse();

  return (
    <div className="fixed top-0 right-0 h-[calc(100%-60px)] w-[420px] bg-white shadow-2xl border-l z-50 flex flex-col rounded-bl-xl" data-testid="item-update-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-800 truncate">{itemName}</h3>
          <p className="text-xs text-gray-400">อัปเดต · แชท</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-200" data-testid="btn-close-updates">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && <div className="text-center text-gray-400 text-xs py-8">กำลังโหลด...</div>}
        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">ยังไม่มีอัปเดต</p>
            <p className="text-xs text-gray-300">เริ่มสนทนาเกี่ยวกับรายการนี้</p>
          </div>
        )}
        {sorted.map((u: any) => {
          const isMe = u.userId === user?.id;
          const atts: any[] = Array.isArray(u.attachments) ? u.attachments : [];
          const displayName = u.userName || u.guestName || "ไม่ทราบ";
          const isGuest = !u.userId && u.guestName;
          const isActivity = u.updateType === "activity";

          if (isActivity) {
            return (
              <div key={u.id} className="flex items-start gap-2 opacity-70" data-testid={`activity-${u.id}`}>
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ArrowUpDown className="w-3 h-3 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] text-gray-500">
                    <span className="font-medium">{displayName}</span>
                    {" · "}{formatTime(u.createdAt)}
                  </span>
                  <p className="text-[11px] text-gray-500 whitespace-pre-wrap">{u.content}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={u.id} className="group/msg" data-testid={`update-${u.id}`}>
              <div className="flex items-start gap-2">
                <div
                  className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${isGuest ? "ring-2 ring-[#03c9d7]/30" : ""}`}
                  style={{ backgroundColor: isGuest ? "#03c9d7" : getInitialColor(u.userId || 0) }}
                >
                  {displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-gray-700">{displayName}</span>
                    {isGuest && <span className="text-[9px] bg-[#03c9d7]/10 text-[#03c9d7] px-1 rounded">ภายนอก</span>}
                    <span className="text-[10px] text-gray-400">{formatTime(u.createdAt)}</span>
                    {(isMe || user?.role === "admin" || user?.role === "super_admin" || user?.role === "manager") && (
                      <button
                        onClick={() => deleteMutation.mutate(u.id)}
                        className="opacity-0 group-hover/msg:opacity-100 text-[10px] text-red-400 hover:text-red-600 transition-opacity flex items-center gap-0.5"
                        data-testid={`btn-delete-update-${u.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        ลบ
                      </button>
                    )}
                  </div>
                  {u.content && <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{u.content}</p>}
                  {atts.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {atts.map((att: any, i: number) => (
                        isImage(att.type) ? (
                          <a key={i} href={att.url} target="_blank" rel="noreferrer" className="block">
                            <img src={att.url} alt={att.name} className="max-w-[240px] max-h-[180px] rounded-lg border object-cover" />
                          </a>
                        ) : (
                          <a key={i} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded border text-xs text-blue-600 hover:bg-gray-100">
                            <FileIcon className="w-3.5 h-3.5" /> {att.name}
                            <Download className="w-3 h-3 ml-auto text-gray-400" />
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t px-3 py-2 bg-gray-50">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="พิมพ์ข้อความ..."
              className="w-full min-h-[38px] max-h-[120px] text-sm border rounded-lg px-3 py-2 pr-16 resize-none focus:outline-none focus:ring-1 focus:ring-[#fb9678] bg-white"
              rows={1}
              data-testid="input-update-message"
            />
            <div className="absolute right-1 bottom-1 flex items-center gap-0.5">
              <button
                onClick={() => { const inp = fileInputRef.current; if (inp) { inp.accept = ""; inp.click(); } }}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                title="แนบไฟล์"
                disabled={uploading}
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={() => { const inp = fileInputRef.current; if (inp) { inp.accept = "image/*"; inp.click(); } }}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                title="ส่งรูปภาพ"
                disabled={uploading}
              >
                <Image className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={!msg.trim() || sendMutation.isPending}
            className="p-2 rounded-lg bg-[#fb9678] hover:bg-[#fb9678]/90 text-white disabled:opacity-40 transition-colors flex-shrink-0"
            data-testid="btn-send-update"
          >
            {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={e => { if (e.target.files?.length) handleFileUpload(e.target.files); e.target.value = ""; }}
        />
      </div>
    </div>
  );
}


function ReportTab({ items, columns, groups, employees, user, boardName, filterMonth, filterYear }: {
  items: any[]; columns: any[]; groups: any[]; employees: any[]; user: any; boardName: string; filterMonth: number; filterYear: number;
}) {
  const [reportNote, setReportNote] = useState("");
  const statusCols = columns.filter((c: any) => c.columnType === "status");
  const personCols = columns.filter((c: any) => c.columnType === "person");

  const myUserId = String(user?.id || "");
  const myEmployee = employees.find((e: any) => String(e.userId) === myUserId);
  const myEmpId = myEmployee ? String(myEmployee.id) : myUserId;

  const myItems = useMemo(() => {
    return items.filter((item: any) => {
      const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
      return personCols.some((col: any) => String(cv[col.id]) === myEmpId || String(cv[col.id]) === myUserId);
    });
  }, [items, personCols, myEmpId, myUserId]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, { items: any[]; color: string }> = {};
    STATUS_PRESETS.forEach(s => { map[s.label] = { items: [], color: s.color }; });
    myItems.forEach((item: any) => {
      const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
      const val = statusCols.length > 0 ? (cv[String(statusCols[0].id)] || "ยังไม่เริ่ม") : "ยังไม่เริ่ม";
      if (map[val]) map[val].items.push(item);
    });
    return map;
  }, [myItems, statusCols]);

  const completedCount = statusBreakdown["เสร็จสิ้น"]?.items.length || 0;
  const progressPct = myItems.length > 0 ? Math.round((completedCount / myItems.length) * 100) : 0;
  const monthLabel = MONTHS_TH[filterMonth - 1] || "";

  return (
    <div className="flex-1 overflow-auto bg-[#f6f7fb] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-6">
          <div className="px-6 py-5 border-b bg-[#f8f9fb]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#579bfc]" />
                  รายงานผลงาน
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {boardName} — {monthLabel} {filterYear}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#fb9678] flex items-center justify-center text-white font-bold text-sm">
                  {(myEmployee?.fullName || user?.fullName || "?").charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-700">{myEmployee?.fullName || user?.fullName || "-"}</div>
                  <div className="text-[11px] text-gray-400">{myEmployee?.position || user?.role || "-"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[#f6f7fb] rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-800" data-testid="report-total">{myItems.length}</div>
                <div className="text-xs text-gray-400 mt-1">รายการทั้งหมด</div>
              </div>
              <div className="bg-[#00c875]/5 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[#00c875]" data-testid="report-completed">{completedCount}</div>
                <div className="text-xs text-gray-400 mt-1">เสร็จสิ้น</div>
              </div>
              <div className="bg-[#579bfc]/5 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[#579bfc]" data-testid="report-progress">{progressPct}%</div>
                <div className="text-xs text-gray-400 mt-1">ความคืบหน้า</div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: progressPct === 100 ? "#00c875" : "#579bfc" }} />
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-600">รายละเอียดตามสถานะ</h3>
              {STATUS_PRESETS.map(s => {
                const statusData = statusBreakdown[s.label];
                if (!statusData || statusData.items.length === 0) return null;
                return (
                  <div key={s.label} className="border rounded-lg overflow-hidden" data-testid={`report-status-${s.label}`}>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-sm font-medium text-gray-700">{s.label}</span>
                      <Badge variant="secondary" className="text-[10px] h-4 ml-auto">{statusData.items.length}</Badge>
                    </div>
                    <div className="divide-y">
                      {statusData.items.map((item: any, i: number) => {
                        const group = groups.find((g: any) => g.id === item.groupId);
                        return (
                          <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                            <div className="w-1.5 h-6 rounded-sm flex-shrink-0" style={{ backgroundColor: group?.color || "#c4c4c4" }} />
                            <span className="text-gray-700 flex-1">{item.name}</span>
                            <span className="text-xs text-gray-400">{group?.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border rounded-lg p-4">
              <label className="text-sm font-semibold text-gray-600 mb-2 block">หมายเหตุ / สิ่งที่ต้องการรายงานเพิ่มเติม</label>
              <textarea
                className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#579bfc]/30 focus:border-[#579bfc]"
                rows={3}
                placeholder="เขียนหมายเหตุเพิ่มเติม..."
                value={reportNote}
                onChange={e => setReportNote(e.target.value)}
                data-testid="report-note"
              />
              <div className="flex justify-end mt-3">
                <Button
                  className="bg-[#579bfc] hover:bg-[#4a8de8] text-white text-sm flex items-center gap-1.5"
                  data-testid="btn-submit-report"
                >
                  <Send className="w-3.5 h-3.5" />
                  ส่งรายงาน
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DONUT_COLORS = ["#00c875", "#579bfc", "#fdab3d", "#e2445c", "#a25ddc", "#ff642e", "#0086c0", "#cab641", "#ff158a", "#66ccff", "#7f5347", "#c4c4c4"];

const CHART_TYPES = [
  { value: "number", label: "ตัวเลข (KPI)", icon: "🔢" },
  { value: "bar", label: "กราฟแท่ง", icon: "📊" },
  { value: "pie", label: "กราฟวงกลม", icon: "🥧" },
  { value: "donut", label: "กราฟโดนัท", icon: "🍩" },
  { value: "progress", label: "แถบความคืบหน้า", icon: "📈" },
];

const CALC_TYPES = [
  { value: "count", label: "นับจำนวน" },
  { value: "count_checked", label: "นับที่ติ๊กแล้ว" },
  { value: "count_unchecked", label: "นับที่ยังไม่ติ๊ก" },
  { value: "percent_checked", label: "% ที่ติ๊กแล้ว" },
  { value: "sum", label: "รวม" },
  { value: "average", label: "เฉลี่ย" },
  { value: "distribution", label: "แจกแจงตามค่า" },
  { value: "person_workload", label: "ภาระงานพนักงาน" },
  { value: "group_count", label: "จำนวนตามกลุ่ม" },
  { value: "group_status", label: "แยกสถานะตามกลุ่ม" },
  { value: "person_status", label: "แยกสถานะตามพนักงาน" },
];

function getEmpDisplayName(emp: any): string {
  return emp?.nickname || emp?.fullName || emp?.name || "";
}

function getEmpChartName(emp: any): string {
  if (!emp) return "";
  return emp.nickname || emp.firstName || emp.fullName || emp.name || "";
}

function findEmployeeByKey(employees: any[], key: string): any {
  return employees.find((e: any) => String(e.id) === key) 
    || employees.find((e: any) => String(e.userId) === key);
}

function calcWidgetData(widget: any, rawItems: any[], columns: any[], groups: any[], employees: any[]) {
  const col = widget.columnId && widget.columnId !== -1 ? columns.find((c: any) => c.id === widget.columnId) : null;
  const calc = widget.calcType;
  const isItemCol = widget.columnId === -1;

  let items = rawItems;
  if (widget.filterValue && widget.columnId) {
    const fColId = String(widget.columnId);
    const fVal = widget.filterValue;
    items = rawItems.filter((it: any) => {
      const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
      return String(cv[fColId] || "") === fVal;
    });
  }

  if (calc === "group_count") {
    return {
      type: "distribution",
      data: groups.map((g: any, gi: number) => ({
        name: g.name, value: items.filter((it: any) => it.groupId === g.id).length,
        fill: g.color || GROUP_COLORS[gi % GROUP_COLORS.length],
      })),
    };
  }

  if (calc === "group_status") {
    const statusCol = col
      || columns.find((c: any) => c.columnType === "status" && /^สถานะ$/i.test(c.name.trim()))
      || columns.find((c: any) => c.columnType === "status" && /สถานะ|status/i.test(c.name))
      || columns.find((c: any) => c.columnType === "dropdown" && /สถานะ|status/i.test(c.name))
      || columns.find((c: any) => c.columnType === "status")
      || columns.find((c: any) => c.columnType === "dropdown");
    if (!statusCol) return { type: "number", value: 0, label: "ไม่พบคอลัมน์สถานะ" };
    const colOpts = statusCol.options ? (typeof statusCol.options === "string" ? JSON.parse(statusCol.options) : statusCol.options) : [];
    const allStatuses = new Set<string>();
    items.forEach((it: any) => {
      const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
      const val = String(cv[String(statusCol.id)] || "");
      if (val) allStatuses.add(val);
    });
    const statusList = Array.from(allStatuses);
    const STATUS_CHART_COLORS = ["#00c875", "#579bfc", "#fdab3d", "#e2445c", "#a25ddc", "#0086c0", "#ff642e", "#9cd326", "#c4c4c4", "#f06595"];
    const statusColors: Record<string, string> = {};
    statusList.forEach((s, i) => {
      const opt = colOpts.find?.((o: any) => o.label === s || o.value === s);
      statusColors[s] = opt?.color || STATUS_CHART_COLORS[i % STATUS_CHART_COLORS.length];
    });
    const stackedData = groups.map((g: any) => {
      const groupItems = items.filter((it: any) => it.groupId === g.id);
      const row: any = { name: g.name, total: groupItems.length };
      statusList.forEach(s => {
        row[s] = groupItems.filter((it: any) => {
          const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
          return String(cv[String(statusCol.id)] || "") === s;
        }).length;
      });
      const noStatus = groupItems.filter((it: any) => {
        const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
        return !cv[String(statusCol.id)];
      }).length;
      if (noStatus > 0) row["ไม่มีสถานะ"] = noStatus;
      return row;
    });
    if (!statusColors["ไม่มีสถานะ"]) statusColors["ไม่มีสถานะ"] = "#c4c4c4";
    const barKeys = [...statusList];
    const tableKeys = [...statusList];
    if (stackedData.some((d: any) => d["ไม่มีสถานะ"] > 0)) tableKeys.push("ไม่มีสถานะ");
    return { type: "stacked_bar", data: stackedData, statusKeys: barKeys, tableKeys, statusColors };
  }

  if (calc === "person_status") {
    const findStatusCol = () =>
      columns.find((c: any) => c.columnType === "status" && /^สถานะ$/i.test(c.name.trim()))
      || columns.find((c: any) => c.columnType === "status" && /สถานะ|status/i.test(c.name))
      || columns.find((c: any) => c.columnType === "dropdown" && /สถานะ|status/i.test(c.name))
      || columns.find((c: any) => c.columnType === "status")
      || columns.find((c: any) => c.columnType === "dropdown");
    const findPersonCol = () => columns.find((c: any) => c.columnType === "person") || columns.find((c: any) => /ผู้รับผิดชอบ|person|assignee|owner/i.test(c.name));
    let personCol: any = null;
    let statusCol: any = null;
    if (col) {
      if (col.columnType === "person") {
        personCol = col;
        statusCol = findStatusCol();
      } else if (col.columnType === "status" || col.columnType === "dropdown") {
        statusCol = col;
        personCol = findPersonCol();
      } else {
        personCol = col;
        statusCol = findStatusCol();
      }
    } else {
      personCol = findPersonCol();
      statusCol = findStatusCol();
    }
    if (!personCol) return { type: "number", value: 0, label: "ไม่พบคอลัมน์ผู้รับผิดชอบ" };
    if (!statusCol) return { type: "number", value: 0, label: "ไม่พบคอลัมน์สถานะ" };
    const colOpts = statusCol.options ? (typeof statusCol.options === "string" ? JSON.parse(statusCol.options) : statusCol.options) : [];
    const isPerson = personCol.columnType === "person";
    const allStatuses = new Set<string>();
    const personItems: Record<string, any[]> = {};
    items.forEach((it: any) => {
      const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
      const empKey = String(cv[String(personCol.id)] || "").trim();
      const statusVal = String(cv[String(statusCol.id)] || "");
      if (statusVal) allStatuses.add(statusVal);
      if (!empKey) {
        if (!personItems["_none"]) personItems["_none"] = [];
        personItems["_none"].push(it);
      } else {
        if (!personItems[empKey]) personItems[empKey] = [];
        personItems[empKey].push(it);
      }
    });
    const statusList = Array.from(allStatuses);
    const STATUS_CHART_COLORS = ["#00c875", "#579bfc", "#fdab3d", "#e2445c", "#a25ddc", "#0086c0", "#ff642e", "#9cd326", "#c4c4c4", "#f06595"];
    const statusColors: Record<string, string> = {};
    statusList.forEach((s, i) => {
      const opt = colOpts.find?.((o: any) => o.label === s || o.value === s);
      statusColors[s] = opt?.color || STATUS_CHART_COLORS[i % STATUS_CHART_COLORS.length];
    });
    const stackedData = Object.entries(personItems)
      .map(([empKey, empItems]) => {
        let name: string;
        if (empKey === "_none") {
          name = "ไม่ระบุ";
        } else if (isPerson) {
          const emp = findEmployeeByKey(employees, empKey);
          name = emp ? getEmpChartName(emp) : `ID:${empKey}`;
        } else {
          name = empKey;
        }
        const row: any = { name, total: empItems.length };
        statusList.forEach(s => {
          row[s] = empItems.filter((it: any) => {
            const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
            return String(cv[String(statusCol.id)] || "") === s;
          }).length;
        });
        const noStatus = empItems.filter((it: any) => {
          const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
          return !cv[String(statusCol.id)];
        }).length;
        if (noStatus > 0) row["ไม่มีสถานะ"] = noStatus;
        return row;
      })
      .sort((a, b) => b.total - a.total);
    if (!statusColors["ไม่มีสถานะ"]) statusColors["ไม่มีสถานะ"] = "#c4c4c4";
    const barKeys = [...statusList];
    const tableKeys = [...statusList];
    if (stackedData.some((d: any) => d["ไม่มีสถานะ"] > 0)) tableKeys.push("ไม่มีสถานะ");
    return { type: "stacked_bar", data: stackedData, statusKeys: barKeys, tableKeys, statusColors };
  }

  if (isItemCol) {
    if (calc === "count") return { type: "number", value: items.length, label: "รายการ" };
    if (calc === "distribution") {
      const data = items.map((item: any, i: number) => ({
        name: item.name || `รายการ ${i + 1}`, value: 1,
        fill: DONUT_COLORS[i % DONUT_COLORS.length],
      }));
      return { type: "distribution", data };
    }
    return { type: "number", value: items.length, label: "รายการ" };
  }

  if (calc === "person_workload") {
    const personCols = columns.filter((c: any) => c.columnType === "person");
    const map: Record<string, { name: string; count: number; fill: string }> = {};
    items.forEach((item: any) => {
      const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
      const targetCols = col ? [col] : personCols;
      targetCols.forEach((pc: any) => {
        const empId = cv[String(pc.id)];
        if (empId) {
          const key = String(empId);
          if (!map[key]) {
            const emp = findEmployeeByKey(employees, key);
            map[key] = { name: getEmpChartName(emp) || `#${key}`, count: 0, fill: PERSON_COLORS_CHART[Object.keys(map).length % PERSON_COLORS_CHART.length] };
          }
          map[key].count++;
        }
      });
    });
    return { type: "bar", data: Object.values(map).sort((a, b) => b.count - a.count) };
  }

  if (calc === "distribution" && col) {
    const counts: Record<string, number> = {};
    const opts = col.options ? (typeof col.options === "string" ? JSON.parse(col.options) : col.options) : null;
    const labels = opts?.labels || STATUS_PRESETS;
    items.forEach((item: any) => {
      const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
      const raw = cv[String(col.id)];
      const val = raw || "(ยังไม่ระบุ)";
      counts[val] = (counts[val] || 0) + 1;
    });
    const data = Object.entries(counts).map(([name, value], i) => {
      const preset = labels.find((l: any) => l.label === name);
      return { name, value, fill: name === "(ยังไม่ระบุ)" ? "#c4c4c4" : (preset?.color || DONUT_COLORS[i % DONUT_COLORS.length]) };
    });
    return { type: "distribution", data };
  }

  if (!col) return { type: "number", value: items.length, label: "รายการ" };

  const values = items.map((item: any) => {
    const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
    return cv[String(col.id)];
  });

  if (calc === "count") return { type: "number", value: values.filter(v => v != null && v !== "" && v !== false).length, label: "รายการ" };
  if (calc === "count_checked") return { type: "number", value: values.filter(v => v === true || v === "na").length, label: `/ ${items.length}` };
  if (calc === "count_unchecked") return { type: "number", value: values.filter(v => v !== true && v !== "na").length, label: `/ ${items.length}` };
  if (calc === "percent_checked") {
    const checked = values.filter(v => v === true || v === "na").length;
    const pct = items.length > 0 ? Math.round((checked / items.length) * 100) : 0;
    return { type: "percent", value: pct, checked, total: items.length };
  }
  if (calc === "sum") return { type: "number", value: values.reduce((s, v) => s + (parseFloat(v) || 0), 0), label: "" };
  if (calc === "average") {
    const nums = values.filter(v => v != null && v !== "").map(v => parseFloat(v) || 0);
    return { type: "number", value: nums.length > 0 ? Math.round(nums.reduce((s, v) => s + v, 0) / nums.length * 100) / 100 : 0, label: "" };
  }
  return { type: "number", value: items.length, label: "รายการ" };
}

function WidgetRenderer({ widget, data, chartType }: { widget: any; data: any; chartType: string }) {
  const effectiveChart = chartType;

  if (data.type === "number" || effectiveChart === "number") {
    return (
      <div className="flex flex-col items-center justify-center h-full py-6">
        <div className="text-4xl font-bold text-gray-800">{data.value}</div>
        {data.label && <div className="text-sm text-gray-400 mt-1">{data.label}</div>}
      </div>
    );
  }

  if (data.type === "percent" || effectiveChart === "progress") {
    const pct = data.value ?? 0;
    const color = pct === 100 ? "#00c875" : pct > 0 ? "#579bfc" : "#c4c4c4";
    return (
      <div className="flex flex-col items-center justify-center h-full py-6 px-4">
        <div className="text-4xl font-bold" style={{ color }}>{pct}%</div>
        {data.checked !== undefined && <div className="text-sm text-gray-400 mt-1">{data.checked}/{data.total} รายการ</div>}
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mt-3 max-w-[200px]">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    );
  }

  if (data.type === "stacked_bar" && data.data) {
    const tKeys = data.tableKeys || [...data.statusKeys, ...(data.data.some((d: any) => d["ไม่มีสถานะ"] > 0) ? ["ไม่มีสถานะ"] : [])];
    const allBarKeys = ["total", ...data.statusKeys];
    const barColors: Record<string, string> = { total: "#a0a0a0", ...data.statusColors };
    const barLabels: Record<string, string> = { total: "รายทั้งหมด" };
    data.statusKeys.forEach((k: string) => { barLabels[k] = k; });
    const chartH = Math.min(360, Math.max(200, data.data.length * 50 + 100));
    return (
      <div>
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={data.data} layout="horizontal" margin={{ top: 10, right: 10, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} interval={0} angle={data.data.length > 5 ? -30 : 0} textAnchor={data.data.length > 5 ? "end" : "middle"} height={data.data.length > 5 ? 60 : 30} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#999" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(value: any, name: string) => [value, barLabels[name] || name]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} formatter={(value: string) => barLabels[value] || value} />
            {allBarKeys.map((key: string) => (
              <Bar key={key} dataKey={key} fill={barColors[key] || "#c4c4c4"} radius={[3, 3, 0, 0]} maxBarSize={28}>
                <LabelList dataKey={key} position="top" fontSize={8} fill="#666" formatter={(v: any) => v > 0 ? v : ""} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 border-t pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1 font-medium">กลุ่ม</th>
                {tKeys.map((k: string) => (
                  <th key={k} className="text-center py-1 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: data.statusColors[k] || "#c4c4c4" }} />
                    {k}
                  </th>
                ))}
                <th className="text-center py-1 font-medium">รวม</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((row: any, i: number) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-1.5 font-medium text-gray-700">{row.name}</td>
                  {tKeys.map((k: string) => (
                    <td key={k} className="text-center py-1.5">{row[k] || 0}</td>
                  ))}
                  <td className="text-center py-1.5 font-semibold">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if ((data.type === "bar" || effectiveChart === "bar") && data.data) {
    const barData = data.data;
    const chartH = Math.min(260, Math.max(160, barData.length * 18 + 60));
    return (
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart data={barData} layout="horizontal" margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#666" }} axisLine={false} tickLine={false} interval={0} angle={barData.length > 6 ? -40 : 0} textAnchor={barData.length > 6 ? "end" : "middle"} height={barData.length > 6 ? 60 : 30} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#999" }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(value: any) => [`${value} ราย`, "จำนวน"]} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey={data.type === "bar" ? "count" : "value"} radius={[3, 3, 0, 0]} maxBarSize={32}>
            {barData.map((entry: any, i: number) => (
              <Cell key={i} fill={entry.fill || DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
            <LabelList dataKey={data.type === "bar" ? "count" : "value"} position="top" fontSize={9} fill="#666" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if ((data.type === "distribution" || effectiveChart === "pie" || effectiveChart === "donut") && data.data) {
    const isDonut = effectiveChart === "donut" || effectiveChart !== "pie";
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data.data}
            cx="50%"
            cy="45%"
            innerRadius={isDonut ? 40 : 0}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value, x, y, textAnchor }) => (
              <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={10} fill="#666">
                {name.length > 8 ? name.slice(0, 8) + "…" : name} ({value})
              </text>
            )}
            labelLine={{ strokeWidth: 1 }}
          >
            {data.data.map((entry: any, i: number) => (
              <Cell key={i} fill={entry.fill || DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: any) => [`${value} รายการ`]} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, lineHeight: "16px" }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return <div className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูล</div>;
}

function BoardDashboardTab({ boardId, items, columns, groups, employees, boardName, filterMonth, filterYear, isExternal }: {
  boardId: number; items: any[]; columns: any[]; groups: any[]; employees: any[]; boardName: string; filterMonth: number; filterYear: number; isExternal?: boolean;
}) {
  const { selectedCompanyId, primaryCompanyId } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cid = isExternal ? 0 : (primaryCompanyId || selectedCompanyId);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingWidget, setEditingWidget] = useState<any>(null);
  const [wTitle, setWTitle] = useState("");
  const [wChartType, setWChartType] = useState("number");
  const [wColumnId, setWColumnId] = useState<number | null>(null);
  const [wCalcType, setWCalcType] = useState("count");
  const [wWidth, setWWidth] = useState("half");
  const [wFilterValue, setWFilterValue] = useState("");

  const { data: widgets = [] } = useQuery<any[]>({
    queryKey: ["/api/etax-hub/boards", boardId, "widgets"],
    queryFn: () => fetch(`/api/etax-hub/boards/${boardId}/widgets?companyId=${cid}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!boardId,
  });

  const addWidget = useMutation({
    mutationFn: (data: any) => fetch(`/api/etax-hub/boards/${boardId}/widgets?companyId=${cid}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/etax-hub/boards", boardId, "widgets"] }); setShowAddDialog(false); resetForm(); toast({ title: "เพิ่มบล็อกสำเร็จ" }); },
  });

  const updateWidget = useMutation({
    mutationFn: ({ id, ...data }: any) => fetch(`/api/etax-hub/widgets/${id}?companyId=${cid}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/etax-hub/boards", boardId, "widgets"] }); setEditingWidget(null); resetForm(); toast({ title: "แก้ไขบล็อกสำเร็จ" }); },
  });

  const deleteWidget = useMutation({
    mutationFn: (id: number) => fetch(`/api/etax-hub/widgets/${id}?companyId=${cid}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/etax-hub/boards", boardId, "widgets"] }); toast({ title: "ลบบล็อกสำเร็จ" }); },
  });

  const resetForm = () => { setWTitle(""); setWChartType("number"); setWColumnId(null); setWCalcType("count"); setWWidth("half"); setWFilterValue(""); };

  const openEdit = (w: any) => {
    setEditingWidget(w);
    setWTitle(w.title);
    setWChartType(w.chartType);
    setWColumnId(w.columnId);
    setWCalcType(w.calcType);
    setWWidth(w.width || "half");
    setWFilterValue(w.filterValue || "");
  };

  const handleSave = () => {
    if (!wTitle.trim()) return;
    const payload = { title: wTitle.trim(), chartType: wChartType, columnId: wColumnId, calcType: wCalcType, width: wWidth, filterValue: wFilterValue || null };
    if (editingWidget) {
      updateWidget.mutate({ id: editingWidget.id, ...payload });
    } else {
      addWidget.mutate(payload);
    }
  };

  const getCalcOptions = () => {
    if (wColumnId === -1) return CALC_TYPES.filter(c => ["count", "distribution", "group_count", "group_status", "person_status"].includes(c.value));
    const col = wColumnId ? columns.find((c: any) => c.id === wColumnId) : null;
    if (!col) return CALC_TYPES.filter(c => ["count", "person_workload", "group_count", "group_status", "person_status"].includes(c.value));
    if (col.columnType === "checkbox") return CALC_TYPES.filter(c => ["count_checked", "count_unchecked", "percent_checked", "group_count"].includes(c.value));
    if (col.columnType === "status" || col.columnType === "dropdown") return CALC_TYPES.filter(c => ["distribution", "count", "group_count", "group_status", "person_status"].includes(c.value));
    if (col.columnType === "person") return CALC_TYPES.filter(c => ["person_workload", "count", "group_count", "person_status"].includes(c.value));
    if (col.columnType === "number") return CALC_TYPES.filter(c => ["sum", "average", "count", "group_count"].includes(c.value));
    if (col.columnType === "progress") return CALC_TYPES.filter(c => ["average", "count", "group_count"].includes(c.value));
    return CALC_TYPES.filter(c => ["count", "group_count", "group_status", "person_status"].includes(c.value));
  };

  const widgetDialog = (showAddDialog || editingWidget) && (
    <Dialog open={true} onOpenChange={() => { setShowAddDialog(false); setEditingWidget(null); resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingWidget ? "แก้ไขบล็อก" : "เพิ่มบล็อกใหม่"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">ชื่อบล็อก</label>
            <Input value={wTitle} onChange={e => setWTitle(e.target.value)} placeholder="เช่น ภาระงานพนักงาน" data-testid="widget-title" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">ประเภทกราฟ</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={wChartType} onChange={e => setWChartType(e.target.value)} data-testid="widget-chart-type">
              {CHART_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.icon} {ct.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">คอลัมน์ข้อมูล</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={wColumnId ?? ""} onChange={e => { setWColumnId(e.target.value ? parseInt(e.target.value) : null); setWCalcType("count"); }} data-testid="widget-column">
              <option value="">— ไม่ระบุ (ทั้งบอร์ด) —</option>
              <option value="-1">Item — ชื่อรายการ</option>
              {columns.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({COLUMN_TYPES.find(ct => ct.value === c.columnType)?.label || c.columnType})</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">การคำนวณ</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={wCalcType} onChange={e => setWCalcType(e.target.value)} data-testid="widget-calc">
              {getCalcOptions().map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {wColumnId && wColumnId !== -1 && (() => {
            const selectedCol = columns.find((c: any) => c.id === wColumnId);
            if (!selectedCol) return null;
            const uniqueVals = new Set<string>();
            items.forEach((it: any) => {
              const cv = typeof it.cellValues === "string" ? JSON.parse(it.cellValues || "{}") : (it.cellValues || {});
              const v = cv[String(wColumnId)];
              if (v !== undefined && v !== null && v !== "") uniqueVals.add(String(v));
            });
            if (uniqueVals.size === 0 || uniqueVals.size > 100) return null;
            return (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">กรองตามค่า <span className="text-gray-400 font-normal">(ไม่บังคับ)</span></label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={wFilterValue} onChange={e => setWFilterValue(e.target.value)} data-testid="widget-filter-value">
                  <option value="">— ทั้งหมด (ไม่กรอง) —</option>
                  {[...uniqueVals].sort((a, b) => a.localeCompare(b, "th")).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            );
          })()}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">ขนาด</label>
            <div className="flex gap-2">
              {[{ v: "kpi", l: "การ์ด KPI" }, { v: "half", l: "ครึ่งจอ" }, { v: "full", l: "เต็มจอ" }].map(s => (
                <button key={s.v} className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${wWidth === s.v ? "bg-[#579bfc] text-white border-[#579bfc]" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                  onClick={() => setWWidth(s.v)}>{s.l}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingWidget(null); resetForm(); }}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={!wTitle.trim()} className="bg-[#579bfc] hover:bg-[#4a8de8] text-white" data-testid="widget-save">{editingWidget ? "บันทึก" : "เพิ่ม"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const kpiWidgets = widgets.filter((w: any) => w.width === "kpi");
  const chartWidgets = widgets.filter((w: any) => w.width !== "kpi");

  const KPI_COLORS = ["#579bfc", "#00c875", "#fdab3d", "#a25ddc", "#0086c0", "#e2445c", "#ff642e", "#9cd326"];

  return (
    <div className="flex-1 overflow-auto bg-[#f6f7fb] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#579bfc]" />
            แดชบอร์ด — {boardName}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{MONTHS_TH[filterMonth - 1]} {filterYear} • {widgets.length} บล็อก</p>
        </div>
        {!isExternal && (
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="bg-[#579bfc] hover:bg-[#4a8de8] text-white gap-1.5" data-testid="btn-add-widget">
            <Plus className="w-4 h-4" /> เพิ่มบล็อก
          </Button>
        )}
      </div>

      {(kpiWidgets.length > 0 || !isExternal) && (
        <div className="flex flex-wrap gap-4 mb-6" data-testid="kpi-cards-row">
          {kpiWidgets.map((w: any, i: number) => {
            const data = calcWidgetData(w, items, columns, groups, employees);
            const color = KPI_COLORS[i % KPI_COLORS.length];
            const KPI_ICONS: Record<string, any> = {
              count: Users, count_checked: CheckCircle2, count_unchecked: AlertCircle,
              percent_checked: TrendingUp, sum: Hash, average: BarChart3,
              distribution: Layers, person_workload: User, group_count: LayoutGrid, group_status: LayoutGrid, person_status: Users,
            };
            const IconComp = KPI_ICONS[w.calcType] || BarChart3;
            return (
              <div key={w.id} className="bg-white rounded-xl border shadow-sm p-5 flex items-center justify-between hover:shadow-md transition-shadow min-w-[180px] flex-1 group relative" data-testid={`dashboard-kpi-${w.id}`}>
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 mb-1">{w.title}</p>
                  <p className="text-2xl font-bold" style={{ color }}>
                    {data.type === "number" ? (typeof data.value === "number" ? data.value.toLocaleString() : data.value) : data.data?.length || 0}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ml-3" style={{ backgroundColor: `${color}18` }}>
                  <IconComp className="w-5 h-5" style={{ color }} />
                </div>
                {!isExternal && (
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                    <button onClick={() => openEdit(w)} className="p-1 rounded hover:bg-gray-100" title="แก้ไข"><Pencil className="w-3 h-3 text-gray-400" /></button>
                    <button onClick={() => { if (confirm("ลบการ์ดนี้?")) deleteWidget.mutate(w.id); }} className="p-1 rounded hover:bg-red-50" title="ลบ"><Trash2 className="w-3 h-3 text-red-400" /></button>
                  </div>
                )}
              </div>
            );
          })}
          {!isExternal && (
            <button
              className="bg-white rounded-xl border border-dashed border-gray-300 shadow-sm p-4 flex items-center gap-2 hover:border-[#579bfc] hover:bg-blue-50/30 transition-colors min-w-[140px] cursor-pointer"
              onClick={() => { resetForm(); setWWidth("kpi"); setWChartType("number"); setShowAddDialog(true); }}
              data-testid="btn-add-kpi-card"
            >
              <Plus className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">เพิ่มการ์ด</span>
            </button>
          )}
        </div>
      )}

      {chartWidgets.length === 0 && (
        <div className="bg-white rounded-xl border p-12 text-center">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">ยังไม่มีกราฟในแดชบอร์ด</h3>
          <p className="text-sm text-gray-400 mb-4">กดปุ่ม "เพิ่มบล็อก" เพื่อสร้างกราฟตามต้องการ หรือกด "เพิ่มการ์ด" ด้านบนเพื่อสร้างการ์ด KPI</p>
          {!isExternal && (
            <Button onClick={() => { resetForm(); setShowAddDialog(true); }} variant="outline" className="border-[#579bfc] text-[#579bfc]">
              <Plus className="w-4 h-4 mr-1" /> เพิ่มบล็อกแรก
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartWidgets.map((w: any) => {
          const data = calcWidgetData(w, items, columns, groups, employees);
          const isFullWidth = w.width === "full" || w.calcType === "person_workload";
          return (
            <div key={w.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isFullWidth ? "lg:col-span-2" : ""}`} data-testid={`widget-${w.id}`}>
              <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-700 truncate">{w.title}</h3>
                {!isExternal && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(w)} className="p-1.5 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors" title="แก้ไข" data-testid={`widget-edit-${w.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm("ลบบล็อกนี้?")) deleteWidget.mutate(w.id); }} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="ลบ" data-testid={`widget-delete-${w.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4">
                <WidgetRenderer widget={w} data={data} chartType={w.chartType} />
              </div>
            </div>
          );
        })}
      </div>

      {widgetDialog}
    </div>
  );
}

function BoardOverviewTab({ items, columns, groups, employees, boardName, filterMonth, filterYear }: {
  items: any[]; columns: any[]; groups: any[]; employees: any[]; boardName: string; filterMonth: number; filterYear: number;
}) {
  const statusCols = columns.filter((c: any) => c.columnType === "status");
  const personCols = columns.filter((c: any) => c.columnType === "person");
  const progressCol = columns.find((c: any) => c.columnType === "progress");

  const getItemProgress = (item: any) => {
    if (statusCols.length === 0) return 0;
    const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
    const completed = statusCols.filter((col: any) => {
      const val = cv[String(col.id)] || "";
      return val === "เสร็จสิ้น" || val === "completed";
    }).length;
    return Math.round((completed / statusCols.length) * 100);
  };

  const getItemPerson = (item: any) => {
    if (personCols.length === 0) return null;
    const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
    const empId = cv[String(personCols[0].id)];
    if (!empId) return null;
    const emp = employees.find((e: any) => String(e.id) === String(empId) || String(e.userId) === String(empId));
    return emp ? (emp.fullName || emp.name || `#${empId}`) : null;
  };

  const completedCount = items.filter(it => getItemProgress(it) === 100).length;
  const inProgressCount = items.filter(it => { const p = getItemProgress(it); return p > 0 && p < 100; }).length;
  const notStartedCount = items.filter(it => getItemProgress(it) === 0).length;
  const overallProgress = items.length > 0 ? Math.round(items.reduce((sum, it) => sum + getItemProgress(it), 0) / items.length) : 0;

  const columnSummary = useMemo(() => {
    return statusCols.map((col: any) => {
      const statusMap: Record<string, number> = {};
      items.forEach((item: any) => {
        const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
        const val = cv[String(col.id)] || "(ยังไม่ระบุ)";
        statusMap[val] = (statusMap[val] || 0) + 1;
      });
      const completed = (statusMap["เสร็จสิ้น"] || 0) + (statusMap["completed"] || 0);
      return {
        name: col.name,
        total: items.length,
        completed,
        percent: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
        statusMap,
      };
    });
  }, [statusCols, items]);

  const itemDetails = useMemo(() => {
    return items.map((item: any) => {
      const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
      const progress = getItemProgress(item);
      const person = getItemPerson(item);
      const statuses = statusCols.map((col: any) => ({
        colName: col.name,
        colId: col.id,
        value: cv[String(col.id)] || "(ยังไม่ระบุ)",
      }));
      const group = groups.find((g: any) => g.id === item.groupId);
      return { ...item, progress, person, statuses, groupName: group?.name, groupColor: group?.color };
    }).sort((a: any, b: any) => a.progress - b.progress);
  }, [items, statusCols, groups, employees]);

  const workloadData = useMemo(() => {
    const map: Record<string, { name: string; count: number; fill: string }> = {};
    items.forEach((item: any) => {
      const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
      personCols.forEach((col: any) => {
        const empId = cv[String(col.id)];
        if (empId) {
          const key = String(empId);
          if (!map[key]) {
            const emp = findEmployeeByKey(employees, key);
            map[key] = { name: getEmpChartName(emp) || `#${key}`, count: 0, fill: PERSON_COLORS_CHART[Object.keys(map).length % PERSON_COLORS_CHART.length] };
          }
          map[key].count++;
        }
      });
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [items, personCols, employees]);

  return (
    <div className="flex-1 overflow-auto bg-[#f6f7fb] p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-800">ภาพรวมงานประจำเดือน {MONTHS_TH[filterMonth - 1]} {filterYear}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{boardName}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#579bfc]/10 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-[#579bfc]" />
            </div>
            <span className="text-sm text-gray-500">ลูกค้าทั้งหมด</span>
          </div>
          <div className="text-3xl font-bold text-gray-800" data-testid="overview-total">{items.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#00c875]/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[#00c875]" />
            </div>
            <span className="text-sm text-gray-500">เสร็จทุกขั้นตอน</span>
          </div>
          <div className="text-3xl font-bold text-[#00c875]" data-testid="overview-completed">{completedCount}</div>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#fdab3d]/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#fdab3d]" />
            </div>
            <span className="text-sm text-gray-500">กำลังดำเนินการ</span>
          </div>
          <div className="text-3xl font-bold text-[#fdab3d]" data-testid="overview-inprogress">{inProgressCount}</div>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#e2445c]/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-[#e2445c]" />
            </div>
            <span className="text-sm text-gray-500">ยังไม่เริ่ม</span>
          </div>
          <div className="text-3xl font-bold text-[#e2445c]" data-testid="overview-notstarted">{notStartedCount}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#579bfc]" />
            ความคืบหน้ารวม
          </h3>
          <span className="text-2xl font-bold" style={{ color: overallProgress === 100 ? "#00c875" : "#579bfc" }}>{overallProgress}%</span>
        </div>
        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${overallProgress}%`, backgroundColor: overallProgress === 100 ? "#00c875" : "#579bfc" }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>{completedCount}/{items.length} ลูกค้าเสร็จสมบูรณ์</span>
          <span>{items.length - completedCount} รายการค้าง</span>
        </div>
      </div>

      {statusCols.length > 0 && (
        <div className="bg-white rounded-xl border p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#03c9d7]" />
            สรุปตามขั้นตอน
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {columnSummary.map((cs: any, i: number) => (
              <div key={i} className="border rounded-lg p-4" data-testid={`overview-step-${i}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 truncate">{cs.name}</span>
                  <span className="text-xs font-bold" style={{ color: cs.percent === 100 ? "#00c875" : "#579bfc" }}>{cs.percent}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all" style={{ width: `${cs.percent}%`, backgroundColor: cs.percent === 100 ? "#00c875" : "#579bfc" }} />
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#00c875]" />
                    <span className="text-gray-500">เสร็จ {cs.completed}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#c4c4c4]" />
                    <span className="text-gray-500">ค้าง {cs.total - cs.completed}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {workloadData.length > 0 && (
        <div className="bg-white rounded-xl border p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#579bfc]" />
            ภาระงานพนักงาน (จำนวนลูกค้าที่รับผิดชอบ)
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(200, workloadData.length * 45 + 40)}>
            <BarChart data={workloadData} layout="horizontal" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#666" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#999" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                formatter={(value: any) => [`${value} ราย`, "จำนวนลูกค้า"]}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                {workloadData.map((entry: any, index: number) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {groups.map((group: any, gIdx: number) => {
        const gColor = group.color || GROUP_COLORS[gIdx % GROUP_COLORS.length];
        const groupItems = itemDetails.filter((it: any) => it.groupId === group.id);
        const groupCompleted = groupItems.filter((it: any) => it.progress === 100).length;
        return (
          <div key={group.id} className="mb-6" data-testid={`overview-group-${group.id}`}>
            <div className="flex items-center gap-2 mb-1">
              <ChevronDown className="w-4 h-4" style={{ color: gColor }} />
              <span className="font-bold text-lg" style={{ color: gColor }}>{group.name}</span>
              <span className="text-xs text-gray-400">{groupItems.length} items</span>
              <span className="text-xs text-gray-400 ml-1">({groupCompleted} เสร็จ)</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 3 }} />
                  <col style={{ width: 280 }} />
                  {personCols.length > 0 && <col style={{ width: 150 }} />}
                  <col style={{ width: 100 }} />
                  {statusCols.map((col: any) => (
                    <col key={col.id} style={{ width: 130 }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="w-[3px] min-w-[3px] max-w-[3px] p-0" style={{ backgroundColor: gColor }} />
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 bg-white border-b border-r border-gray-200 sticky left-[3px] z-10">ลูกค้า</th>
                    {personCols.length > 0 && <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 bg-white border-b border-r border-gray-200">ผู้รับผิดชอบ</th>}
                    <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 bg-white border-b border-r border-gray-200">ความคืบหน้า</th>
                    {statusCols.map((col: any) => (
                      <th key={col.id} className="text-center px-3 py-2 text-xs font-medium text-gray-500 bg-white border-b border-r border-gray-200">{col.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupItems.map((item: any, i: number) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group" data-testid={`overview-row-${item.id}`}>
                      <td className="w-[3px] min-w-[3px] max-w-[3px] p-0" style={{ backgroundColor: gColor }} />
                      <td className="px-4 py-1.5 border-b border-r border-gray-100 bg-white sticky left-[3px] z-10">
                        <span className="font-medium text-sm text-gray-800">{item.name}</span>
                      </td>
                      {personCols.length > 0 && (
                        <td className="px-2 py-1.5 border-b border-r border-gray-100 text-center">
                          {item.person ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: PERSON_COLORS_CHART[i % PERSON_COLORS_CHART.length] }}>
                                {item.person.charAt(0)}
                              </span>
                              <span className="text-xs text-gray-600 truncate max-w-[80px]">{item.person}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-1.5 border-b border-r border-gray-100 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${item.progress}%`,
                              backgroundColor: item.progress === 100 ? "#00c875" : item.progress > 0 ? "#579bfc" : "#e5e7eb",
                            }} />
                          </div>
                          <span className={`text-[11px] font-medium ${item.progress === 100 ? "text-[#00c875]" : "text-gray-500"}`}>{item.progress}%</span>
                        </div>
                      </td>
                      {item.statuses.map((s: any) => {
                        const preset = STATUS_PRESETS.find(p => p.label === s.value);
                        const bgColor = preset?.color || "#c4c4c4";
                        return (
                          <td key={s.colId} className="p-0 border-b border-r border-gray-100 text-center h-[38px]">
                            <div className="w-full h-full flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: bgColor }}>
                              {s.value}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {groupItems.length === 0 && (
                    <tr>
                      <td className="w-[3px] p-0" style={{ backgroundColor: gColor }} />
                      <td colSpan={2 + (personCols.length > 0 ? 1 : 0) + statusCols.length} className="text-center py-6 text-gray-400 text-xs border-b">
                        ไม่มีรายการในกลุ่มนี้
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="w-[3px] p-0" style={{ backgroundColor: gColor }} />
                    <td className="px-4 py-1.5 bg-gray-50/50 border-t text-xs text-gray-400 font-medium sticky left-[3px]">{groupItems.length} ลูกค้า</td>
                    {personCols.length > 0 && <td className="bg-gray-50/50 border-t" />}
                    <td className="bg-gray-50/50 border-t text-center">
                      {groupItems.length > 0 && (
                        <span className="text-xs font-bold" style={{ color: Math.round(groupItems.reduce((s: number, it: any) => s + it.progress, 0) / groupItems.length) === 100 ? "#00c875" : "#579bfc" }}>
                          {Math.round(groupItems.reduce((s: number, it: any) => s + it.progress, 0) / groupItems.length)}%
                        </span>
                      )}
                    </td>
                    {statusCols.map((col: any) => {
                      const done = groupItems.filter((it: any) => {
                        const st = it.statuses.find((s: any) => s.colId === col.id);
                        return st?.value === "เสร็จสิ้น" || st?.value === "completed";
                      }).length;
                      return (
                        <td key={col.id} className="bg-gray-50/50 border-t text-center text-xs text-gray-400">
                          {groupItems.length > 0 && <span>{done}/{groupItems.length}</span>}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400 text-sm">
          ยังไม่มีรายการในบอร์ดนี้
        </div>
      )}
    </div>
  );
}

function MonitorDashboard({ items, columns, groups, employees }: { items: any[]; columns: any[]; groups: any[]; employees: any[] }) {
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
  const statusCols = columns.filter((c: any) => c.columnType === "status");
  const personCols = columns.filter((c: any) => c.columnType === "person");

  const getItemProgress = (item: any) => {
    if (statusCols.length === 0) return 0;
    const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
    const completed = statusCols.filter((col: any) => {
      const val = cv[String(col.id)] || "";
      return val === "เสร็จสิ้น" || val === "completed";
    }).length;
    return Math.round((completed / statusCols.length) * 100);
  };

  const statusSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    STATUS_PRESETS.forEach(s => { summary[s.label] = 0; });
    items.forEach((item: any) => {
      const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
      statusCols.forEach((col: any) => {
        const val = cv[String(col.id)] || "";
        if (val && summary[val] !== undefined) summary[val]++;
      });
    });
    return summary;
  }, [items, statusCols]);

  const totalStatusCells = Object.values(statusSummary).reduce((a, b) => a + b, 0);

  const workloadData = useMemo(() => {
    const map: Record<string, { name: string; count: number; fill: string }> = {};
    items.forEach((item: any) => {
      const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
      personCols.forEach((col: any) => {
        const empId = cv[String(col.id)];
        if (empId) {
          const key = String(empId);
          if (!map[key]) {
            const emp = findEmployeeByKey(employees, key);
            map[key] = { name: getEmpChartName(emp) || `#${key}`, count: 0, fill: PERSON_COLORS_CHART[Object.keys(map).length % PERSON_COLORS_CHART.length] };
          }
          map[key].count++;
        }
      });
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [items, personCols, employees]);

  const employeeDetail = useMemo(() => {
    const map: Record<string, { empId: string; name: string; fill: string; items: any[]; statusMap: Record<string, number> }> = {};
    items.forEach((item: any) => {
      const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
      personCols.forEach((col: any) => {
        const empId = cv[String(col.id)];
        if (empId) {
          const key = String(empId);
          if (!map[key]) {
            const emp = findEmployeeByKey(employees, key);
            map[key] = {
              empId: key,
              name: getEmpChartName(emp) || `#${key}`,
              fill: PERSON_COLORS_CHART[Object.keys(map).length % PERSON_COLORS_CHART.length],
              items: [],
              statusMap: {},
            };
            STATUS_PRESETS.forEach(s => { map[key].statusMap[s.label] = 0; });
          }
          map[key].items.push(item);
          const statusVal = statusCols.length > 0 ? (cv[String(statusCols[0].id)] || "ยังไม่เริ่ม") : "ยังไม่เริ่ม";
          if (map[key].statusMap[statusVal] !== undefined) map[key].statusMap[statusVal]++;
        }
      });
    });
    return Object.values(map).sort((a, b) => b.items.length - a.items.length);
  }, [items, personCols, employees, statusCols]);

  const groupSummary = useMemo(() => {
    return groups.map((g: any, gi: number) => {
      const gItems = items.filter((it: any) => it.groupId === g.id);
      const completedCount = gItems.filter(it => getItemProgress(it) === 100).length;
      return {
        name: g.name,
        color: g.color || GROUP_COLORS[gi % GROUP_COLORS.length],
        total: gItems.length,
        completed: completedCount,
        percent: gItems.length > 0 ? Math.round((completedCount / gItems.length) * 100) : 0,
      };
    });
  }, [groups, items]);

  const overallProgress = items.length > 0
    ? Math.round(items.reduce((sum, it) => sum + getItemProgress(it), 0) / items.length)
    : 0;

  return (
    <div className="flex-1 overflow-auto bg-[#f6f7fb] p-6">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#579bfc]/10 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-[#579bfc]" />
            </div>
            <span className="text-sm text-gray-500">รายการทั้งหมด</span>
          </div>
          <div className="text-3xl font-bold text-gray-800" data-testid="monitor-total">{items.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#00c875]/10 flex items-center justify-center">
              <Check className="w-4 h-4 text-[#00c875]" />
            </div>
            <span className="text-sm text-gray-500">เสร็จสิ้น</span>
          </div>
          <div className="text-3xl font-bold text-[#00c875]" data-testid="monitor-completed">
            {items.filter(it => getItemProgress(it) === 100).length}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#fdab3d]/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#fdab3d]" />
            </div>
            <span className="text-sm text-gray-500">ความคืบหน้ารวม</span>
          </div>
          <div className="text-3xl font-bold text-gray-800" data-testid="monitor-progress">{overallProgress}%</div>
          <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${overallProgress}%`, backgroundColor: overallProgress === 100 ? "#00c875" : "#579bfc" }} />
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#a25ddc]/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#a25ddc]" />
            </div>
            <span className="text-sm text-gray-500">พนักงานที่มอบหมาย</span>
          </div>
          <div className="text-3xl font-bold text-gray-800" data-testid="monitor-assigned">{workloadData.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <CircleDot className="w-4 h-4 text-[#579bfc]" />
            สรุปสถานะงาน
          </h3>
          <div className="space-y-3">
            {STATUS_PRESETS.map(s => {
              const count = statusSummary[s.label] || 0;
              const pct = totalStatusCells > 0 ? Math.round((count / totalStatusCells) * 100) : 0;
              return (
                <div key={s.label} className="flex items-center gap-3" data-testid={`monitor-status-${s.label}`}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm text-gray-600 w-28 flex-shrink-0">{s.label}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color, minWidth: count > 0 ? 20 : 0 }} />
                    {count > 0 && (
                      <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium" style={{ color: pct > 15 ? "white" : s.color }}>
                        {count}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#03c9d7]" />
            ภาระงานพนักงาน (จำนวนรายการที่รับผิดชอบ)
          </h3>
          {workloadData.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีการมอบหมายงาน</div>
          ) : (
            <div className="space-y-3">
              {workloadData.map((wd, i) => {
                const maxCount = Math.max(...workloadData.map(w => w.count), 1);
                const pct = Math.round((wd.count / maxCount) * 100);
                return (
                  <div key={i} className="flex items-center gap-3" data-testid={`monitor-workload-${i}`}>
                    <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: wd.fill }}>
                      {wd.name.charAt(0)}
                    </div>
                    <span className="text-sm text-gray-600 w-24 truncate flex-shrink-0">{wd.name}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: wd.fill, minWidth: 20 }} />
                      <span className="absolute inset-y-0 left-2 flex items-center text-xs font-bold text-white">{wd.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#fdab3d]" />
          ความคืบหน้าตามกลุ่ม
        </h3>
        {groupSummary.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีกลุ่ม</div>
        ) : (
          <div className="space-y-3">
            {groupSummary.map((gs, i) => (
              <div key={i} className="flex items-center gap-3" data-testid={`monitor-group-${i}`}>
                <div className="w-3 h-8 rounded-sm flex-shrink-0" style={{ backgroundColor: gs.color }} />
                <div className="w-40 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-700">{gs.name}</span>
                  <div className="text-[11px] text-gray-400">{gs.completed}/{gs.total} เสร็จ</div>
                </div>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                  <div className="h-full rounded-full transition-all" style={{ width: `${gs.percent}%`, backgroundColor: gs.color, minWidth: gs.completed > 0 ? 20 : 0 }} />
                  {gs.total > 0 && (
                    <span className="absolute inset-y-0 right-2 flex items-center text-xs font-medium text-gray-500">
                      {gs.percent}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border p-5 shadow-sm mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#fb9678]" />
          สรุปรายพนักงาน (คลิกดูรายละเอียด)
        </h3>
        {employeeDetail.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีการมอบหมายงาน</div>
        ) : (
          <div className="space-y-1">
            {employeeDetail.map((ed, i) => {
              const completed = ed.statusMap["เสร็จสิ้น"] || 0;
              const pct = ed.items.length > 0 ? Math.round((completed / ed.items.length) * 100) : 0;
              const isExpanded = expandedEmpId === ed.empId;
              return (
                <div key={ed.empId} data-testid={`monitor-emp-${i}`}>
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${isExpanded ? "bg-[#f0f4ff]" : "hover:bg-gray-50"}`}
                    onClick={() => setExpandedEmpId(isExpanded ? null : ed.empId)}
                  >
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: ed.fill }}>
                      {ed.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{ed.name}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{ed.items.length} งาน</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {STATUS_PRESETS.map(s => {
                          const cnt = ed.statusMap[s.label] || 0;
                          if (cnt === 0) return null;
                          return (
                            <span key={s.label} className="flex items-center gap-0.5 text-[10px]">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                              <span className="text-gray-500">{cnt}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="w-24">
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#00c875" : "#579bfc" }} />
                        </div>
                        <div className="text-[10px] text-gray-400 text-right mt-0.5">{pct}% เสร็จ</div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="ml-11 mr-4 mb-2 mt-1 border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 text-xs">
                            <th className="text-left px-3 py-2 font-medium">รายการ</th>
                            <th className="text-left px-3 py-2 font-medium w-32">กลุ่ม</th>
                            <th className="text-left px-3 py-2 font-medium w-28">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {ed.items.map((item: any, ii: number) => {
                            const cv = typeof item.cellValues === "string" ? JSON.parse(item.cellValues || "{}") : (item.cellValues || {});
                            const statusVal = statusCols.length > 0 ? (cv[String(statusCols[0].id)] || "ยังไม่เริ่ม") : "ยังไม่เริ่ม";
                            const statusColor = STATUS_PRESETS.find(s => s.label === statusVal)?.color || "#c4c4c4";
                            const group = groups.find((g: any) => g.id === item.groupId);
                            return (
                              <tr key={ii} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-700">{item.name}</td>
                                <td className="px-3 py-2">
                                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <span className="w-2 h-5 rounded-sm" style={{ backgroundColor: group?.color || "#c4c4c4" }} />
                                    {group?.name || "-"}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded text-xs text-white font-medium" style={{ backgroundColor: statusColor }}>
                                    {statusVal}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BulkDatePicker({ col, isPending, onApply }: { col: any; isPending: boolean; onApply: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [dateVal, setDateVal] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const applyDate = (val: string) => {
    onApply(val);
    setOpen(false);
    setDateVal("");
  };

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
        data-testid={`btn-bulk-col-${col.id}`}
        disabled={isPending}
        onClick={() => { setOpen(!open); setDateVal(""); }}
      >
        <Calendar className="h-4 w-4" />
        <span className="text-[10px] truncate max-w-[60px]">{col.name}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[220px] z-50">
          <div className="text-xs font-medium text-gray-500 mb-2">{col.name}</div>
          <input
            type="date"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#579bfc]"
            value={dateVal}
            onChange={e => setDateVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && dateVal) applyDate(dateVal); }}
            autoFocus
            data-testid={`bulk-date-input-${col.id}`}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              className="flex-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
              onClick={() => applyDate(todayStr)}
            >
              วันนี้
            </button>
            <button
              className="flex-1 px-2 py-1 text-xs bg-[#579bfc] hover:bg-[#4a8de8] rounded text-white font-medium transition-colors"
              onClick={() => { if (dateVal) applyDate(dateVal); }}
              disabled={!dateVal}
            >
              Apply
            </button>
          </div>
          <button
            className="w-full mt-1.5 px-2 py-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            onClick={() => applyDate("")}
          >
            ล้างค่า
          </button>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  if (diffSec < 60) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  if (diffHr < 24) return `${diffHr} ชม.ที่แล้ว`;
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  if (diffWeek < 5) return `${diffWeek} สัปดาห์ที่แล้ว`;
  if (diffMonth < 12) return `${diffMonth} เดือนที่แล้ว`;
  return `${diffYear} ปีที่แล้ว`;
}

const ItemRow = memo(function ItemRow({
  item, cv, columns, employees, isExpanded, itemSubitems, groupColor,
  updateCount = 0, updaters = {},
  isDragging = false, isDropTarget = false,
  isSelected = false, onToggleSelect,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onOpenItem, onToggleExpand, onCellChange, onDeleteItem, onUpdateItemName,
  newSubitemName, onSubitemNameChange, onCreateSubitem,
  onSubitemCellChange, onDeleteSubitem, onUpdateSubitemName,
  collapsedCols = new Set(),
  onUpdateColumnLabels,
  subitemColumns = [],
  onCreateSubitemColumn,
  onDeleteSubitemColumn,
}: any) {
  const [addSubColOpen, setAddSubColOpen] = useState(false);
  const [newSubColName, setNewSubColName] = useState("");
  const [newSubColType, setNewSubColType] = useState("text");
  return (
    <>
      <tr
        className={`group/row hover:bg-[#f5f6f8] transition-colors ${isDragging ? "opacity-30" : ""} ${isDropTarget ? "border-t-2 border-t-[#579bfc]" : ""} ${isSelected ? "bg-[#e8f0fe]" : ""}`}
        data-testid={`item-row-${item.id}`}
        draggable
        onDragStart={e => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
        onDragOver={onDragOver}
        onDrop={e => { e.preventDefault(); onDrop?.(); }}
        onDragEnd={onDragEnd}
        onDragLeave={e => e.stopPropagation()}
      >
        <td className="p-0 w-[3px] min-w-[3px] max-w-[3px] sticky left-0 z-10" style={{ backgroundColor: groupColor }} />
        <td className={`px-1 py-0 w-[30px] min-w-[30px] max-w-[30px] border-b border-r border-gray-200 text-center cursor-grab active:cursor-grabbing sticky left-[3px] z-10 ${isSelected ? "bg-[#e8f0fe]" : "bg-white"} group-hover/row:bg-[#f5f6f8]`} style={{ boxShadow: "1px 0 0 #e5e7eb" }}>
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-[#0073ea]"
            checked={isSelected}
            onChange={e => { e.stopPropagation(); onToggleSelect?.(); }}
            data-testid={`checkbox-item-${item.id}`}
          />
        </td>
        <td className={`px-0 py-0 border-b border-r border-gray-200 sticky left-[33px] z-10 ${isSelected ? "bg-[#e8f0fe]" : "bg-white"} group-hover/row:bg-[#f5f6f8]`} style={{ boxShadow: "1px 0 0 #e5e7eb" }}>
          <div className="flex items-center gap-1 px-2" style={{ minHeight: 37 }}>
            <button onClick={onToggleExpand} className="p-0.5 rounded hover:bg-gray-200 flex-shrink-0" data-testid={`btn-expand-${item.id}`}>
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
            </button>
            <InlineEdit value={item.name} onSave={onUpdateItemName} className="text-sm text-gray-800 flex-1" />
            {itemSubitems.length > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] text-[#676879] bg-[#f0f0f0] rounded-sm px-1.5 py-0.5 flex-shrink-0 cursor-pointer hover:bg-[#e4e4e4] transition-colors"
                title={`${itemSubitems.length} Subitems`}
                onClick={onToggleExpand}
                data-testid={`badge-subitems-${item.id}`}
              >
                <ListCollapse className="w-3 h-3" />
                {itemSubitems.length}
              </span>
            )}
            <button
              onClick={onOpenItem}
              className="relative p-0.5 rounded hover:bg-blue-50 flex-shrink-0"
              title="อัปเดต / แชท"
              data-testid={`btn-updates-${item.id}`}
            >
              <MessageCircle className={`w-3.5 h-3.5 ${updateCount > 0 ? "text-[#03c9d7]" : "text-gray-300"}`} />
              {updateCount > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-[#03c9d7] text-white text-[9px] font-bold px-0.5 leading-none">
                  {updateCount > 99 ? "99+" : updateCount}
                </span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded hover:bg-gray-200 flex-shrink-0">
                  <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem className="text-red-500" onClick={onDeleteItem}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> ลบ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
        {columns.map((col: any) => (
          <td key={col.id} className={`p-0 border-b border-r border-gray-200 ${isSelected ? "bg-[#e8f0fe]" : "bg-white"} group-hover/row:bg-[#f5f6f8]`} style={collapsedCols.has(col.id) ? { width: 40, maxWidth: 40, overflow: "hidden" } : undefined}>
            {collapsedCols.has(col.id) ? null : <CellRenderer col={col} value={cv[String(col.id)]} employees={employees} onChange={v => onCellChange(col.id, v)} onUpdateLabels={col.columnType === "status" ? (labels: any[]) => onUpdateColumnLabels?.(col.id, labels) : undefined} />}
          </td>
        ))}
        <td className={`border-b border-r border-gray-200 px-2 py-1 ${isSelected ? "bg-[#e8f0fe]" : "bg-white"} group-hover/row:bg-[#f5f6f8]`}>
          {item.updatedAt ? (
            <div className="flex items-center gap-1.5 justify-center" title={new Date(item.updatedAt).toLocaleString("th-TH")}>
              {item.updatedBy && updaters[item.updatedBy] ? (
                <div className="w-5 h-5 rounded-full bg-[#03c9d7] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0" title={updaters[item.updatedBy].name}>
                  {updaters[item.updatedBy].name?.charAt(0)?.toUpperCase() || "?"}
                </div>
              ) : null}
              <span className="text-[11px] text-gray-500 whitespace-nowrap">{formatRelativeTime(item.updatedAt)}</span>
            </div>
          ) : (
            <span className="text-[11px] text-gray-300 text-center block">—</span>
          )}
        </td>
        <td className={`border-b border-gray-200 ${isSelected ? "bg-[#e8f0fe]" : "bg-white"} group-hover/row:bg-[#f5f6f8]`} />
      </tr>
      {isExpanded && (
        <tr>
          <td className="p-0" style={{ backgroundColor: groupColor, opacity: 0.3 }} />
          <td colSpan={columns.length + 4} className="bg-[#f5f6f8] p-0 border-b border-gray-200">
            <div className="ml-10 mr-4 my-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] text-gray-400 font-medium">Subitems ({itemSubitems.length})</span>
                <button
                  className="inline-flex items-center gap-1 text-[11px] text-[#579bfc] hover:text-[#4a8de8] px-1.5 py-0.5 rounded hover:bg-blue-50"
                  onClick={() => setAddSubColOpen(true)}
                  data-testid={`btn-add-subcol-${item.id}`}
                >
                  <Plus className="w-3 h-3" /> คอลัมน์
                </button>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="border-collapse" style={{ width: "auto", minWidth: "100%" }}>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-1.5 text-[11px] font-medium text-gray-500 border-b border-gray-200" style={{ minWidth: 180, width: 180 }}>Subitem</th>
                      {subitemColumns.map((col: any) => (
                        <th key={col.id} className="text-center px-2 py-1.5 text-[11px] font-medium text-gray-500 border-b border-gray-200 group/subcol" style={{ minWidth: 100, width: col.width || 100 }}>
                          <div className="flex items-center justify-center gap-1">
                            <span className="truncate">{col.name}</span>
                            <button
                              className="opacity-0 group-hover/subcol:opacity-100 p-0.5 rounded hover:bg-red-50 flex-shrink-0"
                              onClick={() => { if (confirm(`ลบคอลัมน์ "${col.name}"?`)) onDeleteSubitemColumn?.(col.id); }}
                              title="ลบคอลัมน์"
                            >
                              <X className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        </th>
                      ))}
                      <th className="w-8 border-b border-gray-200" />
                    </tr>
                  </thead>
                  <tbody>
                    {itemSubitems.map((si: any) => {
                      const scv = typeof si.cellValues === "string" ? JSON.parse(si.cellValues || "{}") : (si.cellValues || {});
                      return (
                        <tr key={si.id} className="hover:bg-gray-50 group/subrow">
                          <td className="px-3 py-0 border-b border-gray-100" style={{ minWidth: 180, width: 180 }}>
                            <div className="flex items-center" style={{ minHeight: 32 }}>
                              <InlineEdit value={si.name} onSave={name => onUpdateSubitemName(si, name)} className="text-xs text-gray-700" />
                            </div>
                          </td>
                          {subitemColumns.map((col: any) => (
                            <td key={col.id} className="p-0 border-b border-gray-100">
                              <CellRenderer col={col} value={scv[String(col.id)]} employees={employees} onChange={v => onSubitemCellChange(si, col.id, v)} onUpdateLabels={col.columnType === "status" ? (labels: any[]) => onUpdateColumnLabels?.(col.id, labels) : undefined} />
                            </td>
                          ))}
                          <td className="border-b border-gray-100" />
                          <td className="px-1 border-b border-gray-100">
                            <button className="opacity-0 group-hover/subrow:opacity-100 p-0.5 rounded hover:bg-red-50" onClick={() => onDeleteSubitem(si.id)}>
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td className="px-4 py-0" colSpan={subitemColumns.length + 3}>
                        <Input
                          placeholder="+ Add subitem"
                          value={newSubitemName}
                          onChange={e => onSubitemNameChange(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") onCreateSubitem(); }}
                          className="h-8 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent placeholder:text-gray-400"
                          data-testid={`input-new-subitem-${item.id}`}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
              {addSubColOpen && (
                <div className="mt-2 flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-2">
                  <Input
                    placeholder="ชื่อคอลัมน์ย่อย"
                    value={newSubColName}
                    onChange={e => setNewSubColName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newSubColName.trim()) {
                        const opts = newSubColType === "status" ? JSON.stringify({ labels: [{ text: "Done", color: "#00c875" }, { text: "Working", color: "#fdab3d" }, { text: "Stuck", color: "#e2445c" }] }) : undefined;
                        onCreateSubitemColumn?.({ name: newSubColName.trim(), columnType: newSubColType, options: opts });
                        setNewSubColName(""); setNewSubColType("text"); setAddSubColOpen(false);
                      }
                      if (e.key === "Escape") setAddSubColOpen(false);
                    }}
                    className="h-8 text-xs flex-1"
                    autoFocus
                    data-testid={`input-subcol-name-${item.id}`}
                  />
                  <select
                    value={newSubColType}
                    onChange={e => setNewSubColType(e.target.value)}
                    className="h-8 text-xs border rounded px-2 bg-white"
                  >
                    <option value="text">ข้อความ</option>
                    <option value="status">สถานะ</option>
                    <option value="person">บุคคล</option>
                    <option value="date">วันที่</option>
                    <option value="number">ตัวเลข</option>
                  </select>
                  <button
                    className="h-8 px-3 text-xs bg-[#579bfc] text-white rounded hover:bg-[#4a8de8] disabled:opacity-40"
                    disabled={!newSubColName.trim()}
                    onClick={() => {
                      const opts = newSubColType === "status" ? JSON.stringify({ labels: [{ text: "Done", color: "#00c875" }, { text: "Working", color: "#fdab3d" }, { text: "Stuck", color: "#e2445c" }] }) : undefined;
                      onCreateSubitemColumn?.({ name: newSubColName.trim(), columnType: newSubColType, options: opts });
                      setNewSubColName(""); setNewSubColType("text"); setAddSubColOpen(false);
                    }}
                  >
                    เพิ่ม
                  </button>
                  <button className="h-8 px-2 text-xs text-gray-400 hover:text-gray-600" onClick={() => setAddSubColOpen(false)}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
});
