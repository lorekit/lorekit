"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { useUniverseStore } from "@/stores/universe-store";

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const universeId = params.universeId as string;
  const { setActiveUniverse, fetchUniverses } = useUniverseStore();

  useEffect(() => {
    fetchUniverses();
  }, [fetchUniverses]);

  useEffect(() => {
    if (universeId) {
      setActiveUniverse(universeId);
    }
  }, [universeId, setActiveUniverse]);

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
