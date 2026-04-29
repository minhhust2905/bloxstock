import requests
import json
import re
from datetime import datetime, timezone

API = "https://blox-fruits.fandom.com/api.php"
PARAMS = {
    "action": "parse",
    "page": 'Blox Fruits "Stock"',
    "prop": "wikitext",
    "format": "json"
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

def scrape():
    r = requests.get(API, params=PARAMS, timeout=10)
    wikitext = r.json()["parse"]["wikitext"]["*"]


    # DEBUG: in ra 500 ký tự đầu để xem format
    print("=== WIKITEXT SAMPLE ===")
    print(wikitext[:500])
    print("=== END ===")

    match = re.search(r"^\s*\|Current\s*=\s*(.+)", wikitext, re.MULTILINE)
    if not match:
        print("Không tìm thấy stock!")
        return

    names = [n.strip() for n in match.group(1).split(",")]
    
    # Rocket và Spin luôn có trong stock
    for perm in ["Rocket", "Spin"]:
        if perm not in names:
            names.append(perm)
    fruits = []
    for name in names:
        info = FRUITS.get(name)
        if info:
            fruits.append({"name": name, **info})
        else:
            fruits.append({"name": name, "price": 0, "robux": 0, "rarity": "Unknown", "type": "Unknown"})

    fruits.sort(key=lambda x: x["price"], reverse=True)

    out = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "stock": fruits
    }

    with open("data/stock.json", "w") as f:
        json.dump(out, f, indent=2)

    print(f"Done: {[f['name'] for f in fruits]}")

scrape()