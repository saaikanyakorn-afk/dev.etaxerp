import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, ChevronDown, ChevronUp } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface AdvancedFiltersProps {
  branches?: FilterOption[];
  selectedBranch?: string;
  onBranchChange?: (val: string) => void;
  employees?: FilterOption[];
  selectedEmployee?: string;
  onEmployeeChange?: (val: string) => void;
  customers?: FilterOption[];
  selectedCustomer?: string;
  onCustomerChange?: (val: string) => void;
  className?: string;
}

export default function AdvancedFilters({
  branches,
  selectedBranch,
  onBranchChange,
  employees,
  selectedEmployee,
  onEmployeeChange,
  customers,
  selectedCustomer,
  onCustomerChange,
  className,
}: AdvancedFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const hasAnyFilter = branches?.length || employees?.length || customers?.length;
  if (!hasAnyFilter) return null;

  const hasActiveFilter =
    (selectedBranch && selectedBranch !== "all") ||
    (selectedEmployee && selectedEmployee !== "all") ||
    (selectedCustomer && selectedCustomer !== "all");

  return (
    <div className={className}>
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 text-xs gap-1 ${hasActiveFilter ? "text-[#fb9678]" : "text-muted-foreground"}`}
        onClick={() => setExpanded(!expanded)}
        data-testid="button-advanced-filters"
      >
        <Filter className="h-3 w-3" />
        ตัวกรองเพิ่มเติม
        {hasActiveFilter && <span className="bg-[#fb9678] text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">!</span>}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {expanded && (
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {branches && branches.length > 0 && onBranchChange && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">สาขา:</span>
              <Select value={selectedBranch || "all"} onValueChange={onBranchChange}>
                <SelectTrigger className="w-44 h-8 text-xs bg-white border rounded-lg" data-testid="select-filter-branch">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {employees && employees.length > 0 && onEmployeeChange && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">พนักงาน:</span>
              <Select value={selectedEmployee || "all"} onValueChange={onEmployeeChange}>
                <SelectTrigger className="w-44 h-8 text-xs bg-white border rounded-lg" data-testid="select-filter-employee">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {customers && customers.length > 0 && onCustomerChange && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">ลูกค้า:</span>
              <Select value={selectedCustomer || "all"} onValueChange={onCustomerChange}>
                <SelectTrigger className="w-44 h-8 text-xs bg-white border rounded-lg" data-testid="select-filter-customer">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                onBranchChange?.("all");
                onEmployeeChange?.("all");
                onCustomerChange?.("all");
              }}
              data-testid="button-clear-advanced-filters"
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
