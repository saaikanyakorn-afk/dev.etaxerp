import PosLayout from "@/components/pos-layout";
import GoodsReceivingForm from "@/pages/inventory/goods-receiving-form";

export default function PosGoodsReceivingForm() {
  return <GoodsReceivingForm Wrapper={PosLayout} basePath="/pos" />;
}
