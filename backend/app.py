"""
app.py — FastAPI application entry point.

Registers route modules and the WebSocket endpoint.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from websocket_manager import manager
from routes.dashboard_routes import router as dashboard_router
from routes.product_routes import router as product_router
from routes.sales_routes import router as sales_router
from routes.forecast_routes import router as forecast_router
from routes.supplier_routes import router as supplier_router
from routes.purchase_routes import router as purchase_router

# ── Login route (stays minimal here) ──────────────────────────────────────────
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from auth import USERS, generate_token

auth_router = APIRouter()


class LoginRequest(BaseModel):
    username: str = Field(..., description="Username")
    password: str = Field(..., description="Password")


@auth_router.post("/login", tags=["Authentication"])
async def login(credentials: LoginRequest):
    user = USERS.get(credentials.username)
    if not user or user["password"] != credentials.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = generate_token(credentials.username, user["role"])
    return {"token": token, "username": credentials.username, "role": user["role"]}


# ── App setup ──────────────────────────────────────────────────────────────────
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Inventory Management System API",
    description="API for managing inventory, products, and sales with reorder tracking",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth_router)
app.include_router(product_router)
app.include_router(sales_router)
app.include_router(dashboard_router)
app.include_router(forecast_router)
app.include_router(supplier_router)
app.include_router(purchase_router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time inventory updates."""
    await manager.connect(websocket)
    try:
        await manager.send_personal_message(
            {"event": "connected", "data": {"message": "Connected to inventory updates"}},
            websocket,
        )
        while True:
            await websocket.receive_text()
            await manager.send_personal_message({"event": "pong", "data": {"message": "pong"}}, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client disconnected")
    except Exception as exc:
        logger.error(f"WebSocket error: {exc}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=5000, reload=True)
