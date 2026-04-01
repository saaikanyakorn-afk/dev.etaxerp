import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Save, Plus, Trash2, Eye, EyeOff, GripVertical, ChevronDown, ChevronUp, Pencil, X, Check, Upload, Image } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const SECTION_LABELS: Record<string, string> = {
  featured_clients: "ลูกค้าที่ไว้วางใจ",
  testimonials: "รีวิวจากลูกค้า",
  video_demos: "วิดีโอสาธิต",
  platforms: "แพลตฟอร์มที่เชื่อมต่อ",
  faq: "คำถามที่พบบ่อย",
};

const SECTION_ITEM_FIELDS: Record<string, { label: string; key: string; type?: string }[]> = {
  featured_clients: [
    { label: "ชื่อ", key: "name" },
    { label: "ประเภท", key: "type" },
    { label: "โลโก้ URL", key: "logo" },
    { label: "สี", key: "color", type: "color" },
  ],
  testimonials: [
    { label: "ชื่อ", key: "name" },
    { label: "ตำแหน่ง", key: "role" },
    { label: "ข้อความ", key: "text", type: "textarea" },
    { label: "ดาว", key: "stars", type: "number" },
    { label: "สี", key: "color", type: "color" },
  ],
  video_demos: [
    { label: "ชื่อ", key: "title" },
    { label: "รายละเอียด", key: "desc", type: "textarea" },
    { label: "หมวดหมู่", key: "category" },
    { label: "ไอคอน", key: "icon" },
    { label: "สี", key: "color", type: "color" },
  ],
  platforms: [
    { label: "ชื่อ", key: "name" },
    { label: "ตัวอักษร", key: "letter" },
    { label: "โลโก้ URL", key: "logo" },
    { label: "สี", key: "color", type: "color" },
  ],
  faq: [
    { label: "คำถาม", key: "q", type: "textarea" },
    { label: "คำตอบ", key: "a", type: "textarea" },
  ],
};

function LogoUploadField({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/landing-content/upload-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("อัปโหลดไม่สำเร็จ");
      const data = await res.json();
      onChange(data.url);
    } catch (err: any) {
      alert(err.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="URL หรืออัปโหลดรูป..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#03c9d7]/30 focus:border-[#03c9d7] outline-none"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#03c9d7]/10 text-[#03c9d7] rounded-lg text-xs font-medium hover:bg-[#03c9d7]/20 transition-colors disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "กำลังอัปโหลด..." : "อัปโหลด"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </div>
      {value && (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
          <img src={value} alt="preview" className="w-10 h-10 object-contain rounded bg-white border border-gray-200" />
          <span className="text-xs text-gray-400 truncate flex-1">{value}</span>
          <button onClick={() => onChange("")} className="text-gray-300 hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function SectionEditor({ section, onSave }: { section: any; onSave: (data: any) => void }) {
  const [title, setTitle] = useState(section.title || "");
  const [subtitle, setSubtitle] = useState(section.subtitle || "");
  const [items, setItems] = useState<any[]>(section.items || []);
  const [active, setActive] = useState(section.active);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  const fields = SECTION_ITEM_FIELDS[section.sectionType] || [];

  const handleItemChange = (idx: number, key: string, value: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [key]: value };
    setItems(newItems);
    setDirty(true);
  };

  const addItem = () => {
    const newItem: any = {};
    fields.forEach((f) => {
      newItem[f.key] = f.type === "number" ? 5 : f.type === "color" ? "#03c9d7" : "";
    });
    setItems([...items, newItem]);
    setEditingIdx(items.length);
    setDirty(true);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
    setEditingIdx(null);
    setDirty(true);
  };

  const moveItem = (idx: number, dir: number) => {
    const newItems = [...items];
    const target = idx + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    setItems(newItems);
    setDirty(true);
  };

  const handleSave = () => {
    onSave({ id: section.id, title, subtitle, items, active });
    setDirty(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid={`section-editor-${section.sectionType}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <span className="font-bold text-gray-800">{SECTION_LABELS[section.sectionType] || section.sectionType}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{items.length} รายการ</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActive(!active); setDirty(true); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
            data-testid={`toggle-active-${section.sectionType}`}
          >
            {active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {active ? "แสดง" : "ซ่อน"}
          </button>
          {dirty && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#03c9d7] text-white hover:bg-[#02b5c2] transition-colors shadow-sm"
              data-testid={`save-section-${section.sectionType}`}
            >
              <Save className="w-3.5 h-3.5" />
              บันทึก
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">หัวข้อ</label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#03c9d7]/30 focus:border-[#03c9d7] outline-none"
              data-testid={`input-title-${section.sectionType}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">คำอธิบาย</label>
            <input
              value={subtitle}
              onChange={(e) => { setSubtitle(e.target.value); setDirty(true); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#03c9d7]/30 focus:border-[#03c9d7] outline-none"
              data-testid={`input-subtitle-${section.sectionType}`}
            />
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className={`border rounded-lg transition-all ${editingIdx === idx ? "border-[#03c9d7] bg-[#03c9d7]/5" : "border-gray-100 bg-white hover:border-gray-200"}`}>
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveItem(idx, -1)} className="p-0.5 text-gray-300 hover:text-gray-500" disabled={idx === 0}>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveItem(idx, 1)} className="p-0.5 text-gray-300 hover:text-gray-500" disabled={idx === items.length - 1}>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                {item.logo ? (
                  <img src={item.logo} alt="" className="w-6 h-6 rounded object-contain flex-shrink-0 bg-gray-50" />
                ) : item.color ? (
                  <div className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: item.color }} />
                ) : null}
                <span className="flex-1 text-sm text-gray-700 truncate font-medium">
                  {item.name || item.title || item.q || `รายการ ${idx + 1}`}
                </span>
                <button
                  onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                  className="p-1.5 text-gray-400 hover:text-[#03c9d7] rounded-md hover:bg-gray-50"
                  data-testid={`edit-item-${section.sectionType}-${idx}`}
                >
                  {editingIdx === idx ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => removeItem(idx)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50"
                  data-testid={`remove-item-${section.sectionType}-${idx}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {editingIdx === idx && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fields.map((field) => (
                    <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                      {field.type === "textarea" ? (
                        <textarea
                          value={item[field.key] || ""}
                          onChange={(e) => handleItemChange(idx, field.key, e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#03c9d7]/30 focus:border-[#03c9d7] outline-none resize-none"
                        />
                      ) : field.type === "color" ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={item[field.key] || "#03c9d7"}
                            onChange={(e) => handleItemChange(idx, field.key, e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0"
                          />
                          <input
                            type="text"
                            value={item[field.key] || ""}
                            onChange={(e) => handleItemChange(idx, field.key, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#03c9d7]/30 focus:border-[#03c9d7] outline-none font-mono"
                          />
                        </div>
                      ) : field.type === "number" ? (
                        <input
                          type="number"
                          value={item[field.key] || 0}
                          onChange={(e) => handleItemChange(idx, field.key, Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#03c9d7]/30 focus:border-[#03c9d7] outline-none"
                          min={1}
                          max={5}
                        />
                      ) : field.key === "logo" ? (
                        <LogoUploadField
                          value={item[field.key] || ""}
                          onChange={(val) => { handleItemChange(idx, field.key, val); }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={item[field.key] || ""}
                          onChange={(e) => handleItemChange(idx, field.key, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#03c9d7]/30 focus:border-[#03c9d7] outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addItem}
          className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-[#03c9d7] hover:text-[#03c9d7] transition-colors w-full justify-center"
          data-testid={`add-item-${section.sectionType}`}
        >
          <Plus className="w-4 h-4" />
          เพิ่มรายการ
        </button>
      </div>
    </div>
  );
}

export default function LandingCmsPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: sections, isLoading } = useQuery<any[]>({
    queryKey: ["/api/landing-content/all"],
    queryFn: async () => {
      const r = await fetch("/api/landing-content/all", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/landing-content/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landing-content/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/landing-content"] });
    },
  });

  const sectionOrder = ["featured_clients", "testimonials", "video_demos", "platforms", "faq"];
  const sortedSections = Array.isArray(sections)
    ? sectionOrder
        .map((type) => sections.find((s: any) => s.sectionType === type))
        .filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="btn-back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">จัดการหน้า Landing Page</h1>
            <p className="text-sm text-gray-400 mt-0.5">แก้ไขเนื้อหา ลูกค้า รีวิว วิดีโอ แพลตฟอร์ม คำถามที่พบบ่อย</p>
          </div>
          <div className="ml-auto">
            <a
              href="/landing"
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              data-testid="btn-preview-landing"
            >
              <Eye className="w-4 h-4" />
              ดูตัวอย่าง Landing
            </a>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-[#03c9d7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {sortedSections.map((section: any) => (
              <SectionEditor
                key={section.id}
                section={section}
                onSave={(data) => updateMutation.mutate(data)}
              />
            ))}
          </div>
        )}

        {updateMutation.isSuccess && (
          <div className="fixed bottom-6 right-6 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-bottom-4" data-testid="toast-saved">
            <Check className="w-4 h-4" />
            บันทึกสำเร็จ
          </div>
        )}
      </div>
    </div>
  );
}
