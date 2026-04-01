import PosLayout from "@/components/pos-layout";
import GoodsRequisitionList from "@/pages/inventory/goods-requisition-list";

export default function PosRequisition() {
  return <GoodsRequisitionList Wrapper={PosLayout} basePath="/pos" />;
}
