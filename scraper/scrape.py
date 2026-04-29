import requests
import json
import os
import re
import time
import random
from datetime import datetime, timezone

# --- CONFIG ---
WIKI_API = "https://blox-fruits.fandom.com/api.php"
GAMERSBERG_API = "https://www.gamersberg.com/api/v1/blox-fruits/stock"

STEALTH_HEADERS = {
    "accept": "*/*",
    "accept-language": "vi,en-US;q=0.9,en;q=0.8",
    "referer": "https://www.gamersberg.com/blox-fruits/stock",
    "sec-ch-ua": '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
}

FRUITS = {
    "Rocket":   {"price": 5000,     "robux": 50,   "rarity": "Common",    "type": "Natural"},
    "Spin":     {"price": 7500,     "robux": 75,   "rarity": "Common",    "type": "Natural"},
    "Blade":    {"price": 30000,    "robux": 100,  "rarity": "Common",    "type": "Natural"},
    "Spring":   {"price": 60000,    "robux": 180,  "rarity": "Common",    "type": "Natural"},
    "Bomb":     {"price": 80000,    "robux": 220,  "rarity": "Common",    "type": "Natural"},
    "Smoke":    {"price": 100000,   "robux": 250,  "rarity": "Common",    "type": "Elemental"},
    "Spike":    {"price": 180000,   "robux": 380,  "rarity": "Common",    "type": "Natural"},
    "Flame":    {"price": 250000,   "robux": 550,  "rarity": "Uncommon",  "type": "Elemental"},
    "Falcon":   {"price": 300000,   "robux": 650,  "rarity": "Uncommon",  "type": "Beast"},
    "Ice":      {"price": 350000,   "robux": 750,  "rarity": "Uncommon",  "type": "Elemental"},
    "Sand":     {"price": 420000,   "robux": 850,  "rarity": "Uncommon",  "type": "Elemental"},
    "Dark":     {"price": 500000,   "robux": 950,  "rarity": "Uncommon",  "type": "Elemental"},
    "Diamond":  {"price": 600000,   "robux": 1000, "rarity": "Uncommon",  "type": "Natural"},
    "Light":    {"price": 650000,   "robux": 1100, "rarity": "Rare",      "type": "Elemental"},
    "Rubber":   {"price": 750000,   "robux": 1200, "rarity": "Rare",      "type": "Natural"},
    "Barrier":  {"price": 800000,   "robux": 1250, "rarity": "Rare",      "type": "Natural"},
    "Ghost":    {"price": 940000,   "robux": 1275, "rarity": "Rare",      "type": "Natural"},
    "Magma":    {"price": 960000,   "robux": 1300, "rarity": "Rare",      "type": "Elemental"},
    "Quake":    {"price": 1000000,  "robux": 1500, "rarity": "Legendary", "type": "Natural"},
    "Buddha":   {"price": 1200000,  "robux": 1650, "rarity": "Legendary", "type": "Beast"},
    "Love":     {"price": 1300000,  "robux": 1700, "rarity": "Legendary", "type": "Natural"},
    "Spider":   {"price": 1500000,  "robux": 1800, "rarity": "Legendary", "type": "Natural"},
    "Sound":    {"price": 1700000,  "robux": 1900, "rarity": "Legendary", "type": "Natural"},
    "Phoenix":  {"price": 1800000,  "robux": 2000, "rarity": "Legendary", "type": "Beast"},
    "Portal":   {"price": 1900000,  "robux": 2000, "rarity": "Legendary", "type": "Natural"},
    "Rumble":   {"price": 2100000,  "robux": 2100, "rarity": "Legendary", "type": "Elemental"},
    "Pain":     {"price": 2300000,  "robux": 2200, "rarity": "Legendary", "type": "Natural"},
    "Blizzard": {"price": 2400000,  "robux": 2250, "rarity": "Legendary", "type": "Elemental"},
    "Gravity":  {"price": 2500000,  "robux": 2300, "rarity": "Mythical",  "type": "Natural"},
    "Mammoth":  {"price": 2700000,  "robux": 2350, "rarity": "Mythical",  "type": "Beast"},
    "T-Rex":    {"price": 2700000,  "robux": 2350, "rarity": "Mythical",  "type": "Beast"},
    "Dough":    {"price": 2800000,  "robux": 2400, "rarity": "Mythical",  "type": "Elemental"},
    "Shadow":   {"price": 2900000,  "robux": 2425, "rarity": "Mythical",  "type": "Natural"},
    "Venom":    {"price": 3000000,  "robux": 2450, "rarity": "Mythical",  "type": "Natural"},
    "Control":  {"price": 3200000,  "robux": 2500, "rarity": "Mythical",  "type": "Natural"},
    "Spirit":   {"price": 3400000,  "robux": 2550, "rarity": "Mythical",  "type": "Natural"},
    "Tiger":    {"price": 5000000,  "robux": 2700, "rarity": "Mythical",  "type": "Beast"},
    "Yeti":     {"price": 6000000,  "robux": 3000, "rarity": "Mythical",  "type": "Beast"},
    "Gas":      {"price": 8000000,  "robux": 3500, "rarity": "Mythical",  "type": "Elemental"},
    "Kitsune":  {"price": 8000000,  "robux": 4000, "rarity": "Mythical",  "type": "Beast"},
    "Dragon":   {"price": 15000000, "robux": 5000, "rarity": "Mythical",  "type": "Beast"},
}

def get_wiki_stock():
    print("--- Phân tích Wiki (Fallback) ---")
    params = {"action": "parse", "page": 'Blox Fruits "Stock"', "prop": "wikitext", "format": "json"}
    r = requests.get(WIKI_API, params=params, timeout=10)
    wikitext = r.json()["parse"]["wikitext"]["*"]
    match = re.search(r"^\s*\|Current\s*=\s*(.+)", wikitext, re.MULTILINE)
    if not match: return None
    names = [n.strip() for n in match.group(1).split(",")]
    for perm in ["Rocket", "Spin"]:
        if perm not in names: names.append(perm)
    return names

def process_fruit_names(raw_names):
    fruits = []
    for name in raw_names:
        # Làm sạch tên: "Rocket-Rocket" -> "Rocket", "Rocket Fruit" -> "Rocket"
        clean_name = name.split("-")[0].replace(" Fruit", "").strip()
        info = FRUITS.get(clean_name)
        if info:
            fruits.append({"name": clean_name, **info})
        else:
            fruits.append({"name": clean_name, "price": 0, "robux": 0, "rarity": "Unknown", "type": "Unknown"})
    
    # Sắp xếp theo độ hiếm
    rarity_order = {"Mythical": 5, "Legendary": 4, "Rare": 3, "Uncommon": 2, "Common": 1}
    fruits.sort(key=lambda x: (rarity_order.get(x["rarity"], 0), x["price"]), reverse=True)
    return fruits

def scrape():
    # --- Stealth Delay ---
    delay = random.randint(3, 10)
    print(f"Chờ {delay} giây...")
    time.sleep(delay)

    normal_names = []
    mirage_names = []
    source = "Wiki"

    # --- Ưu tiên Gamersberg API ---
    try:
        print("--- Thử lấy dữ liệu từ Gamersberg API ---")
        r = requests.get(GAMERSBERG_API, headers=STEALTH_HEADERS, timeout=15)
        if r.status_code == 200:
            data = r.json()
            if data.get("success") is True and data.get("data"):
                # Cấu trúc thật: data[0]["normalStock"]
                hub = data["data"][0]
                normal_names = [item["name"] for item in hub.get("normalStock", [])]
                mirage_names = [item["name"] for item in hub.get("mirageStock", [])]
                source = "Gamersberg"
                print("Thành công: Lấy dữ liệu từ Gamersberg")
        else:
            print(f"Thất bại: Gamersberg trả về lỗi {r.status_code}")
    except Exception as e:
        print(f"Lỗi khi gọi Gamersberg: {e}")

    # --- Fallback sang Wiki ---
    if not normal_names:
        try:
            normal_names = get_wiki_stock()
            if normal_names:
                print("Thành công: Lấy dữ liệu từ Wiki (Fallback)")
        except Exception as e:
            print(f"Lỗi khi gọi Wiki: {e}")

    if not normal_names:
        print("CRITICAL: Không lấy được dữ liệu!")
        return

    # --- Xử lý dữ liệu ---
    normal_fruits = process_fruit_names(normal_names)
    mirage_fruits = process_fruit_names(mirage_names) if mirage_names else []

    now_iso = datetime.now(timezone.utc).isoformat()
    out = {
        "updated": now_iso, 
        "stock": normal_fruits, 
        "mirageStock": mirage_fruits,
        "source": source
    }

    # Lưu dữ liệu
    with open("data/stock.json", "w") as f:
        json.dump(out, f, indent=2)

    # Lưu lịch sử (chỉ lưu stock thường)
    history_path = "data/history.json"
    if os.path.exists(history_path):
        with open(history_path, "r") as f: history = json.load(f)
    else:
        history = []

    current_names = sorted([f["name"] for f in normal_fruits])
    last_names = sorted([f["name"] for f in history[-1]["stock"]]) if history else []

    if current_names != last_names:
        history.append({"updated": now_iso, "stock": normal_fruits})
        history = history[-200:]
        with open(history_path, "w") as f:
            json.dump(history, f, indent=2)
        print(f"Đã lưu lịch sử mới")

    print(f"Xong! (Source: {source}, Mirage Fruits: {len(mirage_fruits)})")

if __name__ == "__main__":
    scrape()