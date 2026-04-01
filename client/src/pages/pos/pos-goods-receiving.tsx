import PosLayout from "@/components/pos-layout";
import GoodsReceivingList from "@/pages/inventory/goods-receiving-list";

export default function PosGoodsReceiving() {
  return <GoodsReceivingList Wrapper={PosLayout} basePath="/pos" />;
}
