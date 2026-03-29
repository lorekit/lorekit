"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUniverseStore } from "@/stores/universe-store";

export default function ProjectsRedirect() {
  const router = useRouter();
  const { activeUniverseId } = useUniverseStore();

  useEffect(() => {
    router.replace(`/universe/${activeUniverseId}/projects`);
  }, [router, activeUniverseId]);

  return null;
}
