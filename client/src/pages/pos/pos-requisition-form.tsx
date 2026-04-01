import PosLayout from "@/components/pos-layout";
import GoodsRequisitionForm from "@/pages/inventory/goods-requisition-form";

export default function PosRequisitionForm() {
  return <GoodsRequisitionForm Wrapper={PosLayout} basePath="/pos" />;
}
