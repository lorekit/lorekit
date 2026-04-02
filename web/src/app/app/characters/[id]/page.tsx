"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUniverseStore } from "@/stores/universe-store";

export default function CharacterDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { activeUniverseId } = useUniverseStore();

  useEffect(() => {
    router.replace(`/app/universe/${activeUniverseId}/characters/${id}`);
  }, [router, activeUniverseId, id]);

  return null;
}
