import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface BulkDeleteButtonProps {
  count: number;
  isPending: boolean;
  onClick: () => void;
}

export function BulkDeleteButton({ count, isPending, onClick }: BulkDeleteButtonProps) {
  if (count === 0) return null;
  return (
    <Button
      data-testid="button-bulk-delete"
      variant="outline"
      onClick={onClick}
      className="h-9 text-sm px-4 border-red-400 text-red-500 hover:bg-red-50"
      disabled={isPending}
    >
      <Trash2 className="h-3.5 w-3.5 mr-1" />
      ลบที่เลือก ({count})
    </Button>
  );
}

interface BulkDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  docLabel: string;
  onConfirm: () => void;
}

export function BulkDeleteConfirmDialog({ open, onOpenChange, count, docLabel, onConfirm }: BulkDeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยืนยันลบ{docLabel}</AlertDialogTitle>
          <AlertDialogDescription>
            คุณต้องการลบ{docLabel}ที่เลือกไว้ {count} รายการ ใช่หรือไม่?
            <br />
            <span className="text-red-500 font-medium">การดำเนินการนี้ไม่สามารถย้อนกลับได้ รายการลงบัญชีที่เกี่ยวข้องจะถูกลบด้วย</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-500 hover:bg-red-600 text-white">
            ยืนยันลบ {count} รายการ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface SelectAllCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function SelectAllCheckbox({ checked, onCheckedChange }: SelectAllCheckboxProps) {
  return (
    <Checkbox
      data-testid="checkbox-select-all"
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[var(--theme-primary)]"
    />
  );
}

interface RowCheckboxProps {
  id: number;
  checked: boolean;
  onCheckedChange: () => void;
}

export function RowCheckbox({ id, checked, onCheckedChange }: RowCheckboxProps) {
  return (
    <Checkbox
      data-testid={`checkbox-select-${id}`}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="border-gray-300"
    />
  );
}
