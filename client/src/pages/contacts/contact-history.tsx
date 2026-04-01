import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Search, FileText, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useState } from "react";

export default function ContactHistory() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h1 data-testid="text-page-title" className="text-xl font-heading font-bold">ประวัติการดูคู่ค้า</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input data-testid="input-search" className="pl-9" placeholder="ค้นหาชื่อคู่ค้า, รหัส, เลขภาษี..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40" data-testid="select-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  <SelectItem value="sale">เอกสารขาย</SelectItem>
                  <SelectItem value="purchase">เอกสารซื้อ</SelectItem>
                  <SelectItem value="payment">การชำระเงิน</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">วันที่</TableHead>
                  <TableHead>คู่ค้า</TableHead>
                  <TableHead>ประเภทเอกสาร</TableHead>
                  <TableHead>เลขที่เอกสาร</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="font-medium">ยังไม่มีประวัติการทำรายการ</p>
                    <p className="text-sm mt-1">ประวัติจะแสดงเมื่อมีการสร้างเอกสารขาย/ซื้อกับคู่ค้า</p>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
