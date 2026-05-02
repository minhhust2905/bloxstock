const API_BASE = 'https://core-api.minhedward2905.workers.dev';

// ─── TABS ───
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        
        // ✅ Gửi sự kiện lên GA4 khi đổi tab
        if (typeof gtag === 'function') {
            gtag('event', 'tab_change', {
                'tab_name': btn.dataset.tab
            });
        }

        // Refresh countdown immediately on tab change
        tickCountdown();
        updatePlayNowButton(); // Cập nhật nút Play Now khi chuyển tab
        
        if (btn.dataset.tab === 'history') loadHistory();

        // Nếu data của tab mới cũ hơn lần reset gần nhất của tab đó → fetch lại.
        // Cần thiết khi user đang ở tab Mirage lúc Normal reset: boundary đã được
        // update bởi tickCountdown() nhưng không trigger fetch vì tab không active.
        if (!window.isWaitingForNewData && btn.dataset.tab !== 'history') {
            const tabInterval = btn.dataset.tab === 'mirage' ? 2 : 4;
            const tabReset    = getLastResetBoundary(tabInterval);
            const dataAge     = window.currentStockData ? new Date(window.currentStockData.updated) : null;
            if (!dataAge || dataAge < tabReset) {
                console.log('[BloxStock] Tab switch: data cũ hơn reset của tab này → loadStock()');
                loadStock();
            }
        }

        // ✅ Lưu tab đang chọn vào localStorage để ghi nhớ khi F5
        localStorage.setItem('activeTab', btn.dataset.tab);
    });
});

// ─── RARITY CONFIG ───
const RC = {
    common: 'rc-common', uncommon: 'rc-uncommon',
    rare: 'rc-rare', legendary: 'rc-legendary', mythical: 'rc-mythical'
};
const RARITY_RANK = { mythical:5, legendary:4, rare:3, uncommon:2, common:1 };
const RARITY_COLOR = {
    mythical:  { bg: 'linear-gradient(135deg, #f87171, #ef4444)', glow: 'rgba(248,113,113,0.4)' },
    legendary: { bg: 'linear-gradient(135deg, #e879f9, #d946ef)', glow: 'rgba(232,121,249,0.4)' },
    rare:      { bg: 'linear-gradient(135deg, #c084fc, #a855f7)', glow: 'rgba(192,132,252,0.4)' },
    uncommon:  { bg: 'linear-gradient(135deg, #60a5fa, #3b82f6)', glow: 'rgba(96,165,250,0.4)'  },
    common:    { bg: 'linear-gradient(135deg, #9ca3af, #6b7280)', glow: 'rgba(156,163,175,0.3)' },
};

// ─── COUNTDOWN ENGINE ───
let lastUpdated = '';
let lastFetchTime = 0;
window.isWaitingForNewData = false;
let _hasTriggeredFetch = false; // Chống fetch nhiều lần khi về 0

function getNextReset(hoursInterval) {
    const now = new Date();
    const msSinceMidnight = now.getUTCHours() * 3600000 + now.getUTCMinutes() * 60000 + now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();
    const intervalMs = hoursInterval * 3600000;
    let nextMs = Math.ceil(msSinceMidnight / intervalMs) * intervalMs;
    if (nextMs === msSinceMidnight) nextMs += intervalMs;
    
    const next = new Date(now);
    next.setUTCHours(0, 0, 0, 0);
    next.setTime(next.getTime() + nextMs);
    return next;
}

function getLastResetBoundary(hoursInterval) {
    const now = new Date();
    const msSinceMidnight = now.getUTCHours() * 3600000 + now.getUTCMinutes() * 60000 + now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();
    const intervalMs = hoursInterval * 3600000;
    const lastMs = Math.floor(msSinceMidnight / intervalMs) * intervalMs;
    const last = new Date(now);
    last.setUTCHours(0, 0, 0, 0);
    last.setTime(last.getTime() + lastMs);
    return last;
}

function getNextNormalReset() { return getNextReset(4); }
function getNextMirageReset() { return getNextReset(2); }

function pad(n) { return n.toString().padStart(2, '0'); }

let _lastNormalBoundary = null;
let _lastMirageBoundary = null;

function tickCountdown() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    const isMirage = activeTab === 'mirage';
    const nextReset = isMirage ? getNextMirageReset() : getNextNormalReset();
    const diff = nextReset - Date.now();

    // Cập nhật label
    const label = document.getElementById('reset-type-label');
    if (label) {
        label.innerText = isMirage ? 'Mirage Stock Resets In' : 'Normal Stock Resets In';
        label.style.color = isMirage ? '#60a5fa' : 'var(--muted)';
    }

    const wrap = document.getElementById('countdown-wrap');
    const urgent = diff < 300000; // < 5 phút
    const cdH = document.getElementById('cd-h');
    const cdM = document.getElementById('cd-m');
    const cdS = document.getElementById('cd-s');

    // ✅ Detect reset bằng boundary thay đổi cho từng tab riêng biệt
    const currentNormalBoundary = getLastResetBoundary(4).getTime();
    const currentMirageBoundary = getLastResetBoundary(2).getTime();

    // Khởi tạo lần đầu
    if (_lastNormalBoundary === null) _lastNormalBoundary = currentNormalBoundary;
    if (_lastMirageBoundary === null) _lastMirageBoundary = currentMirageBoundary;

    // Kiểm tra xem boundary của tab đang active có thực sự thay đổi do thời gian trôi qua không
    const normalChanged = currentNormalBoundary !== _lastNormalBoundary;
    const mirageChanged = currentMirageBoundary !== _lastMirageBoundary;
    const boundaryChanged = isMirage ? mirageChanged : normalChanged;

    if (boundaryChanged) {
        wrap.classList.add('is-restocking');
        // Chỉ đánh dấu đúng tab đang reset, không phủ cả hai
        if (mirageChanged) document.getElementById('tab-mirage').classList.add('is-restocking');
        if (normalChanged) document.getElementById('tab-stock').classList.add('is-restocking');
        window.isWaitingForNewData = true;
        if (!_hasTriggeredFetch) {
            _hasTriggeredFetch = true;
            console.log('[BloxStock] Reset boundary thay đổi → Bắt đầu poll data mới...');
            waitForNewStock(lastUpdated);
        }
    }

    // Luôn cập nhật cả 2 boundary để khi user đổi tab không bị lệch
    _lastNormalBoundary = currentNormalBoundary;
    _lastMirageBoundary = currentMirageBoundary;

    // ✅ Fallback: diff <= 0 phòng trường hợp boundary miss
    if (diff <= 0) {
        wrap.classList.add('is-restocking');
        // Fallback chỉ biết tab nào đang đếm ngược → chỉ mark tab đó
        if (isMirage) {
            document.getElementById('tab-mirage').classList.add('is-restocking');
        } else {
            document.getElementById('tab-stock').classList.add('is-restocking');
        }
        window.isWaitingForNewData = true;
        if (!_hasTriggeredFetch) {
            _hasTriggeredFetch = true;
            console.log('[BloxStock] Countdown về 0 → Bắt đầu poll data mới...');
            waitForNewStock(lastUpdated);
        }
        return;
    }

    // Chỉ gỡ bỏ restocking UI khi thực sự ĐÃ có data mới (không còn waiting)
    if (!window.isWaitingForNewData) {
        wrap.classList.remove('is-restocking');
        _hasTriggeredFetch = false; // Phải nằm ở đây để ngăn race condition
    }
    
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    cdH.textContent = pad(h);
    cdM.textContent = pad(m);
    cdS.textContent = pad(s);
    [cdH, cdM, cdS].forEach(el => el.classList.toggle('urgent', urgent));
}
setInterval(tickCountdown, 1000);
tickCountdown();

// ✅ Safety net: Chỉ fetch khi tab được focus lại sau khi ngủ
document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const msSinceLastFetch = Date.now() - lastFetchTime;
    if (msSinceLastFetch > 4 * 60 * 1000) {
        console.log('[BloxStock] Tab wake-up → refetch');
        loadStock();
    }
});

// ─── SMART POLL ENGINE ───
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForNewStock(oldUpdated) {
    console.log('[BloxStock] Polling... old timestamp:', oldUpdated);
    const delays = [2000, 3000, 5000, 5000, 8000, 10000, 15000, 20000]; // tổng ~68s, 8 requests
    for (let i = 0; i < delays.length; i++) {
        await sleep(delays[i]);
        try {
            // Ép trình duyệt không dùng cache nội bộ, bắt buộc hỏi Cloudflare CDN
            const res = await fetch(API_BASE + '/updated', { cache: 'no-store' });
            if (!res.ok) { console.warn(`[BloxStock] /updated trả ${res.status}, bỏ qua`); continue; }
            const { updated } = await res.json();
            if (updated && updated !== oldUpdated) {
                console.log(`[BloxStock] Data mới sau ${delays.slice(0,i+1).reduce((a,b)=>a+b,0)/1000}s → Fetch full...`);
                // cache: 'no-store' chỉ bypass browser cache, không bypass Cloudflare CDN edge cache.
                // Dùng ?_t= để force Cloudflare re-fetch từ KV.
                const full = await fetch(`${API_BASE}/stock?_t=${Date.now()}`, { cache: 'no-store' });
                const data = await full.json();
                _hasTriggeredFetch = false;
                lastFetchTime = Date.now();
                renderStockData(data);
                return;
            }
            console.log(`[BloxStock] Lần ${i+1}: Chưa có data mới, thử lại...`);
        } catch(e) { console.error(e); }
    }
    // Sau 68s vẫn không có data mới → slow poll mỗi 30s, tối đa 5 lần (~2.5 phút)
    console.warn('[BloxStock] Fast poll timeout → Chuyển sang slow poll...');
    let slowAttempts = 0;
    const slowPoll = async () => {
        // Nếu tab đang ẩn thì hoãn — visibilitychange sẽ resume
        if (document.hidden) {
            const resumeOnVisible = () => {
                document.removeEventListener('visibilitychange', resumeOnVisible);
                setTimeout(slowPoll, 2000);
            };
            document.addEventListener('visibilitychange', resumeOnVisible);
            return;
        }
        if (!window.isWaitingForNewData || slowAttempts >= 5) {
            console.warn('[BloxStock] Slow poll kết thúc → Reset trạng thái.');
            _hasTriggeredFetch = false;
            window.isWaitingForNewData = false;
            const wrap = document.getElementById('countdown-wrap');
            if (wrap) wrap.classList.remove('is-restocking');
            document.getElementById('tab-stock').classList.remove('is-restocking');
            document.getElementById('tab-mirage').classList.remove('is-restocking');
            loadStock();
            return;
        }
        slowAttempts++;
        try {
            const res = await fetch(API_BASE + '/updated', { cache: 'no-store' });
            if (!res.ok) { console.warn(`[BloxStock] /updated trả ${res.status}, bỏ qua`); setTimeout(slowPoll, 30000); return; }
            const { updated } = await res.json();
            if (updated && updated !== oldUpdated) {
                console.log(`[BloxStock] Slow poll lần ${slowAttempts}: Có data mới!`);
                const full = await fetch(`${API_BASE}/stock?_t=${Date.now()}`, { cache: 'no-store' });
                const data = await full.json();
                _hasTriggeredFetch = false;
                window.isWaitingForNewData = false;
                
                // Gỡ bỏ hiệu ứng restocking
                const wrap = document.getElementById('countdown-wrap');
                if (wrap) wrap.classList.remove('is-restocking');
                document.getElementById('tab-stock').classList.remove('is-restocking');
                document.getElementById('tab-mirage').classList.remove('is-restocking');

                lastFetchTime = Date.now();
                renderStockData(data);
                return;
            }
            console.log(`[BloxStock] Slow poll lần ${slowAttempts}: Chưa có, thử lại sau 30s...`);
        } catch(e) { console.error(e); }
        setTimeout(slowPoll, 30000);
    };
    setTimeout(slowPoll, 30000);
}

// ─── CACHE HELPERS ───
const CACHE_KEY = 'BloxStock_v1';
function saveCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch(e) {}
}
function loadCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < 10 * 60 * 1000) return { data, ts };
    } catch(e) {}
    return null;
}

// ─── LOAD STOCK ───
async function loadStock() {
    try {
        const normalB = getLastResetBoundary(4).getTime();
        const mirageB = getLastResetBoundary(2).getTime();
        const latestBoundary = Math.max(normalB, mirageB);

        // Hiện cache ngay lập tức nếu có (zero skeleton delay)
        const cached = loadCache();
        if (cached && cached.data.updated !== lastUpdated) {
            renderStockData(cached.data);
        }

        // Nếu cache còn mới < 2 phút VÀ cache được tạo SAU lần reset gần nhất, thì mới skip fetch.
        // Ngược lại, nếu cache tạo trước giờ reset, nó đã LỖI THỜI dù chỉ mới 10 giây -> Buộc Fetch.
        if (cached && Date.now() - cached.ts < 2 * 60 * 1000 && cached.ts > latestBoundary && !window.isWaitingForNewData) {
            console.log('[BloxStock] Cache fresh < 2m & valid boundary, skip fetch');
            return;
        }

        let data;
        if (window._initialStockFetch) {
            data = await window._initialStockFetch;
            window._initialStockFetch = null;
        } else {
            const res = await fetch(API_BASE);
            data = await res.json();
        }
        lastFetchTime = Date.now();
        
        // ✅ Kiểm tra xem data này là cũ hay mới so với mốc reset gần nhất
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        const lastReset = getLastResetBoundary(activeTab === 'mirage' ? 2 : 4);
        if (new Date(data.updated) < lastReset) {
            console.log('[BloxStock] Data is older than last reset! Entering polling mode...');
            // Render old data so skeletons don't stay forever
            renderStockData(data); 
            
            window.isWaitingForNewData = true;
            _hasTriggeredFetch = true; // Ngăn tickCountdown() gọi waitForNewStock() song song
            const wrap = document.getElementById('countdown-wrap');
            if (wrap) wrap.classList.add('is-restocking');
            const ts = document.getElementById('tab-stock');
            if (ts) ts.classList.add('is-restocking');
            const tm = document.getElementById('tab-mirage');
            if (tm) tm.classList.add('is-restocking');
            
            waitForNewStock(data.updated);
        } else {
            saveCache(data);
            renderStockData(data);
        }
    } catch(e) {
        console.error(e);
        // Ẩn skeleton, hiện error box để user không ngồi chờ mãi
        const skeleton = document.getElementById('skeleton');
        if (skeleton) skeleton.style.display = 'none';
        const grid = document.getElementById('stock-grid');
        if (grid && grid.children.length === 0) {
            grid.style.display = 'grid';
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 1rem;color:#f87171;font-size:0.9rem;">
                ⚠️ Không thể kết nối đến máy chủ.<br>
                <span style="opacity:0.6;font-size:0.8rem;">Vui lòng F5 lại hoặc thử lại sau ít phút.</span>
            </div>`;
        }
    }
}

window.renderFruits = function(fruits, targetId, isMirage = false) {
    const grid = document.getElementById(targetId);
    if (!grid) return;
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    
    fruits.forEach((f, idx) => {
        let rKey = f.rarity.toLowerCase();
        if (f.name === 'Eagle' && rKey === 'unknown') rKey = 'uncommon';
        const rc = RC[rKey] || '';
        const beli = new Intl.NumberFormat('en-US').format(f.price || 0);
        const robux = new Intl.NumberFormat('en-US').format(f.robux || 0);
        const card = document.createElement('div');
        card.className = `card ${isMirage ? 'mirage-card' : ''} ${rc}`;
        card.style.animationDelay = `${idx * 0.05}s`;
        
        card.innerHTML = `
            <span class="rarity-badge">${f.rarity}</span>
            <div class="fruit-img-wrap">
                <img class="fruit-img" src="${window.imgBase || 'assets/fruits/'}${f.name}.webp" alt="${f.name} Stock Blox Fruits" width="140" height="140" loading="${idx < 4 ? 'eager' : 'lazy'}" decoding="async" onerror="this.style.opacity=0.3">
            </div>
            <div class="fruit-name">${f.name}</div>
            <div class="fruit-type">${f.type || 'Natural'}</div>
            <div class="prices">
                <div class="price-box"><span class="price-label">Beli</span><span class="price-val beli">${beli}</span></div>
                <div class="price-box"><span class="price-label">Robux</span><span class="price-val robux">${robux}</span></div>
            </div>
        `;
        frag.appendChild(card);
    });
    grid.appendChild(frag);
};

function updatePlayNowButton() {
    const data = window.currentStockData;
    if (!data) return;
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'stock';
    const displayStock = activeTab === 'mirage' ? data.mirageStock : data.stock;
    const top = (displayStock && displayStock.length > 0) ? displayStock[0] : data.stock[0];

    if (top) {
        const rKey = top.rarity.toLowerCase();
        const col = RARITY_COLOR[rKey] || RARITY_COLOR.common;
        const btn = document.getElementById('play-btn');
        const img = document.getElementById('play-btn-img');
        btn.style.background = col.bg;
        btn.style.setProperty('--btn-glow', col.glow);
        img.src = `${window.imgBase || 'assets/fruits/'}${top.name}.webp`;
        img.style.display = '';
    }
}

function renderStockData(data) {
    if (!data || data.updated === lastUpdated) return;

    lastUpdated = data.updated;
    window.isWaitingForNewData = false;
    window.currentStockData = data;
    
    window.imgBase = 'assets/fruits/';

    updatePlayNowButton();
    
    historyData = []; 
    if (document.querySelector('.tab-btn[data-tab="history"]').classList.contains('active')) {
        loadHistory();
    }

    data.stock.sort((a, b) => {
        const rA = RARITY_RANK[a.rarity.toLowerCase()] || 0;
        const rB = RARITY_RANK[b.rarity.toLowerCase()] || 0;
        if (rB !== rA) return rB - rA;
        return b.price - a.price;
    });

    window.renderFruits(data.stock, 'stock-grid');
    document.getElementById('skeleton').style.display = 'none';
    document.getElementById('stock-grid').style.display = 'grid';

    const mirageGrid = document.getElementById('mirage-grid');
    if (data.mirageStock && data.mirageStock.length > 0) {
        window.renderFruits(data.mirageStock, 'mirage-grid', true);
        document.getElementById('btn-mirage').style.display = 'flex';
    } else {
        mirageGrid.innerHTML = `<div style="text-align:center;padding:4rem 2rem;color:var(--muted);grid-column:1/-1;">Mirage Island is currently hidden...</div>`;
        document.getElementById('btn-mirage').style.display = 'none';
    }
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return seconds + "s ago";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    return Math.floor(hours / 24) + "d ago";
}

// ─── LOAD HISTORY ───
let historyData = [];
let historyFilter = new Set(['all']);
let sourceFilter = 'both';
let historySearch = '';

async function loadHistory() {
    if (historyData.length > 0) return;
    try {
        const res = await fetch(API_BASE + '/history');
        historyData = await res.json();
        renderHistory();
    } catch(e) {
        document.getElementById('history-list').innerHTML =
            '<div style="text-align:center;padding:2rem;color:#f87171;font-size:0.85rem;">No history yet.</div>';
    }
}

// ─── SEARCH HELPER (Fuzzy & Accent Neutral) ───
function normalizeText(text) {
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove Vietnamese accents
        .replace(/đ/g, "d");
}

function renderHistory() {
    const el = document.getElementById('history-list');
    if (!el) return;
    el.innerHTML = '';
    const frag = document.createDocumentFragment();

    // Lấy dải thời gian đang chọn
    const rangeDays = parseInt(document.querySelector('.tf-btn.active')?.dataset.range || '1');
    const cutoffTs = Date.now() - (rangeDays * 24 * 60 * 60 * 1000);
    
    let items = [...historyData].reverse();

    // Lọc theo thời gian
    items = items.filter(entry => new Date(entry.updated).getTime() >= cutoffTs);
    
    // Apply Smart Search Filter
    if (historySearch) {
        const q = normalizeText(historySearch);
        items = items.filter(entry => {
            const inNormal = entry.stock.some(f => normalizeText(f.name).includes(q));
            const inMirage = entry.mirageStock && entry.mirageStock.some(f => normalizeText(f.name).includes(q));
            return inNormal || inMirage;
        });
    }

    items.slice(0, 100).forEach((entry, index) => {
        const d = new Date(entry.updated);
        const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        const relative = timeAgo(d);
        
        // Giải pháp tuyệt đối: Chỉ hiện Normal ở các khung giờ chia hết cho 4 (chuẩn UTC)
        const utcHour = d.getUTCHours();
        const isNormalWindow = (utcHour % 4 === 0);

        // Quyết định xem cột nào được hiển thị
        const showNormal = isNormalWindow && sourceFilter !== 'mirage' && entry.stock && entry.stock.length > 0;
        const showMirage = sourceFilter !== 'normal' && entry.mirageStock && entry.mirageStock.length > 0;

        // Tìm trái cây có độ hiếm cao nhất ĐANG ĐƯỢC HIỂN THỊ
        let bestFruit = null;
        if (showNormal && showMirage) {
            const bestNormal = entry.stock[0];
            const bestMirage = entry.mirageStock[0];
            const rankN = bestNormal ? (RARITY_RANK[bestNormal.rarity.toLowerCase()] || 0) : 0;
            const rankM = bestMirage ? (RARITY_RANK[bestMirage.rarity.toLowerCase()] || 0) : 0;
            bestFruit = (rankM > rankN) ? bestMirage : bestNormal;
        } else if (showNormal) {
            bestFruit = entry.stock[0];
        } else if (showMirage) {
            bestFruit = entry.mirageStock[0];
        }

        const dotColor = bestFruit ? (RC[bestFruit.rarity.toLowerCase()] || 'rc-common') : 'rc-common';
        
        let fruitsToRender = entry.stock;
        let noMatch = false;
        if (!historyFilter.has('all')) {
            fruitsToRender = entry.stock.filter(f => historyFilter.has(f.rarity.toLowerCase()));
            if (fruitsToRender.length === 0) noMatch = true;
        }

        const normalColHtml = showNormal ? `
            <div class="timeline-col">
                <div class="timeline-col-label">📦 Normal</div>
                <div class="timeline-fruits">${noMatch
                    ? `<span style="color:var(--muted);font-size:0.75rem;opacity:0.4;font-style:italic;">No match</span>`
                    : fruitsToRender.map(f => {
                        let rKey = f.rarity.toLowerCase();
                        if (f.name === 'Eagle' && rKey === 'unknown') rKey = 'uncommon';
                        const rcClass = RC[rKey] || 'rc-common';
                        return `<div class="tl-fruit ${rcClass}" data-name="${f.name}" style="--rc:var(--${rKey})">
                                    <img src="${window.imgBase || 'assets/fruits/'}${f.name}.webp" alt="${f.name} Stock Blox Fruits" width="44" height="44" loading="lazy" onerror="this.style.opacity=0.3">
                                </div>`;
                    }).join('')
                }</div>
            </div>` : '';

        let mirageColHtml = '';
        if (showMirage && entry.mirageStock && entry.mirageStock.length > 0) {
            let mirageToRender = entry.mirageStock;
            if (!historyFilter.has('all')) {
                mirageToRender = entry.mirageStock.filter(f => historyFilter.has(f.rarity.toLowerCase()));
            }
            if (mirageToRender.length > 0) {
                const mFruits = mirageToRender.map(f => {
                    let rKey = f.rarity.toLowerCase();
                    if (f.name === 'Eagle' && rKey === 'unknown') rKey = 'uncommon';
                    const rcClass = RC[rKey] || 'rc-common';
                    return `<div class="tl-fruit tl-mirage ${rcClass}" data-name="${f.name}" style="--rc:var(--${rKey})">
                                <img src="${window.imgBase || 'assets/fruits/'}${f.name}.webp" alt="${f.name} Stock Blox Fruits" width="44" height="44" loading="lazy" onerror="this.style.opacity=0.3">
                            </div>`;
                }).join('');
                mirageColHtml = `
                    <div class="timeline-col">
                        <div class="timeline-col-label mirage">🌌 Mirage</div>
                        <div class="timeline-fruits">${mFruits}</div>
                    </div>`;
            }
        }

        if (!normalColHtml && !mirageColHtml) return;

        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-dot ${dotColor}" style="--rc:var(--${bestFruit ? bestFruit.rarity.toLowerCase() : 'common'})"></div>
            <div class="timeline-content">
                <div class="timeline-time">🕒 ${timeStr} · ${dateStr} <span style="color:var(--muted);opacity:0.6;margin-left:8px">(${relative})</span></div>
                <div class="timeline-cols">
                    ${normalColHtml}
                    ${mirageColHtml}
                </div>
            </div>
        `;
        frag.appendChild(item);
    });

    if (frag.children.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);font-size:0.85rem;">No entries found for selected rarities.</div>';
    } else {
        el.appendChild(frag);
    }
}

// History multi-filter events
document.querySelectorAll('#history-filter .rf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const r = btn.dataset.rarity;
        
        if (r === 'all') {
            historyFilter.clear();
            historyFilter.add('all');
            document.querySelectorAll('#history-filter .rf-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        } else {
            historyFilter.delete('all');
            document.querySelector('#history-filter [data-rarity="all"]').classList.remove('active');
            
            if (historyFilter.has(r)) {
                historyFilter.delete(r);
                btn.classList.remove('active');
            } else {
                historyFilter.add(r);
                btn.classList.add('active');
            }
            
            if (historyFilter.size === 0) {
                historyFilter.add('all');
                document.querySelector('#history-filter [data-rarity="all"]').classList.add('active');
            }
        }
        renderHistory();
    });
});

// Source filter events
document.querySelectorAll('#source-filter .rf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        sourceFilter = btn.dataset.source;
        document.querySelectorAll('#source-filter .rf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderHistory();
    });
});

// Time range filter events
document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderHistory();
    });
});

// History search event
document.getElementById('history-search').addEventListener('input', (e) => {
    historySearch = e.target.value.trim();
    renderHistory();
});

// ─── INIT ───
// Khôi phục tab cuối cùng người dùng đã xem (nếu có)
const savedTab = localStorage.getItem('activeTab');
if (savedTab && savedTab !== 'stock') {
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
    if (targetBtn) targetBtn.click();
}
// Xóa bỏ trạng thái chặn flash sau khi đã ổn định
document.documentElement.removeAttribute('data-tab-loading');
loadStock();

// ✅ Theo dõi click nút Join Game
document.getElementById('play-btn')?.addEventListener('click', () => {
    if (typeof gtag === 'function') {
        gtag('event', 'join_game_click', {
            'event_category': 'engagement',
            'event_label': 'Play Now Button'
        });
    }
});

// ─── PWA INSTALL ───
let deferredPrompt;
const installBtn = document.getElementById('install-btn');
const installSection = document.getElementById('install-section');

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (installSection) installSection.style.display = 'block';
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        if (typeof gtag === 'function') {
            gtag('event', 'pwa_install_click', { 'event_category': 'engagement' });
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') {
            if (installSection) installSection.style.display = 'none';
        }
    });
}

window.addEventListener('appinstalled', () => { 
    if (installSection) installSection.style.display = 'none'; 
    if (typeof gtag === 'function') {
        gtag('event', 'pwa_installed_success', { 'event_category': 'engagement' });
    }
});

// ─── PWA REGISTER ───
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
    });
}