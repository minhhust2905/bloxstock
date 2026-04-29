import requests
import os
import json
import time

# Đường dẫn lưu trữ
SAVE_DIR = "assets/fruits"
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)

# Danh sách trái ác quỷ (lấy từ scrape.py hoặc định nghĩa lại)
FRUITS = [
    "Rocket", "Spin", "Blade", "Spring", "Bomb", "Smoke", "Spike", "Flame", "Falcon", "Ice", 
    "Sand", "Dark", "Diamond", "Light", "Rubber", "Barrier", "Ghost", "Magma", "Quake", 
    "Buddha", "Love", "Spider", "Sound", "Phoenix", "Portal", "Rumble", "Pain", "Blizzard", 
    "Gravity", "Mammoth", "T-Rex", "Dough", "Shadow", "Venom", "Control", "Spirit", "Tiger", 
    "Yeti", "Gas", "Kitsune", "Dragon"
]

API_URL = "https://blox-fruits.fandom.com/api.php"

def get_image_url(fruit_name):
    # Thử các pattern tên file phổ biến trên Wiki
    patterns = [
        f"File:{fruit_name} (Fruit).png",
        f"File:{fruit_name} Fruit.png",
        f"File:{fruit_name} (Icon).png",
        f"File:{fruit_name}.png"
    ]
    
    for filename in patterns:
        params = {
            "action": "query",
            "titles": filename,
            "prop": "imageinfo",
            "iiprop": "url",
            "format": "json"
        }
        try:
            r = requests.get(API_URL, params=params, timeout=10)
            data = r.json()
            pages = data.get("query", {}).get("pages", {})
            for page_id in pages:
                if "imageinfo" in pages[page_id]:
                    return pages[page_id]["imageinfo"][0]["url"]
        except Exception as e:
            print(f"Lỗi khi tìm {filename}: {e}")
    
    return None

def download_all():
    print(f"Bắt đầu tải ảnh vào {SAVE_DIR}...")
    for fruit in FRUITS:
        target_path = os.path.join(SAVE_DIR, f"{fruit}.png")
        
        # Nếu đã có rồi thì bỏ qua
        if os.path.exists(target_path):
            print(f"[-] Đã có {fruit}, bỏ qua.")
            continue
            
        print(f"[*] Đang tìm ảnh cho {fruit}...")
        url = get_image_url(fruit)
        
        if url:
            try:
                img_data = requests.get(url).content
                with open(target_path, 'wb') as f:
                    f.write(img_data)
                print(f"[+] Đã tải xong: {fruit}.png")
            except Exception as e:
                print(f"[!] Không thể tải {fruit}: {e}")
        else:
            print(f"[!] Không tìm thấy ảnh cho {fruit} trên Wiki.")
            
        # Nghỉ một chút để tránh bị Wiki chặn
        time.sleep(0.5)

if __name__ == "__main__":
    download_all()
    print("\nHoàn tất! Bạn hãy kiểm tra thư mục assets/fruits nhé.")
