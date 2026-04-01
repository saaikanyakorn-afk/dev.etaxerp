import PosLayout from "@/components/pos-layout";
import InventoryList from "@/pages/inventory/inventory-list";

export default function PosProducts() {
  return <InventoryList Wrapper={PosLayout} basePath="/pos" />;
}
