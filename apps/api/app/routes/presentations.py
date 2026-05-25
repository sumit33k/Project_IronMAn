import base64
import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/presentations", tags=["presentations"])


@router.post("/download")
async def download_pptx(payload: dict):
    pptx_base64 = payload.get("pptx_base64", "")
    filename = payload.get("filename", "jarvis-presentation.pptx")
    if not pptx_base64:
        raise HTTPException(400, "No pptx_base64 in payload")
    try:
        pptx_bytes = base64.b64decode(pptx_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 data")
    return StreamingResponse(
        io.BytesIO(pptx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
