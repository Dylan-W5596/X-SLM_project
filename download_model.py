import os
import urllib.request
import sys

# 模型資訊配置
MODELS = {
    "Llama-3.2-1B": {
        "url": "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q8_0.gguf",
        "filename": "Llama-3.2-1B-Instruct-Q8_0.gguf"
    },
    "Gemma3-4B": {
        "url": "https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf",
        "filename": "Gemma3_4b_it_Q4_K_M.gguf"
    }
}

MODEL_DIR = "models"

def download_model(model_key):
    info = MODELS.get(model_key)
    if not info:
        print(f"錯誤: 找不到模型 {model_key}")
        return

    model_path = os.path.join(MODEL_DIR, info["filename"])
    
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
    
    if os.path.exists(model_path):
        print(f"模型 [{model_key}] 已存在於 {model_path}")
        return

    print(f"正在從 {info['url']} 下載模型 [{model_key}]...")
    
    def reporthook(blocknum, blocksize, totalsize):
        readsoar = blocknum * blocksize
        if totalsize > 0:
            percent = readsoar * 1e2 / totalsize
            s = "\r%5.1f%% %*d / %d" % (
                percent, len(str(totalsize)), readsoar, totalsize)
            sys.stderr.write(s)
            if readsoar >= totalsize:
                sys.stderr.write("\n")
    
    try:
        urllib.request.urlretrieve(info["url"], model_path, reporthook)
        print(f"[{model_key}] 下載完成。")
    except Exception as e:
        print(f"下載失敗: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("請選擇要下載的模型：")
    print("1. Llama-3.2-1B (預設)")
    print("2. Gemma3-4B (最新/較強)")
    
    choice = input("輸入選項 (1 或 2，預設 1): ").strip()
    
    if choice == "2":
        download_model("Gemma3-4B")
    else:
        download_model("Llama-3.2-1B")
