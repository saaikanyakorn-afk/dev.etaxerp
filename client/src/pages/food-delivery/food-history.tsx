import FoodDeliveryLayout from "@/components/food-delivery-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCompany } from "@/lib/company-context";
import { useState } from "react";
import {
  Search, Download, ClipboardList, Calendar,
} from "lucide-react";

export default function FoodHistory() {
  const { selectedCompany } = useCompany();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("30d");

  return (
    <FoodDeliveryLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800" data-testid="text-page-title">ประวัติออเดอร์</h1>
            <p className="text-sm text-gray-500">ประวัติออเดอร์อาหารทั้งหมด</p>
          </div>
          <Button variant="outline" size="sm" data-testid="btn-export">
            <Download className="h-4 w-4 mr-1.5" />ส่งออก Excel
          </Button>
        </div>

        <Card className="flexy-card">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ค้นหาเลขออเดอร์..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-36" data-testid="select-period">
                  <Calendar className="h-4 w-4 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 วัน</SelectItem>
                  <SelectItem value="30d">30 วัน</SelectItem>
                  <SelectItem value="90d">90 วัน</SelectItem>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="flexy-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead>เลขออเดอร์</TableHead>
                  <TableHead>แพลตฟอร์ม</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">ยอดรวม</TableHead>
                  <TableHead>วันที่</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="text-center py-12 text-gray-400">
                      <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">ยังไม่มีประวัติออเดอร์</p>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </FoodDeliveryLayout>
  );
}
