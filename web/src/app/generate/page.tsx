"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUniverseStore } from "@/stores/universe-store";

export default function GenerateRedirect() {
  const router = useRouter();
  const { activeUniverseId } = useUniverseStore();

  useEffect(() => {
    router.replace(`/universe/${activeUniverseId}/projects/generate`);
  }, [router, activeUniverseId]);

  return null;
}
