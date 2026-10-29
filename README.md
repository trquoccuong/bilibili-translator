# 🎬 Bilibili Dub: lồng tiếng Việt cho Bilibili


Nó làm gì: lấy phụ đề CC/AI tiếng Trung của video, nhờ **Claude** dịch sang tiếng Việt (hoặc tiếng Anh), rồi dùng giọng đọc có sẵn trên máy đọc lên khớp với video. Giọng đọc không phải lồng tiếng phim rạp đâu, nhưng xem tutorial, vlog thì ổn áp 👌

## ✨ Làm được gì

- 🗣️ **Lồng tiếng tự động**: đọc lời dịch theo đúng thời điểm, tiếng gốc được vặn nhỏ lại
- 🧠 **Dịch theo ngữ cảnh**: Claude đọc cả đoạn nên giữ được cách xưng hô, tên riêng nhất quán (không như dịch từng câu)
- ⏱️ **Khớp thời gian**: câu dài thì đọc nhanh hơn, quá dài thì video tự chậm lại một chút để chờ
- 🎭 **Có chút cảm xúc**: câu hỏi thì lên giọng, đoạn hào hứng thì đọc nhanh và to hơn, theo cả độ to nhỏ của tiếng gốc
- 🔤 **Đọc đúng chữ**: "AI" đọc là "ây ai", còn "ai" vẫn là "ai". Có từ điển phát âm để tự sửa
- 🌏 **Chọn ngôn ngữ**: Tiếng Việt hoặc English, chọn được giọng đọc
- 💸 **Theo dõi chi phí**: báo giá trước khi dịch, có lịch sử và xuất CSV
- 💾 **Dịch một lần, xem mãi**: bản dịch được lưu lại, xem lại không tốn tiền

## 📦 Cài đặt

1. Tải project này về máy (clone hoặc tải zip rồi giải nén).
2. Mở Chrome, vào `chrome://extensions`.
3. Bật **Developer mode** (góc trên bên phải).
4. Bấm **Load unpacked** → chọn thư mục `bilibili-translator`.
5. Ghim icon extension lên thanh công cụ cho dễ bấm 📌

## ⚙️ Thiết lập (làm một lần)

### 1. Lấy Claude API key

- Vào [console.anthropic.com](https://console.anthropic.com/settings/keys), tạo một API key mới.
- **Nên đặt giới hạn chi tiêu** cho key này (vài đô là thừa dùng), cho chắc ăn.
- Bấm icon extension → dán key vào ô **API key**. Thấy chữ **Sẵn sàng** màu xanh là ok.

### 2. Cài giọng đọc

Extension dùng giọng đọc có sẵn của máy (miễn phí):

- **macOS**: System Settings → Accessibility → Spoken Content → System voice → **Manage Voices** → tải giọng **Linh** (tiếng Việt) hoặc một giọng tiếng Anh.
- **Windows**: Settings → Time & Language → Speech → thêm giọng tiếng Việt.

Sau đó bấm icon extension → chọn **Giọng đọc** → bấm ▶ để nghe thử.

### 3. Đăng nhập Bilibili

Phụ đề AI của Bilibili chỉ hiện khi đã đăng nhập, nên nhớ đăng nhập trên Chrome nhé.

## ▶️ Cách dùng

1. Mở một video Bilibili có phụ đề (CC hoặc AI).
2. Bấm nút **🇻🇳 Lồng tiếng** ở góc trên bên trái video.
3. Extension báo chi phí ước tính → bấm **OK**.
4. Bấm phát video và thưởng thức 🍿

Nút sẽ hiện tiến độ kiểu `⏳ đã dịch 40/403` rồi `✓ dịch xong`. Muốn dịch lại (ví dụ sau khi cập nhật extension) thì bấm **↻ Dịch lại**.

## 💰 Tốn bao nhiêu?

Rẻ thôi. Với model mặc định **Claude Haiku 5.5**, một video 10–15 phút tốn khoảng **$0.01–0.02**. Muốn dịch hay hơn thì đổi sang Sonnet hoặc Opus trong popup, giá cao hơn nhưng vẫn chỉ vài chục cent. Giọng đọc thì miễn phí.

Số tiền trong tab **Chi phí** là ước tính từ số token. Số chính xác xem ở trang Billing của Anthropic Console.

## 🤷 Chưa làm được

- Video **không có phụ đề** thì chịu (chưa có nhận dạng giọng nói)
- Giọng đọc của máy vẫn hơi "robot", chưa có cảm xúc như người thật
- Đoạn nói quá nhanh thì video sẽ chậm lại chút xíu để giọng đọc theo kịp
- Mới thử trên Chrome + macOS

## 🔒 Về API key

Key chỉ lưu trong Chrome trên máy bạn và chỉ gửi tới `api.anthropic.com`. Key không được mã hoá, nên đừng dùng chung máy với người lạ và nhớ đặt giới hạn chi tiêu.

## 🛠️ Dành cho ai muốn vọc code

Không cần build gì cả, sửa code xong bấm **Reload** trong `chrome://extensions` là xong.

```
src/
├── shared/       # logic dùng chung: thời gian, prompt dịch, ngôn ngữ, giá, ngữ điệu
├── background/   # gọi Claude API, lưu lịch sử chi phí
├── content/      # chạy trên trang Bilibili: lấy phụ đề, nút bấm, đọc giọng
└── popup/        # cửa sổ cài đặt + chi phí
test/             # node test/shared.test.js
```

Chạy test:

```bash
node test/shared.test.js
```

---

Made with ☕ + Claude Code, chỉ để xem video cho vui thôi 🎉
