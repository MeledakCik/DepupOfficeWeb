import type { Metadata } from "next";
import Workspace from "@/components/workspace";

export const metadata: Metadata = { title: "Ruang kerja | DepUp Office" };

export default function OfficePage() {
  return <Workspace />;
}
