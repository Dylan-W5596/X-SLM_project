from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import os
import sys
import io

# 強制設定標準輸出為 UTF-8 以解決 Windows CP950/Big5 編碼問題
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 將當前目錄加入路徑
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_db, ChatSession, Message
from model_engine import ModelEngine
import logging
from rich.logging import RichHandler
from rich.console import Console
from rich.panel import Panel

# 設定 Rich 終端機
console = Console()

# 配置日誌
logging.basicConfig(
    level="INFO",
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True, console=console)]
)

# 取得 uvicorn 的 access logger 並過濾
class AccessLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # 過濾掉 status code 為 200 的訊息，保持介面乾淨
        return " 200 OK" not in record.getMessage()

logging.getLogger("uvicorn.access").addFilter(AccessLogFilter())
log = logging.getLogger("uvicorn")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    console.print(Panel("[bold green]後端伺服器啟動成功[/bold green]", title="系統狀態", border_style="green"))
    # 初始化資料庫
    init_db()
    yield
    console.print("[yellow]應用程式關閉中...[/yellow]")

app = FastAPI(title="Llama Electron API", lifespan=lifespan)

# 啟用 Electron 的 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 准許所有來源
    allow_credentials=True,
    allow_methods=["*"], # 准許所有動作 (GET, POST, DELETE...)
    allow_headers=["*"], # 准許所有表頭 (Content-Type 等)
)

# 初始化 AI 引擎 (延遲載入)
model_engine = ModelEngine()

# Pydantic 資料驗證
class GroupCreate(BaseModel):
    name: str = "未分類"

class GroupUpdate(BaseModel):
    name: Optional[str] = None # Optional表可有可無
    order: Optional[int] = None

class CreateSession(BaseModel):
    title: str = "New Chat"
    group_id: Optional[int] = None

class SessionMove(BaseModel):
    group_id: Optional[int] = None
    order: int

class CreateMessage(BaseModel):
    session_id: int
    content: str
    role: str = "user" # 預設為 user

class ChatResponse(BaseModel):
    role: str
    content: str 

@app.get("/status")
def get_status():
    return {
        "status": "running",
        "model_loaded": model_engine.is_loaded(),
        "device": "cuda" if model_engine.has_gpu else "cpu"
    }

# --- 群組 API ---
@app.get("/groups")
def list_groups(db: Session = Depends(get_db)):
    from database import Group
    return db.query(Group).order_by(Group.order.asc()).all()

@app.post("/groups")
def create_group(group_data: GroupCreate, db: Session = Depends(get_db)):
    from database import Group
    # 取得當前最大 order
    max_order = db.query(Group).count()
    new_group = Group(name=group_data.name, order=max_order)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return new_group

@app.patch("/groups/{group_id}")
def update_group(group_id: int, group_data: GroupUpdate, db: Session = Depends(get_db)):
    from database import Group
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group_data.name is not None:
        group.name = group_data.name
    if group_data.order is not None:
        group.order = group_data.order
    db.commit()
    db.refresh(group)
    return group

@app.delete("/groups/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db)):
    from database import Group
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    # 將該群組下的所有會話轉為 uncategorized (group_id = None)
    db.query(ChatSession).filter(ChatSession.group_id == group_id).update({ChatSession.group_id: None})
    db.delete(group)
    db.commit()
    return {"status": "success"}

# --- 會話 API ---
@app.post("/sessions")
def create_session(session_data: CreateSession, db: Session = Depends(get_db)):
    # 取得該群組下的最大 order
    count = db.query(ChatSession).filter(ChatSession.group_id == session_data.group_id).count()
    new_session = ChatSession(title=session_data.title, group_id=session_data.group_id, order=count)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@app.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    # 回傳所有會話，包含群組資訊，並依群組順序與會話順序排列
    return db.query(ChatSession).order_by(ChatSession.group_id.asc(), ChatSession.order.asc()).all()

@app.patch("/sessions/{session_id}/move")
def move_session(session_id: int, move_data: SessionMove, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # 跨組移動或同組排序
    session.group_id = move_data.group_id
    session.order = move_data.order
    # 簡單起見，我們不處理其他會話的連鎖 reorder
    # 在前端我們會處理好順序發送過來
    db.commit()
    db.refresh(session)
    return session

@app.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    # 依賴 SQLAlchemy 的 cascade="all, delete-orphan" 自動刪除訊息
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"status": "success"}

@app.patch("/sessions/{session_id}")
def update_session(session_id: int, session_data: CreateSession, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = session_data.title
    db.commit()
    db.refresh(session)
    return session

@app.get("/sessions/{session_id}/messages")
def get_history(session_id: int, db: Session = Depends(get_db)):
    return db.query(Message).filter(Message.session_id == session_id).order_by(Message.timestamp.asc()).all()

@app.post("/chat")
def chat(message: CreateMessage, db: Session = Depends(get_db)):
    # 1. 儲存使用者訊息
    user_msg = Message(session_id=message.session_id, role="user", content=message.content)
    db.add(user_msg)
    db.commit()
    
    # 2. 生成回應
    # 取得上下文 (取最後 10 則訊息)
    history = db.query(Message).filter(Message.session_id == message.session_id).order_by(Message.timestamp.asc()).all()
    context = [{"role": m.role, "content": m.content} for m in history]
    
    response_text = model_engine.generate(context)
    
    # 3. 儲存助手訊息
    ai_msg = Message(session_id=message.session_id, role="assistant", content=response_text)
    db.add(ai_msg)
    db.commit()
    
    return {"role": "assistant", "content": response_text}

@app.post("/switch_model")
def switch_model(data: dict):
    model_id = data.get("model_id")
    print(model_id)
    if not model_id:
        raise HTTPException(status_code=400, detail="Model ID is required")
    
    try:
        model_engine.switch_model(model_id)
        return {"status": "success", "current_model": model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/stream")
def chat_stream():
    return {"error": "串流功能在此最小版本中尚未實作"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
