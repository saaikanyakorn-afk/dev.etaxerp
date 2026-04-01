import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UseBulkDeleteOptions {
  endpoint: string;
  queryKey: string;
  docLabel: string;
  companyId?: number;
}

export function useBulkDelete({ endpoint, queryKey, docLabel, companyId }: UseBulkDeleteOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", endpoint, { ids, companyId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setSelectedIds(new Set());
      toast({
        title: `ลบ${docLabel}สำเร็จ ${data.deleted} รายการ`,
        description: data.errors?.length ? `ข้อผิดพลาด: ${(data.errors as string[]).join(", ")}` : undefined,
        variant: "success" as any,
      });
    },
    onError: (err: any) => {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    },
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (ids: number[]) => {
    setSelectedIds(new Set(ids));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const confirmDelete = () => {
    mutation.mutate(Array.from(selectedIds));
    setShowConfirm(false);
  };

  return {
    selectedIds,
    showConfirm,
    setShowConfirm,
    toggleSelect,
    selectAll,
    clearSelection,
    confirmDelete,
    isPending: mutation.isPending,
  };
}
