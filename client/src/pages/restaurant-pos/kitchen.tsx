import { useState, useEffect } from "react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/lib/company-context";
import { ChefHat, Clock, CheckCircle2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const statusColors: Record<string, string> = {
  new: "border-red-400 bg-red-50",
  in_progress: "border-amber-400 bg-amber-50",
};

export default function KitchenDisplay() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: tickets, refetch } = useQuery<any[]>({
    queryKey: ["/api/restaurant/kitchen-tickets", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/restaurant/kitchen-tickets?companyId=${companyId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  const updateTicket = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/restaurant/kitchen-tickets/${id}/status`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ status }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant/kitchen-tickets"] });
    },
  });

  const getElapsedMinutes = (createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/restaurant-pos")} data-testid="btn-back">
              <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
            </Button>
            <ChefHat className="h-6 w-6 text-amber-500" />
            <h1 className="text-xl font-heading font-bold">Kitchen Display System (KDS)</h1>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {tickets?.length || 0} ออเดอร์
          </Badge>
        </div>

        {(!tickets || tickets.length === 0) ? (
          <div className="text-center py-20 text-muted-foreground">
            <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl">ไม่มีออเดอร์รอทำ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tickets.map((ticket: any) => {
              const elapsed = getElapsedMinutes(ticket.createdAt);
              const isUrgent = elapsed >= 10;
              return (
                <Card key={ticket.id} className={`border-2 ${isUrgent ? "border-red-500 bg-red-50" : statusColors[ticket.status] || "border-gray-200"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-lg">{ticket.tableName}</p>
                        <Badge className={ticket.status === "new" ? "bg-red-500" : "bg-amber-500"}>
                          {ticket.status === "new" ? "ใหม่" : "กำลังทำ"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className={`h-4 w-4 ${isUrgent ? "text-red-500" : "text-muted-foreground"}`} />
                        <span className={isUrgent ? "text-red-600 font-bold" : "text-muted-foreground"}>{elapsed} นาที</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {ticket.items?.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between py-1 border-b last:border-0">
                        <div>
                          <p className="font-medium">{item.quantity}x {item.menuItemName}</p>
                          {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                          {item.modifiers && <p className="text-xs text-blue-600">{typeof item.modifiers === "string" ? item.modifiers : ""}</p>}
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      {ticket.status === "new" && (
                        <Button size="sm" className="flex-1 bg-amber-500 hover:bg-amber-600" onClick={() => updateTicket.mutate({ id: ticket.id, status: "in_progress" })} data-testid={`btn-start-${ticket.id}`}>
                          เริ่มทำ
                        </Button>
                      )}
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => updateTicket.mutate({ id: ticket.id, status: "done" })} data-testid={`btn-done-${ticket.id}`}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> เสร็จแล้ว
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
