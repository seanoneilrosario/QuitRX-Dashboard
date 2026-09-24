import RealtimeConnection from "@/src/realtime/realtime-connection";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RealtimeConnection />
      {children}
    </>
  );
}
