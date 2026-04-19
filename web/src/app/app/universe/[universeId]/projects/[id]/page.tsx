"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { Film, ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeftPanel, type LeftPanelTab } from "@/components/editor/LeftPanel";
import { EditorTimeline } from "@/components/editor/EditorTimeline";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { NodeInspector } from "@/components/workflow/NodeInspector";
import { WorkflowToolbar } from "@/components/workflow/WorkflowToolbar";
import { useUnifiedEditor } from "@/hooks/use-unified-editor";
import type { SegmentTiming } from "@/components/editor/VideoPreview";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function EditorSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-black">
      <div className="flex items-center justify-between px-3 h-10 bg-black">
        <div className="flex items-center gap-3">
          <div className="w-20 h-6 rounded-md bg-slate-800 animate-pulse" />
          <div className="w-px h-5 bg-slate-800" />
          <div className="w-48 h-5 rounded bg-slate-800 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-7 rounded-md bg-slate-800 animate-pulse" />
          <div className="w-20 h-7 rounded-md bg-amber-500/20 animate-pulse" />
        </div>
      </div>
      <div className="flex-1 flex min-h-0 gap-1.5 px-1.5 pt-1.5">
        <div className="w-[320px] bg-slate-900/80 rounded-lg p-3 space-y-2 shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 animate-pulse">
              <div className="w-8 h-12 rounded bg-slate-700 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="w-16 h-3 rounded bg-slate-700" />
                <div className="w-24 h-2.5 rounded bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center bg-slate-950 rounded-lg">
          <div className="text-slate-600 text-sm">Loading workflow...</div>
        </div>
        <div className="w-[320px] bg-slate-900/80 rounded-lg p-3 shrink-0" />
      </div>
      <div className="px-1.5 pb-1.5 pt-1.5">
        <div className="bg-slate-900/80 rounded-lg p-3 h-24 animate-pulse" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message, universeId }: { message: string; universeId: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 gap-6">
      <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
        <Film className="w-9 h-9 text-slate-600" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white">Project Not Found</h2>
        <p className="text-sm text-slate-400 max-w-md">{message}</p>
      </div>
      <Button asChild variant="ghost">
        <Link href={`/app/universe/${universeId}`}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Needs Story CTA
// ---------------------------------------------------------------------------

function NeedsStoryCTA() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
      <Sparkles className="w-12 h-12 text-slate-600" />
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium text-slate-300">No Story Yet</h3>
        <p className="text-sm text-slate-500 max-w-md">
          Generate a story first to create your workflow pipeline.
          Use Claude via MCP or the Generate Story API to get started.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ProjectEditorPage({
  params,
}: {
  params: Promise<{ universeId: string; id: string }>;
}) {
  const { universeId, id } = use(params);

  const editor = useUnifiedEditor(id, universeId);

  // Local UI state
  const [activeLeftTab, setActiveLeftTab] = useState<LeftPanelTab>("characters");
  const [playbackProgress, setPlaybackProgress] = useState<number | null>(null);
  const [actualSegments, setActualSegments] = useState<SegmentTiming[]>();
  const [actualTotalDuration, setActualTotalDuration] = useState<number>();
  const [audioDuration, setAudioDuration] = useState(0);

  // Timeline click → select scene + show its clip node in inspector
  const handleSelectSceneFromList = useCallback(
    (sceneId: string) => {
      editor.selectScene(sceneId);
      const scene = editor.scenes.find((s) => s.id === sceneId);
      if (!scene || !editor.workflow) return;

      // Use stored node ID (set by backend, survives reorder)
      const storedId = scene.clip_node_id || scene.keyframe_node_id;
      if (storedId && editor.workflow.nodes[storedId]) {
        editor.setSelectedNode(storedId);
      }
    },
    [editor]
  );

  const handleSelectTransition = useCallback(
    (from: number, to: number) => {
      editor.selectElement({ type: "transition", fromSceneId: from, toSceneId: to });
    },
    [editor]
  );

  // Handle image drop from media gallery → creates character_ref node
  const handleDropImage = useCallback(
    async (imageUrl: string, label: string, position: { x: number; y: number }) => {
      if (!editor.workflow) return;
      try {
        const { addWorkflowNode } = await import("@/lib/api");
        const result = await addWorkflowNode({
          workflow_id: id, // workflow_id is the project_id in the API
          type: "character_ref",
          label,
          params: { image_url: imageUrl },
          inputs: {},
        });
        // Update the new node's outputs and status to show the image immediately
        const wf = result.workflow;
        const newNodeId = result.node_id;
        if (wf.nodes[newNodeId]) {
          wf.nodes[newNodeId].outputs = { url: imageUrl };
          wf.nodes[newNodeId].status = "completed";
          wf.nodes[newNodeId].position = position;
        }
        editor.setWorkflow(wf);
        // Save back with the updated outputs/status/position
        const { updateWorkflowFull } = await import("@/lib/api");
        await updateWorkflowFull(id, wf);
      } catch (err) {
        console.error("Failed to create node from drop:", err);
      }
    },
    [editor.workflow, editor.setWorkflow, id]
  );

  // ---------- Loading ----------
  if (editor.isLoading) return <EditorSkeleton />;
  if (editor.error || !editor.project) {
    return (
      <ErrorState
        message={editor.error || "This project could not be found or may have been deleted."}
        universeId={universeId}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* ============================================================ */}
      {/*  TOOLBAR                                                      */}
      {/* ============================================================ */}
      <WorkflowToolbar
        universeId={universeId}
        projectId={id}
        projectName={editor.project.name}
        onRenameProject={async (name) => {
          const { updateProject } = await import("@/lib/api");
          await updateProject(id, { name });
          editor.setProject({ ...editor.project!, name });
        }}
        clipsGenerated={editor.clipsGenerated}
        totalScenes={editor.scenes.length}
        totalDuration={actualTotalDuration ?? editor.totalDuration}
        allClipsDone={editor.allClipsDone}
        generatingAll={editor.generatingAll}
        allClipsProgress={editor.allClipsProgress}
        isRendering={editor.isRendering}
        renderProgress={editor.renderProgress}
        isPublishing={editor.isPublishing}
        hasOutput={!!editor.project.output_path}
        isRendered={editor.project.status === "rendered"}
        onExecuteWorkflow={editor.handleExecuteWorkflow}
        onGenerateAll={editor.handleGenerateAllClips}
        onRender={editor.handleRender}
        onDownload={editor.handleDownload}
        onSelectFullVideo={() => editor.selectElement({ type: "full-video" })}
      />

      {/* ============================================================ */}
      {/*  MAIN 3-PANEL LAYOUT                                          */}
      {/* ============================================================ */}
      <div className="flex-1 flex min-h-0 gap-1.5 px-1.5 pt-1.5">
        {/* LEFT PANEL */}
        <div className="w-[320px] shrink-0 bg-slate-900/80 rounded-lg overflow-hidden">
          <LeftPanel
            scenes={editor.scenes}
            audioFilename={editor.project.uploaded_audio_path}
            characterPortraitUrl={editor.project.character_image_url}
            characterImages={editor.characterImages}
            activeTab={activeLeftTab}
            onTabChange={setActiveLeftTab}
            renders={editor.renders}
            onDownloadRender={editor.handleDownloadRender}
            onDeleteRender={editor.handleDeleteRender}
            textItems={editor.textItems}
            selectedTextId={editor.selectedElement?.type === "text" ? (editor.selectedElement as { type: "text"; id: string }).id : null}
            onSelectText={(textId) => editor.selectElement({ type: "text", id: textId })}
            onAddText={editor.handleAddText}
            onDeleteText={editor.handleDeleteText}
            universeId={universeId}
            projectId={id}
            characterId={editor.project.character_id}
            characterIdsJson={editor.project.character_ids_json}
            onCharacterIdsChange={(ids) => {
              editor.setProject({
                ...editor.project!,
                character_ids_json: JSON.stringify(ids),
              });
            }}
          />
        </div>

        {/* CENTER — WORKFLOW CANVAS */}
        <div className="flex-1 rounded-lg overflow-hidden bg-slate-950">
          {editor.needsStory ? (
            <NeedsStoryCTA />
          ) : editor.workflowLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
            </div>
          ) : (
            <WorkflowCanvas
              onExecuteNode={() => {
                editor.handleExecuteWorkflow();
              }}
              onDropImage={handleDropImage}
            />
          )}
        </div>

        {/* RIGHT PANEL — NODE INSPECTOR */}
        <div className="w-[320px] shrink-0 bg-slate-900/80 rounded-lg overflow-hidden">
          <NodeInspector
            scenes={editor.scenes}
            clipJobs={editor.clipJobs}
            isGenerating={editor.isGenerating}
            onGenerateKeyframe={editor.handleGenerateKeyframe}
            onRegenerateClip={editor.handleRegenerateClip}
            onExtractFrame={editor.handleExtractFrame}
            extractingFrame={editor.extractingFrame}
            characterImageUrl={editor.project?.character_image_url}
            pickerImages={editor.pickerImages}
            selectedElement={editor.selectedElement}
            selectedTransition={editor.selectedTransition}
            onUpdateTransition={(fromId, toId, updates) =>
              editor.handleUpdateTransition(fromId, toId, updates)
            }
            renderOpts={editor.renderOpts}
            setRenderOpts={editor.setRenderOpts}
            colorGrade={editor.colorGrade}
            onColorGradeChange={editor.handleColorGradeChange}
            onRender={editor.handleRender}
            onDownload={editor.handleDownload}
            isRendering={editor.isRendering}
            isPublishing={editor.isPublishing}
            project={editor.project}
            renders={editor.renders}
            onDownloadRender={editor.handleDownloadRender}
            onDeleteRender={editor.handleDeleteRender}
            universeId={universeId}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/*  TIMELINE                                                     */}
      {/* ============================================================ */}
      {editor.scenes.length > 0 && (
        <div className="px-1.5 pb-1.5 pt-1.5">
          <EditorTimeline
            scenes={editor.scenes}
            transitions={editor.transitions}
            selectedSceneId={editor.selectedSceneId}
            selectedTransition={editor.selectedTransition ? { fromSceneId: editor.selectedTransition.from_scene_id, toSceneId: editor.selectedTransition.to_scene_id } : null}
            onSelectScene={handleSelectSceneFromList}
            onSelectTransition={handleSelectTransition}
            playbackProgress={playbackProgress}
            actualSegments={actualSegments}
            audioFilename={editor.project?.uploaded_audio_path}
            audioDuration={editor.audioDuration}
            textItems={editor.textItems}
            selectedTextId={editor.selectedElement?.type === "text" ? (editor.selectedElement as { type: "text"; id: string }).id : null}
            onSelectText={(textId) => editor.selectElement({ type: "text", id: textId })}
            onUpdateScene={editor.handleUpdateScene}
            onUpdateTransition={editor.handleUpdateTransition}
            onUpdateTextItem={(textId, updates) => editor.handleUpdateText(textId, updates)}
            onReorderScenes={editor.handleReorderScenes}
          />
        </div>
      )}
    </div>
  );
}
