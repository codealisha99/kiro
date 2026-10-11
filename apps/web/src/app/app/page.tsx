import type { Metadata } from "next";
import Workspace from "@/components/Workspace";

export const metadata: Metadata = {
  title: "Your knowledge desk — Kiro",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return (
    <Workspace initialAuthMode={mode === "register" ? "register" : "login"} />
  );
}
