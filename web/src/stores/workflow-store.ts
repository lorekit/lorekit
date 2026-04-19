import { create } from "zustand";
import type { Workflow, WorkflowNode } from "@/lib/api";

interface WorkflowState {
  workflow: Workflow | null;
  selectedNodeId: string | null;
  setWorkflow: (wf: Workflow | null) => void;
  setSelectedNode: (id: string | null) => void;
  updateNodeStatus: (nodeId: string, status: WorkflowNode["status"]) => void;
  updateNodeParams: (nodeId: string, params: Record<string, any>) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  addNodeInput: (targetNodeId: string, inputKey: string, sourceRef: string) => void;
  removeNodeInput: (targetNodeId: string, inputKey: string) => void;
  selectedNode: () => WorkflowNode | null;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflow: null,
  selectedNodeId: null,

  setWorkflow: (workflow) => {
    // Auto-deduplicate ref inputs on load
    if (workflow) {
      for (const node of Object.values(workflow.nodes)) {
        const refKeys = Object.keys(node.inputs).filter((k) => k.startsWith("ref_"));
        const seenSources = new Set<string>();
        for (const key of refKeys) {
          const sourceNodeId = node.inputs[key].split(".")[0];
          if (seenSources.has(sourceNodeId)) {
            delete node.inputs[key];
          } else {
            seenSources.add(sourceNodeId);
          }
        }
        // Compact: re-number ref slots to remove gaps (ref_1, ref_3 → ref_1, ref_2)
        const remaining = refKeys
          .filter((k) => node.inputs[k])
          .map((k) => node.inputs[k]);
        // Remove all old ref keys
        for (const k of refKeys) delete node.inputs[k];
        // Re-assign compacted
        remaining.forEach((ref, i) => {
          node.inputs[`ref_${i + 1}`] = ref;
        });
      }
    }
    set({ workflow });
  },

  setSelectedNode: (selectedNodeId) => set({ selectedNodeId }),

  updateNodeStatus: (nodeId, status) =>
    set((state) => {
      if (!state.workflow) return state;
      const node = state.workflow.nodes[nodeId];
      if (!node) return state;
      return {
        workflow: {
          ...state.workflow,
          nodes: {
            ...state.workflow.nodes,
            [nodeId]: { ...node, status },
          },
        },
      };
    }),

  updateNodeParams: (nodeId, params) =>
    set((state) => {
      if (!state.workflow) return state;
      const node = state.workflow.nodes[nodeId];
      if (!node) return state;
      return {
        workflow: {
          ...state.workflow,
          nodes: {
            ...state.workflow.nodes,
            [nodeId]: { ...node, params: { ...node.params, ...params } },
          },
        },
      };
    }),

  updateNodeLabel: (nodeId, label) =>
    set((state) => {
      if (!state.workflow) return state;
      const node = state.workflow.nodes[nodeId];
      if (!node) return state;
      return {
        workflow: {
          ...state.workflow,
          nodes: {
            ...state.workflow.nodes,
            [nodeId]: { ...node, label },
          },
        },
      };
    }),

  updateNodePosition: (nodeId, position) =>
    set((state) => {
      if (!state.workflow) return state;
      const node = state.workflow.nodes[nodeId];
      if (!node) return state;
      return {
        workflow: {
          ...state.workflow,
          nodes: {
            ...state.workflow.nodes,
            [nodeId]: { ...node, position },
          },
        },
      };
    }),

  addNodeInput: (targetNodeId, inputKey, sourceRef) =>
    set((state) => {
      if (!state.workflow) return state;
      const node = state.workflow.nodes[targetNodeId];
      if (!node) return state;
      return {
        workflow: {
          ...state.workflow,
          nodes: {
            ...state.workflow.nodes,
            [targetNodeId]: { ...node, inputs: { ...node.inputs, [inputKey]: sourceRef } },
          },
        },
      };
    }),

  removeNodeInput: (targetNodeId, inputKey) =>
    set((state) => {
      if (!state.workflow) return state;
      const node = state.workflow.nodes[targetNodeId];
      if (!node) return state;
      const { [inputKey]: _, ...remainingInputs } = node.inputs;
      return {
        workflow: {
          ...state.workflow,
          nodes: {
            ...state.workflow.nodes,
            [targetNodeId]: { ...node, inputs: remainingInputs },
          },
        },
      };
    }),

  removeNode: (nodeId) =>
    set((state) => {
      if (!state.workflow) return state;
      const { [nodeId]: _, ...remainingNodes } = state.workflow.nodes;
      // Remove any inputs referencing this node from other nodes
      const cleaned: Record<string, WorkflowNode> = {};
      for (const [id, node] of Object.entries(remainingNodes)) {
        const newInputs: Record<string, string> = {};
        for (const [key, ref] of Object.entries(node.inputs)) {
          if (!ref.startsWith(nodeId)) {
            newInputs[key] = ref;
          }
        }
        cleaned[id] = { ...node, inputs: newInputs };
      }
      return {
        workflow: { ...state.workflow, nodes: cleaned },
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      };
    }),

  selectedNode: () => {
    const state = get();
    if (!state.workflow || !state.selectedNodeId) return null;
    return state.workflow.nodes[state.selectedNodeId] ?? null;
  },
}));
