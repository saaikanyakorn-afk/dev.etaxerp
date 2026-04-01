import PosLayout from "@/components/pos-layout";
import PromotionManagement from "@/pages/inventory/promotion-management";

export default function PosPromotions() {
  return <PromotionManagement Wrapper={PosLayout} basePath="/pos" />;
}
