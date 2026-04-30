from PIL import Image
import os

SOURCE_DIR = "assets/fruits"
TARGET_SIZE = (256, 256)

def optimize():
    print(f"Bắt đầu tối ưu hóa ảnh trong {SOURCE_DIR}...")
    
    # Hỗ trợ cả .png và .webp
    files = [f for f in os.listdir(SOURCE_DIR) if f.lower().endswith((".png", ".webp"))]
    
    if not files:
        print("Không tìm thấy file ảnh nào để tối ưu.")
        return

    for filename in files:
        file_path = os.path.join(SOURCE_DIR, filename)
        name_without_ext = os.path.splitext(filename)[0]
        temp_path = os.path.join(SOURCE_DIR, f"{name_without_ext}_temp.webp")
        target_path = os.path.join(SOURCE_DIR, f"{name_without_ext}.webp")
        
        try:
            with Image.open(file_path) as img:
                # Chuyển sang RGBA nếu chưa có để giữ nền trong suốt
                img = img.convert("RGBA")
                
                # Resize giữ tỷ lệ (thumbnail)
                img.thumbnail(TARGET_SIZE, Image.Resampling.LANCZOS)
                
                # Tạo một frame trống 256x256 để paste ảnh vào giữa (nếu ảnh không vuông)
                final_img = Image.new("RGBA", TARGET_SIZE, (0, 0, 0, 0))
                offset = ((TARGET_SIZE[0] - img.size[0]) // 2, (TARGET_SIZE[1] - img.size[1]) // 2)
                final_img.paste(img, offset)
                
                # Lưu vào file tạm trước
                final_img.save(temp_path, "WEBP", quality=85)
                
            # Xóa file cũ và đổi tên file tạm
            if os.path.exists(file_path):
                os.remove(file_path)
            os.rename(temp_path, target_path)
            
            print(f"[OK] Đã tối ưu: {filename} -> {name_without_ext}.webp")
            
        except Exception as e:
            if os.path.exists(temp_path): os.remove(temp_path)
            print(f"[Lỗi] Không thể xử lý {filename}: {e}")

    print("\nHoàn tất tối ưu hóa! Toàn bộ ảnh hiện đã là .webp và có kích thước chuẩn 256x256.")

if __name__ == "__main__":
    optimize()
