"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUniverseStore } from "@/stores/universe-store";

export default function CharactersRedirect() {
  const router = useRouter();
  const { activeUniverseId } = useUniverseStore();

  useEffect(() => {
    router.replace(`/app/universe/${activeUniverseId}/characters`);
  }, [router, activeUniverseId]);

  return null;
}
