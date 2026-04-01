import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings2, Download, Search, Plus, Trash2, Save } from "lucide-react";

export default function AccountingConfig() {
  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings2 className="h-4 w-4" />
            <h1 className="text-xl font-heading font-bold text-foreground">การตั้งค่าสูตรบัญชี</h1>
            <span className="text-xs">สมุดรายวันทั่วไป</span>
          </div>
          <Button size="sm" style={{ background: "#03c9d7" }} className="hover:opacity-90 text-white">
            <Download className="h-4 w-4 mr-2" /> Download All
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Sidebar - Module Selection */}
          <div className="md:col-span-3 space-y-4">
            <div className="relative">
              <Input placeholder="Search..." className="pr-10" />
              <Button size="icon" className="absolute right-0 top-0 h-full rounded-l-none text-white" style={{ background: "#03c9d7" }}>
                <Search className="h-4 w-4 text-white" />
              </Button>
            </div>
            
            <div className="border rounded-md overflow-hidden">
              <div className="bg-[#4a6ea5] text-white p-2 text-center text-sm">เลือกโมดูล</div>
              <div className="bg-white">
                {[
                  "ใบแจ้งหนี้", "ใบกำกับภาษีขาย/POS", "ใบลดหนี้ (ขาย)", "ใบกำกับภาษีซื้อ", 
                  "ใบลดหนี้ (ซื้อ)", "ใบเสร็จรับเงิน", "ใบสำคัญจ่าย", "การโอนเงิน",
                  "เช็ครับ", "เช็คจ่าย", "ใบเบิกสินค้า", "ใบรับสินค้า", "การผลิต", 
                  "ระบบเงินเดือน", "สูตรทั้งหมด"
                ].map((module, idx) => (
                  <div 
                    key={module} 
                    className={`p-2 text-sm cursor-pointer hover:bg-muted transition-colors ${idx === 0 ? 'bg-primary/10 text-primary font-medium' : ''} ${module === 'เช็ครับ' || module === 'เช็คจ่าย' ? 'bg-emerald-50' : ''} ${module === 'สูตรทั้งหมด' ? 'bg-rose-50 text-rose-600' : ''}`}
                  >
                    {module}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Content - Config Form */}
          <div className="md:col-span-9">
            <Card className="shadow-sm border-none bg-slate-50/50">
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <label className="text-sm font-medium">ลำดับ:</label>
                      <Input placeholder="ลำดับ - 1,2,3..." className="col-span-2 bg-white" />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <label className="text-sm font-medium">Name:*</label>
                      <Input placeholder="ชื่อสูตร - Max 50 Characters" className="col-span-2 bg-white" />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <label className="text-sm font-medium">ชื่อ:</label>
                      <Input placeholder="ชื่อสูตร - Max 50 Characters" className="col-span-2 bg-white" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <label className="text-sm font-medium">เลือกโมดูล:</label>
                      <Select>
                        <SelectTrigger className="col-span-2 bg-white">
                          <SelectValue placeholder="เลือกโมดูล" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invoice">ใบแจ้งหนี้</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <label className="text-sm font-medium">เลือกสมุดบัญชี:</label>
                      <Select>
                        <SelectTrigger className="col-span-2 bg-white">
                          <SelectValue placeholder="เลือกสมุดบัญชี" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gl">สมุดรายวันทั่วไป</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="bg-sky-500 text-white grid grid-cols-12 text-sm font-medium py-2 px-4 rounded-t-md">
                    <div className="col-span-6">รหัสบัญชี</div>
                    <div className="col-span-3 text-right">เดบิต</div>
                    <div className="col-span-3 text-right">เครดิต</div>
                  </div>
                  <div className="bg-white border rounded-b-md p-4 flex justify-center italic text-muted-foreground text-sm">
                    No items added
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <Button size="sm" className="bg-amber-400 hover:bg-amber-500 text-white">
                    <Plus className="h-4 w-4 mr-1" /> เพิ่มรายการใหม่
                  </Button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" className="bg-rose-500">
                      <Trash2 className="h-4 w-4 mr-1" /> ลบ
                    </Button>
                    <Button size="sm" style={{ background: "#03c9d7" }} className="hover:opacity-90 text-white">
                      <Save className="h-4 w-4 mr-1" /> บันทึก [F2]
                    </Button>
                  </div>
                </div>

                <div className="pt-6 border-t grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-500">
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <span>Status:</span>
                      <Select defaultValue="not-specified">
                        <SelectTrigger className="w-[120px] h-6 text-[10px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not-specified">Not specified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p>NOTE:</p>
                    <p>[STRUCTURE] grand_total + wht = vat + total</p>
                    <p>[STRUCTURE] weight debit = weight credit</p>
                  </div>
                  <div className="space-y-2 flex flex-col items-end">
                    <div className="flex items-center gap-4">
                      <span>Product2GL:</span>
                      <Select defaultValue="auto">
                        <SelectTrigger className="w-[80px] h-6 text-[10px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">AUTO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-4">
                      <span>Active:</span>
                      <Select defaultValue="yes">
                        <SelectTrigger className="w-[80px] h-6 text-[10px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">YES</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
