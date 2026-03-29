"""API endpoints for character documents (knowledge base)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lorekit import db
from lorekit.sources.chunker import chunk_text

router = APIRouter(
    prefix="/api/universes/{universe_id}/characters/{character_id}/documents",
    tags=["documents"],
)


class DocumentCreate(BaseModel):
    name: str
    doc_type: str = "text"
    content: str


class DocumentResponse(BaseModel):
    id: str
    character_id: str
    universe_id: str
    name: str
    doc_type: str
    content: str | None
    file_path: str | None
    file_size_bytes: int
    chunk_count: int
    status: str
    metadata_json: str | None
    created_at: str
    updated_at: str


async def _verify_character(universe_id: str, character_id: str) -> None:
    """Verify that the character exists and belongs to the universe."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            "SELECT id FROM characters WHERE id = ? AND universe_id = ?",
            (character_id, universe_id),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Character not found in this universe")
    finally:
        await conn.close()


@router.post("/", response_model=DocumentResponse)
async def create_document(
    universe_id: str,
    character_id: str,
    body: DocumentCreate,
):
    """Create a new document for a character."""
    await _verify_character(universe_id, character_id)

    doc_id = uuid.uuid4().hex[:12]
    doc = await db.create_document(
        doc_id=doc_id,
        character_id=character_id,
        universe_id=universe_id,
        name=body.name,
        doc_type=body.doc_type,
        content=body.content,
        file_size_bytes=len(body.content.encode("utf-8")) if body.content else 0,
    )
    return doc


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(
    universe_id: str,
    character_id: str,
):
    """List all documents for a character."""
    await _verify_character(universe_id, character_id)
    return await db.list_documents_by_character(character_id)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    universe_id: str,
    character_id: str,
    document_id: str,
):
    """Get a single document."""
    doc = await db.get_document(document_id)
    if not doc or doc["character_id"] != character_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}")
async def delete_document(
    universe_id: str,
    character_id: str,
    document_id: str,
):
    """Delete a document and its chunks."""
    doc = await db.get_document(document_id)
    if not doc or doc["character_id"] != character_id:
        raise HTTPException(status_code=404, detail="Document not found")
    deleted = await db.delete_document(document_id)
    return {"deleted": deleted}


@router.post("/{document_id}/process")
async def process_document(
    universe_id: str,
    character_id: str,
    document_id: str,
):
    """Chunk a document's content and store chunks. Updates status to 'ready'."""
    doc = await db.get_document(document_id)
    if not doc or doc["character_id"] != character_id:
        raise HTTPException(status_code=404, detail="Document not found")

    content = doc.get("content") or ""
    if not content.strip():
        raise HTTPException(status_code=400, detail="Document has no content to process")

    # Update status to processing
    await db.update_document(document_id, status="processing")

    # Delete any existing chunks (re-processing)
    await db.delete_chunks_by_document(document_id)

    # Chunk the content
    chunks = chunk_text(content)

    # Store chunks
    for chunk_data in chunks:
        chunk_id = uuid.uuid4().hex[:12]
        await db.create_chunk(
            chunk_id=chunk_id,
            document_id=document_id,
            character_id=character_id,
            chunk_index=chunk_data["index"],
            content=chunk_data["content"],
            token_count=chunk_data["token_count"],
        )

    # Update document status and chunk count
    await db.update_document(document_id, status="ready", chunk_count=len(chunks))

    return {"chunks_created": len(chunks)}
