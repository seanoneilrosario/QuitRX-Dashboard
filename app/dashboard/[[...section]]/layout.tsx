import RealtimeConnection from "@/src/realtime/realtime-connection";
import { Suspense } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <RealtimeConnection />
      </Suspense>
      {children}
    </>
  );
}
