import CustomerSegments from "../cusotmer-segment-components/CustomerSegments";


export default function CreateCustomerSegmentPage() {
  return (
    <CustomerSegments
      initialSegments={[]}
      showSegments={false}
      redirectAfterCreate
    />
  );
}
