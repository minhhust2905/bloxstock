# 💎 BloxStock — Real-time Blox Fruits Tracker

**BloxStock** là một hệ thống theo dõi Stock (Trái ác quỷ) trong game Blox Fruits một cách tự động, chính xác và chuyên nghiệp. Dự án được thiết kế với tiêu chí: **Tàng hình (Stealth)**, **Bảo mật (Security)** và **Trải nghiệm người dùng (UX) đỉnh cao**.

---

## 🚀 Tính năng nổi bật

- **⚡ Real-time Synchronization:** Hệ thống tự động cập nhật Stock mới nhất mỗi khi game reset (Normal Stock 4h/lần, Mirage Stock 2h/lần).
- **🕵️‍♂️ Stealth Scraping Technology:** Sử dụng Cloudflare Workers với bộ Header giả lập trình duyệt (Fingerprinting) để thu thập dữ liệu an toàn, tránh bị block IP.
- **📊 Advanced Analytics:** Cung cấp lịch sử Stock (History) và thống kê tỉ lệ xuất hiện của các loại trái cây dựa trên hàng trăm chu kỳ phân tích.
- **🛡️ 4-Layer Security:** Hệ thống bảo mật đa lớp (Origin Check, UA Blocking, Referer Validation, Health Token) giúp bảo vệ dữ liệu khỏi các bot cào trái phép.
- **📱 Premium Responsive UI:** Giao diện phong cách Modern Dark Mode, tối ưu hoàn hảo cho cả máy tính và điện thoại.

---

## 🛠️ Công nghệ sử dụng

- **Frontend:** Vanilla HTML5, CSS3 (Modern Design System), JavaScript (ES6+).
- **Backend:** Cloudflare Workers (Serverless Architecture).
- **Storage:** Cloudflare KV (Key-Value Storage).
- **Data Engine:** Python (dùng để phân tích số liệu và tính toán tỉ lệ).

---

## 📂 Cấu trúc thư mục

```text
├── assets/             # Tài nguyên tĩnh (CSS, JS, Images, Fonts)
├── backend/            # Mã nguồn Cloudflare Worker (API & Scraper)
├── docs/               # Tài liệu nghiên cứu, pháp lý và kỹ thuật
├── nghiencuu/          # Các script Python phân tích dữ liệu thô
├── index.html          # Trang chủ chính
└── README.md           # Tài liệu tóm tắt dự án
```

---

## ⚖️ Pháp lý & Bản quyền (Legal)

- **BloxStock** là một dự án fan-made, hoàn toàn độc lập và không liên quan đến **Roblox Corporation** hay **Gamer Robot Inc.**
- Dữ liệu được đồng bộ hóa dựa trên các hồ sơ công khai (Wiki) dưới hình thức **Sử dụng hợp lý (Fair Use)**.
- Mọi tài sản hình ảnh và tên gọi trong game thuộc về chủ sở hữu bản quyền tương ứng.

---

## 🛠️ Bảo trì & Phát triển

Xem chi tiết tại [MAINTENANCE.md](docs/MAINTENANCE.md) hoặc file gốc để biết cách vận hành hệ thống.

---
**BloxStock — Built for the community with ❤️**
