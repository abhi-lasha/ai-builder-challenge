import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assets",
};

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
