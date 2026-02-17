import { useState } from 'react';
import folderIcon from '../assets/icons/I351001_create_new_folder_24dp.png';
import settingsIcon from '../assets/icons/I351006_settings_24dp.png';
import homeIcon from '../assets/icons/I351008home_24dp.png';
import '../styles/Sidebar.css';

function Sidebar({
    groups,
    sessions,
    sessionId,
    sidebarOpen,
    onNewChat,
    onLoadSession,
    onDeleteSession,
    onRenameSession,
    onNewGroup,
    onRenameGroup,
    onDeleteGroup,
    onMoveSession,
    onOpenSettings,
    onGoHome,
    activeView,
    onPlayClick,
    t
}) {
    const [editingId, setEditingId] = useState(null); // 'session-1' or 'group-1'
    const [editingTitle, setEditingTitle] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState({}); // {groupId: true/false}
    const [dragOverInfo, setDragOverInfo] = useState(null); // { id, position: 'top'|'bottom' }

    // 輔助函式：切換折覽
    const toggleGroup = (groupId) => {
        onPlayClick();
        setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const handleStartRename = (e, id, currentTitle) => {
        e.stopPropagation();
        setEditingId(id);
        setEditingTitle(currentTitle);
    };

    const handleRenameSubmit = (type, id, value) => {
        // 使用傳入的 value 而非共用的 editingTitle，避免切換項目時數據被覆蓋
        const targetTitle = value.trim();
        if (type === 'session') onRenameSession(id, targetTitle);
        else onRenameGroup(id, targetTitle);

        // 僅在編輯狀態沒被切換到其他 ID 時才清空，避免連續點擊「重新命名」時互相干擾
        setEditingId(prev => (prev === `${type}-${id}` ? null : prev));
    };

    const handleKeyDown = (e, type, id) => {
        if (e.key === 'Enter') {
            handleRenameSubmit(type, id, e.currentTarget.value);
        } else if (e.key === 'Escape') {
            setEditingId(null);
        }
    };

    // --- Drag & Drop 處理 ---
    const onDragStart = (e, session) => {
        e.dataTransfer.setData('sessionId', session.id);
    };

    const onDragOver = (e, targetId) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const md = rect.top + rect.height / 2;
        const position = e.clientY < md ? 'top' : 'bottom';
        setDragOverInfo({ id: targetId, position });
    };

    const onDrop = (e, targetGroupId, targetSessionId = null) => {
        e.preventDefault();
        const draggedSessionId = parseInt(e.dataTransfer.getData('sessionId'));
        setDragOverInfo(null);

        // 計算新順序 (簡單實作：若 targetSessionId 存在則依據 position 決定)
        onMoveSession(draggedSessionId, targetGroupId, targetSessionId, dragOverInfo?.position);
    };

    // 渲染 Session 項次
    const renderSessionItem = (s) => (
        <div
            key={s.id}
            draggable
            onDragStart={(e) => onDragStart(e, s)}
            onDragOver={(e) => onDragOver(e, `session-${s.id}`)}
            onDrop={(e) => onDrop(e, s.group_id, s.id)}
            className={`history-item ${sessionId === s.id ? 'active' : ''} ${editingId === `session-${s.id}` ? 'editing' : ''} 
                 ${dragOverInfo?.id === `session-${s.id}` ? `drag-${dragOverInfo.position}` : ''}`}
            onClick={() => editingId !== `session-${s.id}` && onLoadSession(s.id)}
        >
            {editingId === `session-${s.id}` ? (
                <input
                    autoFocus
                    className="rename-input"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={(e) => handleRenameSubmit('session', s.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'session', s.id)}
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <>
                    <span className="history-title">{s.title}</span>
                    <div className="history-actions">
                        <button title="重新命名" onClick={(e) => { onPlayClick(); handleStartRename(e, `session-${s.id}`, s.title); }}>✏️</button>
                        <button title="刪除" onClick={(e) => { e.stopPropagation(); onPlayClick(); onDeleteSession(s.id); }}>🗑️</button>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div className="sidebar" style={{ width: sidebarOpen ? '260px' : '0', padding: sidebarOpen ? '1rem' : '0' }}>
            <div className="sidebar-header">
                <button className="new-chat-btn" onClick={() => { onPlayClick(); onNewChat(); }}>
                    <span>+</span> {t.newChat}
                </button>
                <button className="new-group-btn" onClick={() => { onPlayClick(); onNewGroup(); }} title={t.newGroup}>
                    <img src={folderIcon} alt="New Group" />
                </button>
            </div>

            <div className="history-list">
                {/* 已分類群組 */}
                {groups.map(g => (
                    <div key={g.id} className="group-container">
                        <div
                            className="group-header"
                            onClick={() => toggleGroup(g.id)}
                            onDragOver={(e) => onDragOver(e, `group-${g.id}`)}
                            onDrop={(e) => onDrop(e, g.id)}
                        >
                            <span className={`arrow ${collapsedGroups[g.id] ? '' : 'down'}`}>▶</span>
                            {editingId === `group-${g.id}` ? (
                                <input
                                    autoFocus
                                    className="rename-input group-rename"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onBlur={(e) => handleRenameSubmit('group', g.id, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, 'group', g.id)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span className="group-name">{g.name}</span>
                            )}
                            <div className="group-actions">
                                <button onClick={(e) => { onPlayClick(); handleStartRename(e, `group-${g.id}`, g.name); }}>✏️</button>
                                <button onClick={(e) => { e.stopPropagation(); onPlayClick(); onDeleteGroup(g.id); }}>🗑️</button>
                            </div>
                        </div>
                        {!collapsedGroups[g.id] && (
                            <div className="group-content">
                                {sessions.filter(s => s.group_id === g.id).map(renderSessionItem)}
                            </div>
                        )}
                    </div>
                ))}

                {/* 未分類 */}
                <div className="group-container">
                    <div className="group-header" onDragOver={(e) => onDragOver(e, 'group-uncategorized')} onDrop={(e) => onDrop(e, null)}>
                        <span className="group-name">{t.uncategorized}</span>
                    </div>
                    <div className="group-content">
                        {sessions.filter(s => s.group_id === null).map(renderSessionItem)}
                    </div>
                </div>
            </div>

            <div className="sidebar-footer">
                <button
                    className={`home-entry-btn ${activeView === 'home' ? 'active' : ''}`}
                    onClick={onGoHome}
                >
                    <img src={homeIcon} alt="Home" className="home-icon-img" /> {t.goHome}
                </button>
                <button
                    className={`settings-entry-btn ${activeView === 'settings' ? 'active' : ''}`}
                    onClick={onOpenSettings}
                >
                    <img src={settingsIcon} alt="Settings" className="settings-icon-img" /> {t.settings}
                </button>
            </div>
        </div>
    );
}

export default Sidebar;
