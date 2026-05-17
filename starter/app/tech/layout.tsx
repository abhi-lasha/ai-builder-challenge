import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan workflows",
};

export default function TechLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
