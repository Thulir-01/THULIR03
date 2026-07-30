"""
THULIR03 — Instrument Middleware
Python FastAPI service for ASTM E1394 / HL7 v2.x instrument communication.
"""

import os
import logging
from fastapi import FastAPI, HTTPException, Security, Header
from pydantic import BaseModel
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("thulir-middleware")

app = FastAPI(
    title="THULIR03 Instrument Middleware",
    description="ASTM E1394 / HL7 v2.x instrument communication service",
    version="0.1.0",
)


class InstrumentMessage(BaseModel):
    instrument_id: str
    raw_message: str
    protocol: str = "HL7"  # HL7 or ASTM
    received_at: Optional[str] = None


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "thulir03-instrument-middleware",
        "version": "0.1.0",
    }


@app.post("/instruments/webhook")
async def instrument_webhook(
    message: InstrumentMessage,
    x_api_key: str = Header(None),
):
    """
    Webhook endpoint for parsed instrument results.

    Called by the instrument middleware's core processing pipeline
    when an instrument message has been parsed and normalized.
    Forwards to the core API for result entry.
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")

    logger.info(
        "Received instrument message: instrument=%s protocol=%s",
        message.instrument_id,
        message.protocol,
    )

    # TODO: Parse and forward to core API via BullMQ / HTTP
    return {
        "status": "received",
        "instrument_id": message.instrument_id,
        "protocol": message.protocol,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("INSTRUMENT_MIDDLEWARE_PORT", "8000"))
    host = os.getenv("INSTRUMENT_MIDDLEWARE_HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
