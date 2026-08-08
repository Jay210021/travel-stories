import type { ReactNode } from "react";
import AdminShell from "../AdminShell";

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
