import { useState, useEffect } from 'react';
import chatIcon from '../assets/icons/I351005_send_24dp.png';
import settingsIcon from '../assets/icons/I351006_settings_24dp.png';
import '../styles/Home.css';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

function Home({ onNavigate, t }) {
    const [isFocused, setIsFocused] = useState(true);

    useEffect(() => {
        const handleFocusChange = (e, focused) => setIsFocused(focused);
        if (ipcRenderer) {
            ipcRenderer.on('app-focus-changed', handleFocusChange);
        }
        return () => {
            if (ipcRenderer) {
                ipcRenderer.removeListener('app-focus-changed', handleFocusChange);
            }
        };
    }, []);

    return (
        <div className={`home-view ${!isFocused ? 'is-paused' : ''}`}>
            <div className="abstract-background">
                <div className="line line-1"><div className="streak"></div></div>
                <div className="line line-2"><div className="streak"></div></div>
                <div className="line line-3"><div className="streak"></div></div>
                <div className="line line-4"><div className="streak"></div></div>
                <div className="pulse-circle"></div>
            </div>

            <div className="home-content">
                <div className="logo-container">
                    <h1 className="main-title">X-<span>SLM</span></h1>
                    <p className="subtitle">Future Intelligence Platform</p>
                </div>

                <div className="entry-buttons">
                    <button className="entry-btn chat-entry" onClick={() => onNavigate('chat')}>
                        <div className="btn-inner">
                            <span className="icon">
                                <img src={chatIcon} alt="Chat" className="home-btn-icon" />
                            </span>
                            <span className="text">{t ? t.startChat : "開始對話"}</span>
                        </div>
                    </button>

                    <button className="entry-btn settings-entry" onClick={() => onNavigate('settings')}>
                        <div className="btn-inner">
                            <span className="icon">
                                <img src={settingsIcon} alt="Settings" className="home-btn-icon" />
                            </span>
                            <span className="text">{t ? t.settings : "系統設定"}</span>
                        </div>
                    </button>

                    <button className="entry-btn credits-btn" onClick={() => onNavigate('credits')}>
                        <div className="btn-inner">
                            <span className="icon">📜</span>
                            <span className="text">{t ? t.credits : "開發鳴謝"}</span>
                        </div>
                    </button>
                </div>
            </div>

            <div className="footer-info">
                <span>ALPHA Version 0.0.6</span>
                <span className="divider">|</span>
                <span>CUDA ACCELERATED</span>
                <span className="divider">|</span>
                <span>Powered by X_OO</span>
            </div>
        </div>
    );
}

export default Home;