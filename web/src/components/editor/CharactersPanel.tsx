"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoicePicker } from "@/components/ui/VoicePicker";
import type { VoiceOption } from "@/components/ui/VoicePicker";
import {
  clipUrl,
  getUniverseCharacters,
  getCharacterVoice,
  upsertCharacterVoice,
  getTTSModels,
  updateProject,
  type Character,
  type CharacterVoice,
  type TTSModel,
} from "@/lib/api";

interface CharactersPanelProps {
  universeId: string;
  projectId: string;
  /** Primary character_id on the project */
  characterId: string;
  /** JSON-encoded array of character IDs, or null */
  characterIdsJson?: string | null;
  /** Called after project character list is updated */
  onCharacterIdsChange?: (ids: string[]) => void;
}

/** Resolve a character image URL */
function charImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return clipUrl(url.startsWith("/files/") ? url : `/files/${url}`);
}

export function CharactersPanel({
  universeId,
  projectId,
  characterId,
  characterIdsJson,
  onCharacterIdsChange,
}: CharactersPanelProps) {
  // All universe characters
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  // TTS models + voices
  const [ttsModels, setTtsModels] = useState<Record<string, TTSModel>>({});
  // Per-character voice config from DB
  const [voiceConfigs, setVoiceConfigs] = useState<Record<string, CharacterVoice | null>>({});
  // Show "Add from universe" section
  const [showAdd, setShowAdd] = useState(false);
  // Error feedback
  const [error, setError] = useState<string | null>(null);

  // Parse which character IDs are in this project
  const projectCharacterIds: string[] = React.useMemo(() => {
    const ids = new Set<string>();
    ids.add(characterId); // primary always included
    if (characterIdsJson) {
      try {
        const parsed = JSON.parse(characterIdsJson);
        if (Array.isArray(parsed)) parsed.forEach((id: string) => ids.add(id));
      } catch {}
    }
    return Array.from(ids);
  }, [characterId, characterIdsJson]);

  // Characters in the project
  const projectCharacters = React.useMemo(
    () => allCharacters.filter((c) => projectCharacterIds.includes(c.id)),
    [allCharacters, projectCharacterIds]
  );

  // Characters available to add
  const availableCharacters = React.useMemo(
    () => allCharacters.filter((c) => !projectCharacterIds.includes(c.id)),
    [allCharacters, projectCharacterIds]
  );

  // Load universe characters + TTS models on mount
  useEffect(() => {
    getUniverseCharacters(universeId).then(setAllCharacters).catch(console.error);
    getTTSModels().then(setTtsModels).catch(console.error);
  }, [universeId]);

  // Load voice configs for project characters
  useEffect(() => {
    for (const cid of projectCharacterIds) {
      if (voiceConfigs[cid] !== undefined) continue;
      getCharacterVoice(universeId, cid)
        .then((voice) => setVoiceConfigs((prev) => ({ ...prev, [cid]: voice })))
        .catch(() => setVoiceConfigs((prev) => ({ ...prev, [cid]: null })));
    }
  }, [projectCharacterIds, universeId]);

  // Flatten all voices from all TTS models
  const modelEntries = React.useMemo(() => {
    return Object.entries(ttsModels)
      .filter(([, m]) => m.voices && m.voices.length > 0)
      .map(([key, m]) => ({ key, name: m.name, voices: m.voices! }));
  }, [ttsModels]);

  // Get voices for a given tts_model key
  const getVoicesForModel = useCallback(
    (modelKey: string): VoiceOption[] => {
      const model = ttsModels[modelKey];
      return model?.voices ?? [];
    },
    [ttsModels]
  );

  // Save voice config
  const handleVoiceChange = useCallback(
    async (charId: string, ttsModel: string, voiceId: string) => {
      try {
        setError(null);
        const voiceName = ttsModels[ttsModel]?.voices?.find((v) => v.id === voiceId)?.name ?? voiceId;
        const result = await upsertCharacterVoice(universeId, charId, {
          tts_model: ttsModel,
          voice_id: voiceId || undefined,
          voice_name: voiceName,
        });
        setVoiceConfigs((prev) => ({ ...prev, [charId]: result }));
      } catch (err) {
        console.error("Failed to save voice:", err);
        setError("Failed to save voice. Check that the backend is running.");
      }
    },
    [universeId, ttsModels]
  );

  // Add character to project
  const handleAddCharacter = useCallback(
    async (charId: string) => {
      try {
        setError(null);
        const newIds = [...projectCharacterIds, charId];
        await updateProject(projectId, { character_ids_json: JSON.stringify(newIds) } as any);
        onCharacterIdsChange?.(newIds);
        setShowAdd(false);
        // Load voice config for the new character
        getCharacterVoice(universeId, charId)
          .then((voice) => setVoiceConfigs((prev) => ({ ...prev, [charId]: voice })))
          .catch(() => setVoiceConfigs((prev) => ({ ...prev, [charId]: null })));
      } catch (err) {
        console.error("Failed to add character:", err);
        setError("Failed to add character.");
      }
    },
    [projectCharacterIds, projectId, universeId, onCharacterIdsChange]
  );

  // Remove character from project (can't remove primary)
  const handleRemoveCharacter = useCallback(
    async (charId: string) => {
      if (charId === characterId) return; // can't remove primary
      try {
        setError(null);
        const newIds = projectCharacterIds.filter((id) => id !== charId);
        await updateProject(projectId, { character_ids_json: JSON.stringify(newIds) } as any);
        onCharacterIdsChange?.(newIds);
      } catch (err) {
        console.error("Failed to remove character:", err);
        setError("Failed to remove character.");
      }
    },
    [projectCharacterIds, characterId, projectId, onCharacterIdsChange]
  );

  return (
    <div className="p-3 space-y-3">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        Characters in Project
      </span>

      {error && (
        <div className="flex items-center justify-between gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {projectCharacters.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          No characters assigned yet.
        </div>
      ) : (
        <div className="space-y-2">
          {projectCharacters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              voiceConfig={voiceConfigs[char.id] ?? null}
              isPrimary={char.id === characterId}
              modelEntries={modelEntries}
              getVoicesForModel={getVoicesForModel}
              onVoiceChange={(ttsModel, voiceId) =>
                handleVoiceChange(char.id, ttsModel, voiceId)
              }
              onRemove={() => handleRemoveCharacter(char.id)}
            />
          ))}
        </div>
      )}

      {/* Add character button / section */}
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Character from Universe
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Available in Universe
            </span>
            <button
              onClick={() => setShowAdd(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {availableCharacters.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              All characters are already in this project.
            </p>
          ) : (
            <div className="space-y-1.5">
              {availableCharacters.map((char) => (
                <div
                  key={char.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  {char.character_image_url ? (
                    <img
                      src={charImageUrl(char.character_image_url)!}
                      alt={char.name}
                      className="w-8 h-8 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-slate-600" />
                    </div>
                  )}
                  <span className="text-xs text-slate-300 flex-1 truncate">{char.name}</span>
                  <button
                    onClick={() => handleAddCharacter(char.id)}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Character Card
// ---------------------------------------------------------------------------

function CharacterCard({
  character,
  voiceConfig,
  isPrimary,
  modelEntries,
  getVoicesForModel,
  onVoiceChange,
  onRemove,
}: {
  character: Character;
  voiceConfig: CharacterVoice | null;
  isPrimary: boolean;
  modelEntries: Array<{ key: string; name: string; voices: VoiceOption[] }>;
  getVoicesForModel: (modelKey: string) => VoiceOption[];
  onVoiceChange: (ttsModel: string, voiceId: string) => void;
  onRemove: () => void;
}) {
  // Default to first available model
  const currentModel = voiceConfig?.tts_model ?? modelEntries[0]?.key ?? "";
  const currentVoiceId = voiceConfig?.voice_id ?? "";
  const voices = getVoicesForModel(currentModel);

  return (
    <div className="rounded-lg border border-slate-800 p-3 space-y-2.5">
      {/* Header row */}
      <div className="flex items-center gap-2">
        {character.character_image_url ? (
          <img
            src={charImageUrl(character.character_image_url)!}
            alt={character.name}
            className="w-10 h-10 rounded-md object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-slate-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 font-medium truncate">{character.name}</p>
          {isPrimary && (
            <span className="text-[9px] text-amber-400 uppercase tracking-wider font-bold">
              Primary
            </span>
          )}
        </div>
        {!isPrimary && (
          <button
            onClick={onRemove}
            className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
            title="Remove from project"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* TTS Model selector */}
      {modelEntries.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">TTS Model</label>
          <select
            value={currentModel}
            onChange={(e) => onVoiceChange(e.target.value, "")}
            className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500"
          >
            {modelEntries.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Voice picker */}
      {voices.length > 0 && (
        <VoicePicker
          voices={voices}
          selectedId={currentVoiceId}
          onSelect={(id) => onVoiceChange(currentModel, id)}
          placeholder="Select a voice..."
        />
      )}
    </div>
  );
}
