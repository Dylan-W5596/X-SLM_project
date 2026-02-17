import { useState, useEffect, useRef } from 'react';
import { api } from './api';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import Settings from './components/Settings';
import Home from './components/Home';
import Credits from './components/Credits';
import { playSound } from './utils/soundUtils';
import { languages } from './translations/languages';
import assistantAvatar from './assets/icons/IM742001_account_circle_24dp.png';
import './styles/theme_variables.css';
import './styles/base.css';
import './styles/Chat.css';

const { ipcRenderer } = (window.require && window.require('electron')) || { ipcRenderer: null };

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState('home'); // 'home', 'chat', or 'settings'
  const [hasSeenEntryAnim, setHasSeenEntryAnim] = useState(false);
  const [isEnteringChat, setIsEnteringChat] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedModel, setSelectedModel] = useState('Llama_3.2_1B_It_Q8_0'); // 預設 llama
  const [isModelLoading, setIsModelLoading] = useState(false); // Model是否Loading
  const abortControllerRef = useRef(null); // 中止機制
  const messagesEndRef = useRef(null);
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('llama_config');
    return saved ? JSON.parse(saved) : {
      theme: 'dark',
      temperature: 0.7,
      maxTokens: 512,
      soundEnabled: true,
      language: 'en',
    };
  });

  //取得當前語系
  const t = languages[config.language] || languages.zh;

  // 存檔設定  * useEffect用法為副作用
  useEffect(() => {
    localStorage.setItem('llama_config', JSON.stringify(config));
    document.body.dataset.theme = config.theme;
  }, [config]); //* 1.無陣列表每次渲染執行 2.空陣列表只在最初執行一次 3.有陣列表陣列有變化值執行

  // 初始化, 抓取數據
  useEffect(() => {
    const init = async () => {
      try {
        const [gs, ss] = await Promise.all([api.getGroups(), api.getSessions()]);
        setGroups(gs);
        setSessions(ss);

        if (ss.length === 0) {
          await handleNewChat();
        } else {
          handleLoadSession(ss[0].id);
        }
      } catch (e) {
        console.warn("初始化失敗 (後端可能未啟動)", e.message);
      }
    };
    init();
  }, []);

  // 自動捲動
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 更新數據
  const fetchData = async () => {
    try {
      const [gs, ss] = await Promise.all([api.getGroups(), api.getSessions()]);
      setGroups(gs);
      setSessions(ss);
    } catch (e) {
      console.error("更新數據失敗", e);
    }
  };

  //新增聊天室
  const handleNewChat = async (groupId = null) => {
    playSound('click', config.soundEnabled);
    try {
      const data = await api.createSession('New Chat', groupId);
      setSessionId(data.id);
      setMessages([]);
      await fetchData();
    } catch (e) {
      playSound('error', config.soundEnabled);
      console.error("建立會話失敗", e);
    }
  };

  //載入聊天室
  const handleLoadSession = async (id) => {
    playSound('click', config.soundEnabled);
    try {
      setSessionId(id);
      const data = await api.getMessages(id);
      setMessages(data);
    } catch (e) {
      playSound('error', config.soundEnabled);
      console.error("載入失敗", e);
    }
  };

  //刪除聊天室
  const handleDeleteSession = async (id) => {
    if (!window.confirm('確定要刪除此對話紀錄嗎？')) return;
    playSound('click', config.soundEnabled);
    try {
      await api.deleteSession(id);
      playSound('success', config.soundEnabled);

      // 更新列表
      const [gs, ss] = await Promise.all([api.getGroups(), api.getSessions()]);
      setGroups(gs);
      setSessions(ss);

      if (sessionId === id) {
        if (ss.length > 0) {
          // 如果還有其他會話，切換到第一個
          handleLoadSession(ss[0].id);
        } else {
          // 如果沒了，建立新的
          setMessages([]);
          handleNewChat();
        }
      }
    } catch (e) {
      playSound('error', config.soundEnabled);
      console.error("刪除失敗", e);
    }
  };

  //重新命名聊天室
  const handleRenameSession = async (id, newTitle) => {
    const targetTitle = newTitle.trim();
    if (!targetTitle || targetTitle === sessions.find(s => s.id === id)?.title) return;
    try {
      await api.updateSession(id, targetTitle);
      playSound('success', config.soundEnabled);
      fetchData();
    } catch (e) {
      playSound('error', config.soundEnabled);
      console.error("更名失敗", e);
    }
  };

  //新增聊天群組
  const handleNewGroup = async () => {
    playSound('click', config.soundEnabled);
    try {
      await api.createGroup('新群組');
      playSound('success', config.soundEnabled);
      fetchData();
    } catch (e) {
      playSound('error', config.soundEnabled);
      console.error("建立群組失敗", e);
    }
  };

  //重新命名聊天群組
  const handleRenameGroup = async (id, newName) => {
    try {
      await api.updateGroup(id, { name: newName });
      playSound('success', config.soundEnabled);
      fetchData();
    } catch (e) {
      playSound('error', config.soundEnabled);
      console.error("更名群組失敗", e);
    }
  };

  //刪除聊天群組
  const handleDeleteGroup = async (id) => {
    if (!window.confirm('確定要刪除此群組嗎？(會話會轉為未分類)')) return;
    playSound('click', config.soundEnabled);
    try {
      await api.deleteGroup(id);
      playSound('success', config.soundEnabled);
      fetchData();
    } catch (e) {
      playSound('error', config.soundEnabled);
      console.error("刪除群組失敗", e);
    }
  };

  //移動聊天室
  const handleMoveSession = async (sessionId, targetGroupId, targetSessionId, position) => {
    // 簡單排序策略：
    // 如果是移到群組頭，order = 0
    // 如果是移到某 Session 旁邊，計算該 Session 的 order 並 +/- 1
    // 注意：後端目前沒做連鎖排序，所以這裡暫時先以「移入該組且排在最前面」為簡化邏輯，或是依據 targetSession 決定
    let newOrder = 0;
    if (targetSessionId) {
      const target = sessions.find(s => s.id === targetSessionId);
      newOrder = position === 'top' ? target.order : target.order + 1;
    }

    try {
      await api.moveSession(sessionId, targetGroupId, newOrder);
      fetchData();
    } catch (e) {
      console.error("移動失敗", e);
    }
  };

  const handleSendMessage = async (content) => {
    let finalContent = content;
    if (replyingTo) {
      finalContent = `[回覆內容: ${replyingTo}]\n\n${content}`;
      setReplyingTo(null);
    }

    const userMsg = { role: 'user', content: finalContent };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const data = await api.sendMessage(sessionId, content, abortControllerRef.current.signal);
      setMessages(prev => [...prev, data]);
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log("生成已停止");
      } else {
        console.error("發送失敗", e);
        setMessages(prev => [...prev, { role: 'assistant', content: "錯誤: 伺服器無回應。" }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  //停止AI生成訊息
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // 將最後一則使用者訊息填回輸入框
      const userMessages = messages.filter(m => m.role === 'user');
      if (userMessages.length > 0) {
        setInput(userMessages[userMessages.length - 1].content);
      }
    }
  };

  //複製AI生成訊息
  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content).then(() => {
      playSound('success', config.soundEnabled);
    });
  };

  //回覆AI生成訊息
  const handleReplyMessage = (content) => {
    setReplyingTo(content);
  };

  //開啟後台監管
  const handleOpenMonitor = () => {
    if (ipcRenderer) {
      ipcRenderer.send('open-monitor');
    } else {
      alert("僅在 Electron 環境支援此功能");
    }
  };

  //切換畫面函數
  const handleNavigate = (target) => {
    playSound('click', config.soundEnabled);
    if (target === 'chat' && view === 'home' && !hasSeenEntryAnim) {
      setIsEnteringChat(true);
      setHasSeenEntryAnim(true);
      setTimeout(() => {
        setView('chat');
        setIsEnteringChat(false);
      }, 800); // 第一次點入時的動畫設定
    } else {
      setView(target);
    }
  };

  //切換語言模型
  const handleModelChange = async (modelId) => {
    if (modelId === selectedModel) return;

    setIsModelLoading(true);
    setSelectedModel(modelId);

    try {
      await api.switchModel(modelId);
      playSound('success', config.soundEnabled);
    } catch (e) {
      console.error("切換失敗，請檢查後端控制台", e);
      playSound('error', config.soundEnabled);
    } finally {
      setIsModelLoading(false); //把Loading取消
    }
  };


  return (
    <div className={`app-container ${isEnteringChat ? 'entering-transition' : ''}`}>

      {/* 當畫面為主頁面時 */}
      {view === 'home' ? (
        <Home onNavigate={handleNavigate} t={t} />
      ) : view === 'credits' ? (
        <Credits onBack={() => handleNavigate('home')} t={t} />
      ) : (
        <>
          <Sidebar
            groups={groups}
            sessions={sessions}
            sessionId={sessionId}
            sidebarOpen={sidebarOpen}
            onNewChat={handleNewChat}
            onLoadSession={(id) => { handleNavigate('chat'); handleLoadSession(id); }}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onNewGroup={handleNewGroup}
            onRenameGroup={handleRenameGroup}
            onDeleteGroup={handleDeleteGroup}
            onMoveSession={handleMoveSession}
            onOpenSettings={() => { handleNavigate('settings'); }}
            onGoHome={() => { handleNavigate('home'); }}
            activeView={view}
            onPlayClick={(force = false) => playSound('click', force || config.soundEnabled)}
            t={t}
          />

          {/* 當畫面為聊天時 */}
          <div className="main-chat">
            {view === 'chat' && (
              <>
                <div className="messages-container">
                  {messages.length === 0 && (
                    <div className="empty-state">
                      <h2>X LLM</h2>
                      <p>Powered by X_OO</p>
                    </div>
                  )}

                  {messages.map((msg, idx) => (
                    <ChatMessage
                      key={idx}
                      msg={msg}
                      onCopy={handleCopyMessage}
                      onReply={handleReplyMessage}
                      t={t}
                    />
                  ))}

                  {isLoading && (
                    <div className="message assistant loading">
                      <div className="avatar">
                        <img src={assistantAvatar} alt="AI" className="avatar-img" />
                      </div>
                      <div className="message-content">...</div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <ChatInput
                  input={input}
                  setInput={setInput}
                  replyingTo={replyingTo}
                  onCancelReply={() => setReplyingTo(null)}
                  onSendMessage={handleSendMessage}
                  onStopGeneration={handleStopGeneration}
                  isLoading={isLoading}
                  t={t}
                />
              </>
            )}

            {/* 當畫面為設定時 */}
            {view === 'settings' && (
              <Settings
                config={config}
                onUpdateConfig={setConfig}
                onBack={() => { handleNavigate('chat'); }}
                onPlayClick={(force = false) => playSound('click', force || config.soundEnabled)}
                onOpenMonitor={() => { playSound('click', config.soundEnabled); handleOpenMonitor(); }}
                selectedModel={selectedModel}
                isModelLoading={isModelLoading}
                onModelChange={handleModelChange}
                t={t}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
