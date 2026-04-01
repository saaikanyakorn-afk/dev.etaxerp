import PosLayout from "@/components/pos-layout";
import PromotionFormPage from "@/pages/inventory/promotion-form";

export default function PosPromotionForm() {
  return <PromotionFormPage Wrapper={PosLayout} basePath="/pos" />;
}
