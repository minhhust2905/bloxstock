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
    mythical:  { bg: 'linear-gradient(135deg, #ff3333, #880000)', glow: 'rgba(255,51,51,0.5)' },
    legendary: { bg: 'linear-gradient(135deg, #ff33ff, #880088)', glow: 'rgba(255,51,255,0.5)' },
    rare:      { bg: 'linear-gradient(135deg, #c084fc, #a855f7)', glow: 'rgba(192,132,252,0.4)' },
    uncommon:  { bg: 'linear-gradient(135deg, #60a5fa, #3b82f6)', glow: 'rgba(96,165,250,0.4)'  },
    common:    { bg: 'linear-gradient(135deg, #9ca3af, #6b7280)', glow: 'rgba(156,163,175,0.3)' },
};

// ─── COUNTDOWN ENGINE ───
// ─── DYNAMIC FRUIT DATA LOADING ───
// Tải "Bản Hiến Pháp" trái ác quỷ từ file JSON
window._fruitsDataFetch = fetch('assets/data/fruits.json')
    .then(r => r.json())
    .catch(err => {
        console.error('[BloxStock] Failed to load fruits.json:', err);
        return null;
    });

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

window.renderFruits = async function(isMirage = false) {
    const grid = document.getElementById(isMirage ? 'mirage-grid' : 'stock-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    // Chờ cả dữ liệu Stock và dữ liệu Fruits Master
    const [data, master] = await Promise.all([
        window._initialStockFetch || loadStock(),
        window._fruitsDataFetch
    ]);
    
    // Cập nhật con số tổng chu kỳ (Dynamic)
    if (master && master.total_cycles_analyzed) {
        const cycleEl = document.getElementById('total-cycles-display');
        if (cycleEl) cycleEl.textContent = master.total_cycles_analyzed;
    }
    
    window._initialStockFetch = null; 
    if (!data) return;

    const items = isMirage ? data.mirageStock : data.stock;
    if (!items || items.length === 0) {
        grid.innerHTML = `<div class="empty-state">No ${isMirage ? 'Mirage ' : ''}Stock currently available.</div>`;
        return;
    }

    const frag = document.createDocumentFragment();
    items.forEach((f, idx) => {
        let rKey = f.rarity.toLowerCase();
        if (f.name === 'Eagle' && rKey === 'unknown') rKey = 'uncommon';
        const rc = RC[rKey] || '';
        
        // --- LẤY DỮ LIỆU TỪ "HIẾN PHÁP" ---
        const fruitId = f.name; // Worker gửi về tên chuẩn (TitleCase) như 'Kitsune', 'Tiger'
        const masterInfo = master?.fruits[fruitId] || {};
        
        const displayName = masterInfo.name || f.name;
        const beli = new Intl.NumberFormat('en-US').format(masterInfo.beli || f.price || 0);
        
        // --- FIX BUG 1: Fallback cho 0.0 (Dragon) ---
        const chance = (masterInfo.chance !== undefined) ? masterInfo.chance : null;
        
        const chanceDisplay = (chance === 0) ? 'Off-sale' : (chance === null ? 'N/A' : `${chance}%`);
        
        // --- CHỌN MÀU THEO GIÁ TRỊ SỐ (FUNCTIONAL COLORING) ---
        let chanceColor = '#94a3b8'; // Mặc định: Xám xanh (Common)
        if (chance !== null && chance !== 0) {
            if (chance < 1) chanceColor = '#f87171';      // Đỏ rực (Siêu hiếm < 1%)
            else if (chance < 5) chanceColor = '#fbbf24'; // Vàng kim (Hiếm 1-5%)
            else if (chance < 20) chanceColor = '#86efac';// Xanh lá (Khá hiếm 5-20%)
        } else if (chance === 0) {
            chanceColor = '#ef4444'; // Dragon/Off-sale: Đỏ đậm
        }

        const type = masterInfo.type || f.type || 'Natural';

        const card = document.createElement('div');
        card.className = `card ${isMirage ? 'mirage-card' : ''} ${rc}`;
        card.style.animationDelay = `${idx * 0.05}s`;
        
        card.innerHTML = `
            <span class="rarity-badge">${f.rarity}</span>
            <div class="fruit-img-wrap">
                <img class="fruit-img" src="${window.imgBase || 'assets/fruits/'}${f.name}.webp" alt="${displayName} Stock Blox Fruits" width="140" height="140" loading="${idx < 4 ? 'eager' : 'lazy'}" decoding="async" onerror="this.style.opacity=0.3">
            </div>
            <div class="fruit-name">${displayName}</div>
            <div class="fruit-type">${type}</div>
            <div class="prices">
                <div class="price-box"><span class="price-label">Beli</span><span class="price-val beli">${beli}</span></div>
                <div class="price-box"><span class="price-label">Chance</span><span class="price-val chance" style="color: ${chanceColor}">${chanceDisplay}</span></div>
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

    window.renderFruits(false);
    document.getElementById('skeleton').style.display = 'none';
    document.getElementById('stock-grid').style.display = 'grid';

    const mirageGrid = document.getElementById('mirage-grid');
    if (data.mirageStock && data.mirageStock.length > 0) {
        window.renderFruits(true);
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

    const rangeDays = parseInt(document.querySelector('.tf-btn.active')?.dataset.range || '1');
    const cutoffTs = Date.now() - (rangeDays * 24 * 60 * 60 * 1000);
    
    let items = [...historyData].reverse();

    // 1. GLOBAL SEARCH (Bỏ qua Time Filter nếu có Search)
    if (historySearch) {
        const q = normalizeText(historySearch);
        items = items.filter(entry => {
            const inN = entry.stock && entry.stock.some(f => normalizeText(f.name).includes(q));
            const inM = entry.mirageStock && entry.mirageStock.some(f => normalizeText(f.name).includes(q));
            return inN || inM;
        });
    } else {
        // Nếu không search, mới lọc theo thời gian
        items = items.filter(entry => {
            const ts = new Date(entry.updated).getTime();
            return !isNaN(ts) && ts >= cutoffTs; // Sửa lỗi invalid Date
        });
    }

    // 2. LỌC THEO SOURCE & RARITY + LÀM TRÒN GIỜ & DEDUPLICATE
    const seenWindows = new Set();
    const processedItems = [];

    items.forEach(entry => {
        const d = new Date(entry.updated);
        const ts = d.getTime();
        if (isNaN(ts)) return;

        // Tìm khung giờ Reset mà mốc này thuộc về (Làm tròn về bội số của 2h)
        const hourFloat = d.getUTCHours() + (d.getUTCMinutes() / 60);
        const nearestEvenHour = Math.round(hourFloat / 2) * 2;
        
        // Tạo object Date mới cho khung giờ đã làm tròn (để hiển thị đẹp)
        const roundedDate = new Date(d);
        roundedDate.setUTCHours(nearestEvenHour, 0, 0, 0);
        
        // Nếu làm tròn lên 24h thì nhảy sang ngày hôm sau
        const windowKey = roundedDate.getTime();

        // CHỈ GIỮ LẠI BẢN GHI MỚI NHẤT CHO MỖI KHUNG GIỜ (Deduplicate)
        if (seenWindows.has(windowKey)) return;
        seenWindows.add(windowKey);

        const hasN = entry.stock && entry.stock.length > 0;
        const hasM = entry.mirageStock && entry.mirageStock.length > 0;

        const isNormalWindow = (nearestEvenHour % 4 === 0);
        const showN = isNormalWindow && sourceFilter !== 'mirage' && hasN;
        const showM = sourceFilter !== 'normal' && hasM;

        if (!showN && !showM) return;

        // Lọc Rarity
        if (!historyFilter.has('all')) {
            const matchN = showN && entry.stock.some(f => historyFilter.has(f.rarity.toLowerCase()));
            const matchM = showM && entry.mirageStock.some(f => historyFilter.has(f.rarity.toLowerCase()));
            if (!matchN && !matchM) return;
        }

        // Lưu thông tin đã xử lý
        entry._displayDate = roundedDate;
        entry._showN = showN;
        entry._showM = showM;
        processedItems.push(entry);
    });

    const totalMatches = processedItems.length;

    // 3. RENDER 100 ITEM ĐÃ XỬ LÝ
    processedItems.slice(0, 100).forEach(entry => {
        const d = entry._displayDate;
        const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        const relative = timeAgo(new Date(entry.updated)); // Time ago vẫn tính theo thời gian cào thực tế cho chính xác

        // Chuẩn bị danh sách trái cây hiển thị (đã lọc Rarity)
        let renderN = entry.stock || [];
        let renderM = entry.mirageStock || [];
        if (!historyFilter.has('all')) {
            renderN = renderN.filter(f => historyFilter.has(f.rarity.toLowerCase()));
            renderM = renderM.filter(f => historyFilter.has(f.rarity.toLowerCase()));
        }

        // Sửa UX: Cả 2 cột đều biến mất nếu trống (không còn chữ "No match" lộn xộn)
        const normalColHtml = (entry._showN && renderN.length > 0) ? `
            <div class="timeline-col">
                <div class="timeline-col-label">📦 Normal</div>
                <div class="timeline-fruits">${renderN.map(f => {
                    let rKey = f.rarity.toLowerCase();
                    if (f.name === 'Eagle' && rKey === 'unknown') rKey = 'uncommon';
                    const rcClass = RC[rKey] || 'rc-common';
                    return `<div class="tl-fruit ${rcClass}" data-name="${f.name}" style="--rc:var(--${rKey})">
                                <img src="${window.imgBase || 'assets/fruits/'}${f.name}.webp" alt="${f.name}" width="44" height="44" loading="lazy" onerror="this.style.opacity=0.3">
                            </div>`;
                }).join('')}</div>
            </div>` : '';

        const mirageColHtml = (entry._showM && renderM.length > 0) ? `
            <div class="timeline-col">
                <div class="timeline-col-label mirage">🌌 Mirage</div>
                <div class="timeline-fruits">${renderM.map(f => {
                    let rKey = f.rarity.toLowerCase();
                    if (f.name === 'Eagle' && rKey === 'unknown') rKey = 'uncommon';
                    const rcClass = RC[rKey] || 'rc-common';
                    return `<div class="tl-fruit tl-mirage ${rcClass}" data-name="${f.name}" style="--rc:var(--${rKey})">
                                <img src="${window.imgBase || 'assets/fruits/'}${f.name}.webp" alt="${f.name}" width="44" height="44" loading="lazy" onerror="this.style.opacity=0.3">
                            </div>`;
                }).join('')}</div>
            </div>` : '';

        if (!normalColHtml && !mirageColHtml) return;

        // Lấy màu chấm tròn dựa trên trái xịn nhất
        let bestFruit = null;
        if (renderN.length > 0 && renderM.length > 0) {
            const rankN = RARITY_RANK[renderN[0].rarity.toLowerCase()] || 0;
            const rankM = RARITY_RANK[renderM[0].rarity.toLowerCase()] || 0;
            bestFruit = (rankM > rankN) ? renderM[0] : renderN[0];
        } else if (renderN.length > 0) { bestFruit = renderN[0]; } 
        else if (renderM.length > 0) { bestFruit = renderM[0]; }
        
        const dotColor = bestFruit ? (RC[bestFruit.rarity.toLowerCase()] || 'rc-common') : 'rc-common';

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

    // 4. THÔNG BÁO EMPTY/CAP TÙY NGỮ CẢNH
    if (totalMatches === 0) {
        let msg = historySearch ? `No results found for "${historySearch}".` : 'No entries found for selected filters.';
        el.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--muted);font-size:0.85rem;">${msg}</div>`;
    } else {
        el.appendChild(frag);
        if (totalMatches > 100) {
            const warning = document.createElement('div');
            warning.style = "text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;opacity:0.6;";
            warning.innerHTML = `Showing 100 of ${totalMatches} entries.`;
            el.appendChild(warning);
        }
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