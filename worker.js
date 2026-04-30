// ============================================================
// BFStock — Cloudflare Worker
// - scheduled(): Cron cào Gamersberg, lưu KV
// - fetch():     API trả data cho frontend
// ============================================================

const GAMERSBERG_URL = 'https://www.gamersberg.com/api/v1/blox-fruits/stock'
const KV_CURRENT     = 'current_stock'
const KV_HISTORY     = 'history'
const HISTORY_MAX    = 100  // giữ tối đa 100 entries

// ── Fruit database ──────────────────────────────────────────
// Gamersberg chỉ trả name + price, cần dict này để enrich
const FRUITS_DB = {
  'Rocket':   { robux: 50,   rarity: 'Common',    type: 'Natural'   },
  'Spin':     { robux: 75,   rarity: 'Common',    type: 'Natural'   },
  'Blade':    { robux: 100,  rarity: 'Common',    type: 'Natural'   },
  'Spring':   { robux: 180,  rarity: 'Common',    type: 'Natural'   },
  'Bomb':     { robux: 220,  rarity: 'Common',    type: 'Natural'   },
  'Smoke':    { robux: 250,  rarity: 'Common',    type: 'Elemental' },
  'Spike':    { robux: 380,  rarity: 'Common',    type: 'Natural'   },
  'Flame':    { robux: 550,  rarity: 'Uncommon',  type: 'Elemental' },
  'Eagle':    { robux: 650,  rarity: 'Uncommon',  type: 'Beast'     },
  'Ice':      { robux: 750,  rarity: 'Uncommon',  type: 'Elemental' },
  'Sand':     { robux: 850,  rarity: 'Uncommon',  type: 'Elemental' },
  'Dark':     { robux: 950,  rarity: 'Uncommon',  type: 'Elemental' },
  'Diamond':  { robux: 1000, rarity: 'Uncommon',  type: 'Natural'   },
  'Light':    { robux: 1100, rarity: 'Rare',      type: 'Elemental' },
  'Rubber':   { robux: 1200, rarity: 'Rare',      type: 'Natural'   },
  'Barrier':  { robux: 1250, rarity: 'Rare',      type: 'Natural'   },
  'Ghost':    { robux: 1275, rarity: 'Rare',      type: 'Natural'   },
  'Magma':    { robux: 1300, rarity: 'Rare',      type: 'Elemental' },
  'Quake':    { robux: 1500, rarity: 'Legendary', type: 'Natural'   },
  'Buddha':   { robux: 1650, rarity: 'Legendary', type: 'Beast'     },
  'Love':     { robux: 1700, rarity: 'Legendary', type: 'Natural'   },
  'Creation': { robux: 1750, rarity: 'Legendary', type: 'Natural'   },
  'Spider':   { robux: 1800, rarity: 'Legendary', type: 'Natural'   },
  'Sound':    { robux: 1900, rarity: 'Legendary', type: 'Natural'   },
  'Phoenix':  { robux: 2000, rarity: 'Legendary', type: 'Beast'     },
  'Portal':   { robux: 2000, rarity: 'Legendary', type: 'Natural'   },
  'Rumble':   { robux: 2100, rarity: 'Legendary', type: 'Elemental' },
  'Pain':     { robux: 2200, rarity: 'Legendary', type: 'Natural'   },
  'Blizzard': { robux: 2250, rarity: 'Legendary', type: 'Elemental' },
  'Gravity':  { robux: 2300, rarity: 'Mythical',  type: 'Natural'   },
  'Mammoth':  { robux: 2350, rarity: 'Mythical',  type: 'Beast'     },
  'T-Rex':    { robux: 2350, rarity: 'Mythical',  type: 'Beast'     },
  'Dough':    { robux: 2400, rarity: 'Mythical',  type: 'Elemental' },
  'Shadow':   { robux: 2425, rarity: 'Mythical',  type: 'Natural'   },
  'Venom':    { robux: 2450, rarity: 'Mythical',  type: 'Natural'   },
  'Control':  { robux: 2500, rarity: 'Mythical',  type: 'Natural'   },
  'Spirit':   { robux: 2550, rarity: 'Mythical',  type: 'Natural'   },
  'Tiger':    { robux: 2700, rarity: 'Mythical',  type: 'Beast'     },
  'Yeti':     { robux: 3000, rarity: 'Mythical',  type: 'Beast'     },
  'Gas':      { robux: 3500, rarity: 'Mythical',  type: 'Elemental' },
  'Kitsune':  { robux: 4000, rarity: 'Mythical',  type: 'Beast'     },
  'Dragon':   { robux: 5000, rarity: 'Mythical',  type: 'Beast'     },
}

const RARITY_RANK = { Mythical: 5, Legendary: 4, Rare: 3, Uncommon: 2, Common: 1 }

// ── Helpers ──────────────────────────────────────────────────

function cleanName(raw) {
  // "Rocket-Rocket" → "Rocket", "Rocket Fruit" → "Rocket"
  return raw.split('-')[0].replace(' Fruit', '').trim()
}

function enrichFruits(rawList) {
  const fruits = rawList.map(item => {
    const name = cleanName(item.name)
    const db   = FRUITS_DB[name]
    return {
      name,
      price:  item.price ?? db?.price ?? 0,
      robux:  db?.robux   ?? 0,
      rarity: db?.rarity  ?? 'Unknown',
      type:   db?.type    ?? 'Unknown',
    }
  })
  // Sắp xếp theo rarity → price
  fruits.sort((a, b) =>
    (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0)
    || b.price - a.price
  )
  return fruits
}

async function fetchGamersberg() {
  const res = await fetch(GAMERSBERG_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer':    'https://www.gamersberg.com/blox-fruits/stock',
    },
  })
  if (!res.ok) throw new Error(`Gamersberg ${res.status}`)
  const json = await res.json()
  if (!json.success || !json.data?.[0]) throw new Error('Bad response')
  return json.data[0]
}

async function updateHistory(env, normalFruits, mirageFruits, now) {
  const raw     = await env.BF_STOCK.get(KV_HISTORY)
  const history = raw ? JSON.parse(raw) : []

  // Lưu nếu normal HOẶC mirage thay đổi
  const lastEntry          = history[history.length - 1]
  const currentNormalNames = sorted(normalFruits.map(f => f.name))
  const currentMirageNames = sorted(mirageFruits.map(f => f.name))
  const lastNormalNames    = lastEntry ? sorted(lastEntry.stock.map(f => f.name)) : []
  const lastMirageNames    = lastEntry ? sorted((lastEntry.mirageStock ?? []).map(f => f.name)) : []

  const normalSame = JSON.stringify(currentNormalNames) === JSON.stringify(lastNormalNames)
  const mirageSame = JSON.stringify(currentMirageNames) === JSON.stringify(lastMirageNames)
  if (normalSame && mirageSame) return false

  history.push({
    updated:     now,
    stock:       normalFruits,
    mirageStock: mirageFruits,
  })

  // Giữ tối đa HISTORY_MAX entries
  if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX)

  await env.BF_STOCK.put(KV_HISTORY, JSON.stringify(history))
  return true
}

function sorted(arr) {
  return [...arr].sort()
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// ── Main ─────────────────────────────────────────────────────

export default {

  // Cron trigger — chạy đúng giờ reset
  async scheduled(event, env, ctx) {
    console.log('[Cron] Running at', new Date().toISOString())

    const hub          = await fetchGamersberg()
    const normalFruits = enrichFruits(hub.normalStock ?? [])
    const mirageFruits = enrichFruits(hub.mirageStock ?? [])
    const now          = new Date().toISOString()

    const out = {
      updated:     now,
      stock:       normalFruits,
      mirageStock: mirageFruits,
      source:      'Gamersberg',
    }

    await env.BF_STOCK.put(KV_CURRENT, JSON.stringify(out))

    const changed = await updateHistory(env, normalFruits, mirageFruits, now)
    console.log(`[Cron] Done. Stock changed: ${changed}`)
  },

  // HTTP handler — trả data cho frontend
  async fetch(request, env) {
    const url      = new URL(request.url)
    const pathname = url.pathname

    // GET /stock → current stock
    if (pathname === '/' || pathname === '/stock') {
      const raw = await env.BF_STOCK.get(KV_CURRENT)
      if (!raw) return jsonResponse({ error: 'No data yet' }, 503)
      return new Response(raw, {
        headers: {
          'Content-Type':                'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control':               'public, max-age=30',
        },
      })
    }

    // GET /history → lịch sử
    if (pathname === '/history') {
      const raw = await env.BF_STOCK.get(KV_HISTORY)
      if (!raw) return jsonResponse([])
      return new Response(raw, {
        headers: {
          'Content-Type':                'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control':               'public, max-age=60',
        },
      })
    }

    // GET /health → debug
    if (pathname === '/health') {
      const stock   = await env.BF_STOCK.get(KV_CURRENT)
      const history = await env.BF_STOCK.get(KV_HISTORY)
      const parsed  = stock ? JSON.parse(stock) : null
      return jsonResponse({
        ok:           !!stock,
        updated:      parsed?.updated ?? null,
        fruitCount:   parsed?.stock?.length ?? 0,
        mirageCount:  parsed?.mirageStock?.length ?? 0,
        historyCount: history ? JSON.parse(history).length : 0,
      })
    }

    return jsonResponse({ error: 'Not found' }, 404)
  },
}