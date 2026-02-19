# 如何執行應用程式 (How to Run)

## 前置需求
1.  **Python 3.10+**: 請確保已安裝 Python。
2.  **Node.js**: 請確保已安裝 Node.js 與 npm。
3.  **CUDA (選用但推薦)**: 若要使用 GPU 加速，請安裝 NVIDIA CUDA Toolkit。

## 首次安裝
1.  **後端設定** (已自動完成部分):
    ```bash
    # 在專案根目錄
    python -m venv venv
    .\venv\Scripts\activate
    pip install -r backend/requirements.txt
    # 安裝 CUDA 版 llama-cpp-python (若之前失敗)
    pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu124
    ```

2.  **下載模型** (已自動完成部分):
    確保 `models/` 資料夾內有模型檔案。若不存在，請執行：
    ```bash
    .\venv\Scripts\python download_model.py
    ```
    *   你可以選擇下載 **Llama-3.2-1B** (輕量) 或 **Gemma3-4B** (最新強大)。

3.  **前端設定**:
    ```bash
    cd frontend
    npm install
    ```

## 啟動應用程式 (Dev模式)
在 `frontend` 資料夾中執行：
```bash
npm run electron:dev
```
這將會：
1.  啟動 Vite 開發伺服器。
2.  等待伺服器就緒。
3.  啟動 Electron 視窗。
4.  Electron 主程序會自動啟動 Python 後端。

## 常見問題
- **後端無法啟動**: Check console logs in Electron window or terminal. Manual run: `..\venv\Scripts\python ..\backend\main.py`
- **模型載入失敗**: 確保模型檔案完整且路徑正確。
- **CUDA 錯誤**: 確保安裝了正確版本的 `llama-cpp-python` wheels。

## Python依賴套件
- fastapi
- uvicorn
- pydantic
- sqlalchemy
- python-multipart

We will install llama-cpp-python separately with specific flags for CUDA