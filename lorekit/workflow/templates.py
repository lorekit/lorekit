"""Pre-built workflow templates for common video production patterns.

Each template function creates a Workflow with pre-connected nodes.
Templates are the starting point — Claude or the user can modify the
graph after creation.
"""

from __future__ import annotations

from typing import Any

from lorekit.workflow.models import Workflow, WorkflowNode


def ugc_reaction(
    project_id: str,
    character_image_url: str,
    prompt: str,
    duration: int = 5,
    character_ref_urls: list[str] | None = None,
    aspect_ratio: str = "9:16",
) -> Workflow:
    """Single UGC reaction clip: keyframe → video → download.

    The simplest workflow — one character scene with identity-preserving keyframe.
    """
    wf = Workflow(project_id=project_id, name="UGC Reaction")

    # Node 1: Generate keyframe from character portrait
    kf = WorkflowNode(
        type="kontext_keyframe",
        label="Reaction Keyframe",
        params={
            "prompt": prompt,
            "reference_images": [character_image_url] + (character_ref_urls or []),
            "aspect_ratio": aspect_ratio,
        },
        position={"x": 0, "y": 100},
    )
    wf.add_node(kf)

    # Node 2: Generate video from keyframe
    ref_urls = list(dict.fromkeys([character_image_url] + (character_ref_urls or [])))[:5]
    vid = WorkflowNode(
        type="kling_v3_pro",
        label="Reaction Video",
        params={
            "prompt": prompt,
            "duration": duration,
            "elements": [
                {
                    "frontal_image_url": character_image_url,
                    "reference_image_urls": ref_urls,
                }
            ],
        },
        inputs={"start_image": f"{kf.id}.outputs.url"},
        position={"x": 300, "y": 100},
    )
    wf.add_node(vid)

    # Node 3: Download the generated clip
    dl = WorkflowNode(
        type="download",
        label="Save Clip",
        params={"dest_path": f"projects/{project_id}/clips/scene_001.mp4"},
        inputs={"url": f"{vid.id}.outputs.url"},
        position={"x": 600, "y": 100},
    )
    wf.add_node(dl)

    return wf


def multi_scene(
    project_id: str,
    character_image_url: str,
    scenes: list[dict[str, Any]],
    character_ref_urls: list[str] | None = None,
    aspect_ratio: str = "9:16",
) -> Workflow:
    """Multi-scene video: parallel keyframe+video branches → stitch.

    Each scene gets its own keyframe and video node, all running in parallel.
    A final stitch node assembles them in order.
    """
    wf = Workflow(project_id=project_id, name="Multi-Scene Video")

    ref_urls = list(dict.fromkeys([character_image_url] + (character_ref_urls or [])))[:5]
    clip_node_ids: list[str] = []

    for i, scene in enumerate(scenes):
        y_pos = i * 180

        # Keyframe
        kf = WorkflowNode(
            type="kontext_keyframe",
            label=f"Scene {i+1} Keyframe",
            params={
                "prompt": scene.get("prompt", ""),
                "reference_images": [character_image_url],
                "aspect_ratio": aspect_ratio,
            },
            position={"x": 0, "y": y_pos},
        )
        wf.add_node(kf)

        # Video
        vid = WorkflowNode(
            type="kling_v3_pro",
            label=f"Scene {i+1} Video",
            params={
                "prompt": scene.get("prompt", ""),
                "duration": scene.get("duration", 5),
                "elements": [
                    {
                        "frontal_image_url": character_image_url,
                        "reference_image_urls": ref_urls,
                    }
                ] if scene.get("character_present", True) else [],
            },
            inputs={"start_image": f"{kf.id}.outputs.url"},
            position={"x": 300, "y": y_pos},
        )
        wf.add_node(vid)
        clip_node_ids.append(vid.id)

    # Stitch all clips together
    stitch = WorkflowNode(
        type="ffmpeg_stitch",
        label="Stitch All Scenes",
        params={"output_path": f"projects/{project_id}/renders/stitched.mp4"},
        inputs={f"clip_{i}": f"{nid}.outputs.url" for i, nid in enumerate(clip_node_ids)},
        position={"x": 600, "y": len(scenes) * 90},
    )
    wf.add_node(stitch)

    return wf


def face_swap_ugc(
    project_id: str,
    source_face_url: str,
    character_image_url: str,
    prompt: str,
    duration: int = 5,
    aspect_ratio: str = "9:16",
) -> Workflow:
    """UGC clip with face swap: keyframe → face_swap → video.

    Generates a keyframe with the character, swaps in your face,
    then generates video from the swapped keyframe.
    """
    wf = Workflow(project_id=project_id, name="Face Swap UGC")

    # Keyframe from character
    kf = WorkflowNode(
        type="kontext_keyframe",
        label="Base Keyframe",
        params={
            "prompt": prompt,
            "reference_images": [character_image_url],
            "aspect_ratio": aspect_ratio,
        },
        position={"x": 0, "y": 100},
    )
    wf.add_node(kf)

    # Face swap
    swap = WorkflowNode(
        type="face_swap",
        label="Swap Face",
        params={"source_face": source_face_url},
        inputs={"target_image": f"{kf.id}.outputs.url"},
        position={"x": 300, "y": 100},
    )
    wf.add_node(swap)

    # Video from swapped keyframe
    vid = WorkflowNode(
        type="kling_v3_pro",
        label="Generate Video",
        params={
            "prompt": prompt,
            "duration": duration,
            "elements": [
                {
                    "frontal_image_url": source_face_url,
                    "reference_image_urls": [source_face_url],
                }
            ],
        },
        inputs={"start_image": f"{swap.id}.outputs.url"},
        position={"x": 600, "y": 100},
    )
    wf.add_node(vid)

    return wf


# Template registry
WORKFLOW_TEMPLATES: dict[str, dict] = {
    "ugc_reaction": {
        "name": "UGC Reaction",
        "description": "Single selfie reaction clip (keyframe → video → download)",
        "function": "ugc_reaction",
        "required_params": ["character_image_url", "prompt"],
    },
    "multi_scene": {
        "name": "Multi-Scene Video",
        "description": "Parallel scene generation with final stitch",
        "function": "multi_scene",
        "required_params": ["character_image_url", "scenes"],
    },
    "face_swap_ugc": {
        "name": "Face Swap UGC",
        "description": "Generate scene, swap face, animate (keyframe → swap → video)",
        "function": "face_swap_ugc",
        "required_params": ["source_face_url", "character_image_url", "prompt"],
    },
}


def create_from_template(
    template_id: str,
    project_id: str,
    **kwargs: Any,
) -> Workflow:
    """Create a workflow from a named template."""
    if template_id not in WORKFLOW_TEMPLATES:
        raise KeyError(f"Unknown template {template_id!r}. Choose from: {list(WORKFLOW_TEMPLATES)}")

    func_name = WORKFLOW_TEMPLATES[template_id]["function"]
    func = globals()[func_name]
    return func(project_id=project_id, **kwargs)


def list_templates() -> list[dict]:
    """List available workflow templates."""
    return [
        {"id": tid, **{k: v for k, v in info.items() if k != "function"}}
        for tid, info in WORKFLOW_TEMPLATES.items()
    ]
