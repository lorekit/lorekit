"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUniverseStore } from "@/stores/universe-store";

export default function ProjectDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { activeUniverseId } = useUniverseStore();

  useEffect(() => {
    router.replace(`/universe/${activeUniverseId}/projects/${id}`);
  }, [router, activeUniverseId, id]);

  return null;
}
