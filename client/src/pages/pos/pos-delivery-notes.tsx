import PosLayout from "@/components/pos-layout";
import DeliveryNotesPage from "@/pages/delivery/delivery-notes";

export default function PosDeliveryNotes() {
  return <DeliveryNotesPage Wrapper={PosLayout} basePath="/pos" />;
}
