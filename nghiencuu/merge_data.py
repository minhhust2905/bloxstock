import json
import os
from datetime import datetime
from pathlib import Path

# Thư mục hiện tại (nghiencuu/)
CURRENT_DIR = Path(__file__).parent
PROJECT_DIR = CURRENT_DIR.parent

OBSERVED_FILE = CURRENT_DIR / 'observed_rates.json'
WEB_FRUITS_DB = PROJECT_DIR / 'assets' / 'data' / 'fruits.json'

def load_json(filepath):
    if not filepath.exists():
        print(f"[Error] File not found: {filepath}")
        return None
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[Success] Saved: {filepath}")

def main():
    print("🚀 Bắt đầu quá trình hợp nhất dữ liệu...")
    
    observed = load_json(OBSERVED_FILE)
    if not observed: return

    master_data = load_json(WEB_FRUITS_DB)
    if not master_data:
        print("[Error] Không tìm thấy assets/data/fruits.json")
        return

    rates = observed.get('rates', {})
    total_cycles = observed.get('total_cycles', 0)
    today_str = datetime.utcnow().strftime('%Y-%m-%d')

    # Xử lý cập nhật cho master_data
    updated_count = 0
    for key, info in master_data['fruits'].items():
        lookup_key = key.lower() # observed_rates dùng key viết thường
        
        # Hardcode Dragon = 0.0 (Off-sale)
        if key == 'Dragon':
            info['chance'] = 0.0
            updated_count += 1
            continue

        if lookup_key in rates:
            new_chance = rates[lookup_key]['rate_pct']
            if info.get('chance') != new_chance:
                info['chance'] = new_chance
                updated_count += 1
        else:
            # Nếu trái có trong DB nhưng không xuất hiện ở Wiki 2026, set chance = 0.0
            if info.get('chance', 0) != 0.0:
                info['chance'] = 0.0
                updated_count += 1

    # Cập nhật metadata
    master_data['last_updated'] = today_str
    master_data['total_cycles_analyzed'] = total_cycles

    print(f"🔄 Đã cập nhật {updated_count} trái cây với tỉ lệ mới.")

    # Lưu trực tiếp vào "Bản chính" (assets/data)
    WEB_FRUITS_DB.parent.mkdir(parents=True, exist_ok=True)
    save_json(WEB_FRUITS_DB, master_data)

    print("✅ Hoàn tất quá trình hợp nhất!")

if __name__ == '__main__':
    main()
