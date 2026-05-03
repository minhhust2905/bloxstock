# 🛠️ BloxStock — Hướng dẫn Bảo trì Định kỳ

Tài liệu này giúp bạn kiểm tra và cập nhật hệ thống để đảm bảo Bot luôn hoạt động ổn định và tàng hình tốt nhất.

---

## 1. Cập nhật Trình duyệt (User-Agent)
**Tần suất:** 4 - 6 tháng/lần.
**Mục tiêu:** Tránh để Bot trông quá lạc hậu so với người dùng thật.

- **File cần sửa:** `backend/worker.js`
- **Dòng cần tìm:** `const BROWSER_HEADERS = { ... 'User-Agent': '... Chrome/124.0.0.0 ...' }`
- **Cách làm:** Vào [WhatIsMyBrowser.com](https://www.whatismybrowser.com/guides/the-latest-user-agent/chrome) để lấy số phiên bản Chrome mới nhất và thay thế vào.

---

## 2. Kiểm tra Cổng FruityBlox (Next-Action)
**Tần suất:** Chỉ khi Cổng F báo lỗi trong Lịch sử hoặc Discord.
**Dấu hiệu:** FruityBlox cập nhật giao diện web làm thay đổi ID nội bộ.

- **File cần sửa:** `backend/worker.js`
- **Biến cần tìm:** `const FRUITYBLOX_ACTION = '...'`
- **Cách lấy mã mới:** 
    1. Mở trang `fruityblox.com/stock`.
    2. Nhấn **F12** -> Tab **Network**.
    3. F5 trang web, tìm các request có header `Next-Action`.
    4. Copy cái mã ID đó dán vào code.

---

## 3. Kiểm tra Trái ác quỷ mới (Unknown Fruits)
**Tần suất:** Mỗi khi game có bản cập nhật (Update) mới.
**Cách làm:**
1. Truy cập trang Health của bạn: `https://core-api.[tên-của-bạn].workers.dev/health?token=[mật-mã]`
2. Kiểm tra mục `unknownFruits`.
3. Nếu thấy có tên trái mới (ví dụ: "Yeti" hay "Gas"), hãy vào `backend/worker.js` để thêm thông số vào `FRUITS_DB`.

---

## 4. Quản lý Mật mã (Health Token)
**Tần suất:** 1 năm/lần hoặc khi nghi ngờ bị lộ.
- **Cách làm:** Vào Cloudflare Dashboard -> Settings -> Variables -> Đổi giá trị `HEALTH_TOKEN`.

---

## 5. Dọn dẹp Lịch sử (Reset History)
**Tần suất:** Không bắt buộc (Code đã tự động xóa cái cũ nhất khi vượt quá 100 mốc).
- **Cách làm:** Nếu muốn xóa sạch để làm lại từ đầu, hãy tạo một **KV Namespace** mới và Bind lại vào Worker (Variable Name: `BLOXSTOCK`) như chúng ta đã làm.

---

> **Ghi chú:** Hệ thống đã được thiết kế cực kỳ ổn định. Nếu web vẫn chạy bình thường và Discord không báo lỗi, bạn không cần phải làm gì cả! Hãy tận hưởng thành quả. 🚀✨

