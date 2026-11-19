# Hệ Thống Ôn Tập Trắc Nghiệm Vật Lý Đại Cương - EPU

Ứng dụng web ôn tập môn **Vật lý đại cương** (362 câu hỏi trắc nghiệm chuẩn ngân hàng đề kèm đáp án bôi màu gốc từ tệp đề cương EPU).

---

## 🌟 Tính Năng Nổi Bật

- **🎯 Chế độ Luyện tập**: Bấm chọn A / B / C / D để kiểm tra kết quả ngay lập tức (Đúng: Xanh, Sai: Đỏ).
- **🎨 Bản gốc bôi màu**: Nút bấm 1-click cho phép chuyển đổi xem trích đoạn PDF gốc có vết bôi màu highlight để đối chiếu minh bạch.
- **⏱️ Chế độ Thi thử (Exam Mode)**:
  - **⚡ Chế độ biết kết quả ngay khi chọn**: Vừa làm vừa biết đúng/sai từng câu và xem bảng điểm trực tiếp.
  - **📝 Chế độ thi thử tiêu chuẩn**: Làm hết thời gian hoặc bấm Nộp bài mới hiển thị bảng điểm và xếp loại.
  - Tùy chọn phạm vi (toàn bộ 10 chương hoặc từng chương), số câu (20, 40, 50 hoặc toàn bộ), đồng hồ bấm giờ và bảng câu hỏi chuyển nhanh.
- **🃏 Flashcard (Học thuộc nhanh)**: Xem câu hỏi và lật thẻ để hiển thị đáp án, đánh dấu "Đã thuộc" / "Chưa nhớ".
- **❌ Ngân hàng câu sai (Mistake Bank)**: Tự động tổng hợp các câu bạn làm sai để luyện tập lại.
- **⭐ Đánh dấu câu hỏi (Bookmarks)**: Lưu lại các câu khó để ôn tập sau.
- **📋 Bảng tra cứu 362 câu**: Xem ma trận toàn bộ đề thi, tìm kiếm theo từ khóa hoặc số câu và nhảy nhanh đến câu cần làm.
- **🌙 Chế độ Sáng / Tối (Dark / Light Theme)** & Âm thanh sống động.
- **⌨️ Hỗ trợ phím tắt**:
  - `A`, `B`, `C`, `D` hoặc `1`, `2`, `3`, `4`: Chọn đáp án.
  - `←` / `→`: Chuyển câu trước / câu sau.
  - `Space`: Lật thẻ / xem đáp án nhanh.
  - `F` / `S`: Đánh dấu câu hỏi.
- **💾 Lưu tiến độ tự động**: Dữ liệu lưu trong `localStorage` của trình duyệt, không bị mất khi tải lại trang.

---

## 📚 Cấu Trúc Ngân Hàng Đề (10 Chương - 362 Câu)

1. **Chương 1**: Động học chất điểm (40 câu)
2. **Chương 2**: Động lực học chất điểm (38 câu)
3. **Chương 3**: Động lực học hệ chất điểm - Vật rắn (25 câu)
4. **Chương 4**: Năng lượng - Công - Định luật bảo toàn (38 câu)
5. **Chương 5**: Nhiệt động lực học - Khí lý tưởng (36 câu)
6. **Chương 6**: Điện trường tĩnh (41 câu)
7. **Chương 7**: Vật dẫn - Tụ điện - Năng lượng điện trường (32 câu)
8. **Chương 8**: Từ trường (30 câu)
9. **Chương 9**: Hiện tượng cảm ứng điện từ (28 câu)
10. **Chương 10**: Quang học - Bức xạ nhiệt & Lượng tử (54 câu)

---

## 🚀 Hướng Dẫn Sử Dụng

### Cách 1: Chạy trực tiếp trên máy tính (Offline 100%)
- Tải về hoặc clone repository:
  ```bash
  git clone https://github.com/ThTuanIT/VLDC.git
  ```
- Nhấp đúp vào file `index.html` hoặc `Mo_Web_On_Tap.bat` để mở ngay trên bất kỳ trình duyệt nào (Chrome, Edge, Firefox, Cốc Cốc, Safari,...).

### Cách 2: Triển khai online miễn phí qua GitHub Pages
1. Vào repository trên GitHub: **Settings** -> **Pages**.
2. Ở mục **Build and deployment** -> **Source**: Chọn `Deploy from a branch`.
3. Nhánh chọn `main` / `master` (thư mục `/root`).
4. Bấm **Save**. Sau ~1 phút, bạn có thể truy cập website online tại:
   `https://thtuanit.github.io/VLDC/`
