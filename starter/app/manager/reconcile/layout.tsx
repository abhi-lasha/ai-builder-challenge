import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reconciliation",
};

export default function ReconcileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
