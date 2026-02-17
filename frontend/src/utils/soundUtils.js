// 預定義音效路徑
const SOUND_PATHS = {
    click: '/src/assets/sounds/C9002_button_click.wav',
    click_Mouse: '/src/assets/sounds/C9001_Mouse_Click.wav',
    success: '/src/assets/sounds/N37001_powerupsuccess.wav',
    error: '/src/assets/sounds/N89001_rush__blip9.wav',
};

// 快取 Audio 物件
const audioCache = {};

export const playSound = (type, enabled = true) => {
    if (!enabled || !SOUND_PATHS[type]) return;

    try {
        if (!audioCache[type]) {
            audioCache[type] = new Audio(SOUND_PATHS[type]);
        }

        const sound = audioCache[type];
        sound.currentTime = 0; // 重置播放進度
        sound.play().catch(e => console.warn('音訊播放被瀏覽器阻擋或找不到檔案:', e));
    } catch (e) {
        console.error('音訊播放錯誤:', e);
    }
};
