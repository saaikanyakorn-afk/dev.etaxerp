import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Pencil, Trash2, Save, UtensilsCrossed } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

function fmt(val: number | string) { return Number(val).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function MenuSettings() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCatForm, setShowCatForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showModGroupForm, setShowModGroupForm] = useState(false);
  const [editCat, setEditCat] = useState<any>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [editModGroup, setEditModGroup] = useState<any>(null);

  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState("food");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCatId, setItemCatId] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemAvailable, setItemAvailable] = useState(true);
  const [modGroupName, setModGroupName] = useState("");
  const [modRequired, setModRequired] = useState(false);
  const [modMaxSelect, setModMaxSelect] = useState("1");
  const [modOptions, setModOptions] = useState<{ name: string; extraPrice: string }[]>([]);

  const { data: categories } = useQuery<any[]>({
    queryKey: ["/api/restaurant/menu-categories", companyId],
    queryFn: async () => { const res = await fetch(`/api/restaurant/menu-categories?companyId=${companyId}`, { credentials: "include" }); return res.json(); },
    enabled: !!companyId,
  });

  const { data: menuItems } = useQuery<any[]>({
    queryKey: ["/api/restaurant/menu-items", companyId],
    queryFn: async () => { const res = await fetch(`/api/restaurant/menu-items?companyId=${companyId}`, { credentials: "include" }); return res.json(); },
    enabled: !!companyId,
  });

  const { data: modGroups } = useQuery<any[]>({
    queryKey: ["/api/restaurant/modifier-groups", companyId],
    queryFn: async () => { const res = await fetch(`/api/restaurant/modifier-groups?companyId=${companyId}`, { credentials: "include" }); return res.json(); },
    enabled: !!companyId,
  });

  const saveCat = useMutation({
    mutationFn: async () => {
      const url = editCat ? `/api/restaurant/menu-categories/${editCat.id}` : "/api/restaurant/menu-categories";
      const method = editCat ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ companyId, name: catName, type: catType, sortOrder: (categories?.length || 0) + 1 }) });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu-categories"] }); setShowCatForm(false); toast({ title: "บันทึกแล้ว" }); },
  });

  const deleteCat = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/restaurant/menu-categories/${id}`, { method: "DELETE", credentials: "include" }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu-categories"] }); toast({ title: "ลบแล้ว" }); },
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      const url = editItem ? `/api/restaurant/menu-items/${editItem.id}` : "/api/restaurant/menu-items";
      const method = editItem ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ companyId, name: itemName, price: itemPrice, categoryId: Number(itemCatId), description: itemDesc, available: itemAvailable, sortOrder: (menuItems?.length || 0) + 1 }) });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu-items"] }); setShowItemForm(false); toast({ title: "บันทึกแล้ว" }); },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/restaurant/menu-items/${id}`, { method: "DELETE", credentials: "include" }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/restaurant/menu-items"] }); toast({ title: "ลบแล้ว" }); },
  });

  const saveModGroup = useMutation({
    mutationFn: async () => {
      const url = editModGroup ? `/api/restaurant/modifier-groups/${editModGroup.id}` : "/api/restaurant/modifier-groups";
      const method = editModGroup ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ companyId, name: modGroupName, required: modRequired, maxSelections: Number(modMaxSelect), options: modOptions.map(o => ({ name: o.name, extraPrice: o.extraPrice || "0" })) }) });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/restaurant/modifier-groups"] }); setShowModGroupForm(false); toast({ title: "บันทึกแล้ว" }); },
  });

  const deleteModGroup = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/restaurant/modifier-groups/${id}`, { method: "DELETE", credentials: "include" }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/restaurant/modifier-groups"] }); toast({ title: "ลบแล้ว" }); },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/restaurant-pos")} data-testid="btn-back"><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Button>
          <UtensilsCrossed className="h-6 w-6 text-[#03c9d7]" />
          <h1 className="text-xl font-heading font-bold">จัดการเมนูอาหาร</h1>
        </div>

        <Tabs defaultValue="categories">
          <TabsList>
            <TabsTrigger value="categories">หมวดหมู่</TabsTrigger>
            <TabsTrigger value="items">เมนู</TabsTrigger>
            <TabsTrigger value="modifiers">ตัวเลือกเพิ่มเติม</TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="font-medium">หมวดหมู่เมนู</p>
                  <Button size="sm" onClick={() => { setEditCat(null); setCatName(""); setCatType("food"); setShowCatForm(true); }} data-testid="btn-add-category"><Plus className="h-4 w-4 mr-1" /> เพิ่มหมวด</Button>
                </div>
              </CardHeader>
              <CardContent>
                {categories?.length ? (
                  <div className="space-y-2">
                    {categories.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">({c.type === "food" ? "อาหาร" : c.type === "beverage" ? "เครื่องดื่ม" : "ของหวาน"})</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setEditCat(c); setCatName(c.name); setCatType(c.type); setShowCatForm(true); }}><Pencil className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteCat.mutate(c.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-muted-foreground text-sm">ยังไม่มีหมวดหมู่</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="items">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="font-medium">รายการเมนู</p>
                  <Button size="sm" onClick={() => { setEditItem(null); setItemName(""); setItemPrice(""); setItemCatId(""); setItemDesc(""); setItemAvailable(true); setShowItemForm(true); }} data-testid="btn-add-item"><Plus className="h-4 w-4 mr-1" /> เพิ่มเมนู</Button>
                </div>
              </CardHeader>
              <CardContent>
                {menuItems?.length ? (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b"><th className="text-left p-2">เมนู</th><th className="text-left p-2">หมวด</th><th className="text-right p-2">ราคา</th><th className="text-center p-2">พร้อมขาย</th><th className="text-center p-2">จัดการ</th></tr></thead>
                    <tbody>
                      {menuItems.map(m => (
                        <tr key={m.id} className="border-b hover:bg-slate-50">
                          <td className="p-2 font-medium">{m.name}</td>
                          <td className="p-2">{categories?.find(c => c.id === m.categoryId)?.name || "-"}</td>
                          <td className="p-2 text-right">{fmt(m.price)}</td>
                          <td className="p-2 text-center">{m.available ? "✓" : "✗"}</td>
                          <td className="p-2 text-center">
                            <Button size="sm" variant="ghost" onClick={() => { setEditItem(m); setItemName(m.name); setItemPrice(m.price); setItemCatId(String(m.categoryId)); setItemDesc(m.description || ""); setItemAvailable(m.available); setShowItemForm(true); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteItem.mutate(m.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-muted-foreground text-sm">ยังไม่มีเมนู</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modifiers">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="font-medium">กลุ่มตัวเลือกเพิ่มเติม</p>
                  <Button size="sm" onClick={() => { setEditModGroup(null); setModGroupName(""); setModRequired(false); setModMaxSelect("1"); setModOptions([{ name: "", extraPrice: "0" }]); setShowModGroupForm(true); }} data-testid="btn-add-modifier"><Plus className="h-4 w-4 mr-1" /> เพิ่มกลุ่มตัวเลือก</Button>
                </div>
              </CardHeader>
              <CardContent>
                {modGroups?.length ? (
                  <div className="space-y-3">
                    {modGroups.map(g => (
                      <div key={g.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{g.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{g.required ? "(บังคับ)" : "(ไม่บังคับ)"} เลือกได้ {g.maxSelections} รายการ</span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setEditModGroup(g); setModGroupName(g.name); setModRequired(g.required); setModMaxSelect(String(g.maxSelections)); setModOptions(g.options?.map((o: any) => ({ name: o.name, extraPrice: o.extraPrice })) || []); setShowModGroupForm(true); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteModGroup.mutate(g.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {g.options?.map((o: any) => (
                            <span key={o.id} className="text-xs bg-slate-100 px-2 py-1 rounded">{o.name} {Number(o.extraPrice) > 0 && `+${fmt(o.extraPrice)}`}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-muted-foreground text-sm">ยังไม่มีกลุ่มตัวเลือก</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showCatForm} onOpenChange={setShowCatForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editCat ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="ชื่อหมวดหมู่" data-testid="input-cat-name" />
            <Select value={catType} onValueChange={setCatType}>
              <SelectTrigger data-testid="select-cat-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="food">อาหาร</SelectItem>
                <SelectItem value="beverage">เครื่องดื่ม</SelectItem>
                <SelectItem value="dessert">ของหวาน</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCatForm(false)}>ยกเลิก</Button>
            <Button onClick={() => saveCat.mutate()} className="bg-[#03c9d7] hover:bg-[#02b0bc]" data-testid="btn-save-cat"><Save className="h-4 w-4 mr-1" /> บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showItemForm} onOpenChange={setShowItemForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? "แก้ไขเมนู" : "เพิ่มเมนู"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="ชื่อเมนู" data-testid="input-item-name" />
            <Input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="ราคา" data-testid="input-item-price" />
            <Select value={itemCatId} onValueChange={setItemCatId}>
              <SelectTrigger data-testid="select-item-cat"><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
              <SelectContent>
                {categories?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="รายละเอียด (ไม่บังคับ)" data-testid="input-item-desc" />
            <div className="flex items-center gap-2">
              <Switch checked={itemAvailable} onCheckedChange={setItemAvailable} data-testid="switch-available" />
              <span className="text-sm">พร้อมขาย</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemForm(false)}>ยกเลิก</Button>
            <Button onClick={() => saveItem.mutate()} className="bg-[#03c9d7] hover:bg-[#02b0bc]" data-testid="btn-save-item"><Save className="h-4 w-4 mr-1" /> บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showModGroupForm} onOpenChange={setShowModGroupForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editModGroup ? "แก้ไขกลุ่มตัวเลือก" : "เพิ่มกลุ่มตัวเลือก"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={modGroupName} onChange={e => setModGroupName(e.target.value)} placeholder="ชื่อกลุ่ม (เช่น ระดับความเผ็ด)" data-testid="input-mod-name" />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={modRequired} onCheckedChange={setModRequired} />
                <span className="text-sm">บังคับเลือก</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">เลือกได้สูงสุด</span>
                <Input type="number" value={modMaxSelect} onChange={e => setModMaxSelect(e.target.value)} className="w-16 h-7" min="1" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">ตัวเลือก</p>
              {modOptions.map((opt, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input value={opt.name} onChange={e => setModOptions(modOptions.map((o, j) => j === i ? { ...o, name: e.target.value } : o))} placeholder="ชื่อ" className="flex-1" />
                  <Input type="number" value={opt.extraPrice} onChange={e => setModOptions(modOptions.map((o, j) => j === i ? { ...o, extraPrice: e.target.value } : o))} placeholder="ราคาเพิ่ม" className="w-24" />
                  <Button size="sm" variant="ghost" onClick={() => setModOptions(modOptions.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setModOptions([...modOptions, { name: "", extraPrice: "0" }])}><Plus className="h-3 w-3 mr-1" /> เพิ่มตัวเลือก</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModGroupForm(false)}>ยกเลิก</Button>
            <Button onClick={() => saveModGroup.mutate()} className="bg-[#03c9d7] hover:bg-[#02b0bc]" data-testid="btn-save-mod"><Save className="h-4 w-4 mr-1" /> บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
