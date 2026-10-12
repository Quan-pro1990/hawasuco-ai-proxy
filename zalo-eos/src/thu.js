'use strict';
// Chạy thử kịch bản trò chuyện ngay trên máy, KHÔNG cần Zalo: gõ như khách nhắn OA, xem câu trả lời.
// Dùng EOS theo .env (EOS_CHE_DO=mau hoặc api) — cách nhanh nhất để kiểm tra đã nối đúng API EOS chưa.
//   node src/thu.js                       gõ từng lệnh (Ctrl+C để thoát)
//   node src/thu.js "DK KH0001 4567" TT   chạy lần lượt các lệnh rồi thoát
// Giả lập ngân hàng báo có tiền về:  !ck <số tiền> <nội dung chuyển khoản>   (vd: !ck 153000 TN8K2F7QXA KH0001)
// File hoá đơn, ảnh QR nhận được lưu vào du-lieu/thu/. Dữ liệu thử lưu riêng, không lẫn với khách thật.
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { taiCauHinh } = require('./cauhinh');
const { taoEos } = require('./eos');
const { HoiThoai } = require('./hoithoai');
const { ThanhToan } = require('./thanhtoan');

async function main() {
  const cfg = taiCauHinh();
  cfg.thuMucDuLieu = path.join(cfg.thuMucDuLieu, 'thu');
  const eos = taoEos(cfg);
  const luu = (nhan, tep) => {
    fs.mkdirSync(cfg.thuMucDuLieu, { recursive: true });
    const noi = path.join(cfg.thuMucDuLieu, tep.ten);
    fs.writeFileSync(noi, tep.duLieu);
    console.log(`[OA gửi ${nhan}] ${tep.ten} (${tep.duLieu.length} byte) → đã lưu ${noi}\n`);
  };
  const gui = {
    chu: async (uid, text) => { console.log('\n[OA trả lời]\n' + text + '\n'); },
    file: async (uid, tep) => (tep.url ? console.log('[OA gửi liên kết hoá đơn] ' + tep.url + '\n') : luu('file', tep)),
    anh: async (uid, tep) => luu('ảnh', tep),
  };
  const uid = 'nguoi-thu-tren-may';
  const tt = new ThanhToan({ cfg, eos });
  const ht = new HoiThoai({ cfg, eos, gui, thanhToan: tt });

  /** "!ck 153000 TN8K2F7QXA KH0001" → giả lập dịch vụ báo số dư gọi webhook thanh toán. */
  const xuLy = async t => {
    const ck = /^!ck\s+([\d.,]+)\s+(.+)$/i.exec(t.trim());
    if (!ck) return ht.xuLyTin(uid, t);
    if (!tt.bat) return console.log('Chưa khai TT_NGAN_HANG_BIN / TT_SO_TAI_KHOAN trong .env\n');
    const kq = await tt.nhanWebhook({
      id: 'THU' + Date.now(), transferType: 'in', transferAmount: ck[1].replace(/[.,]/g, ''), content: ck[2],
    }, gui.chu);
    await new Promise(r => setImmediate(r));
    console.log('[Ngân hàng báo có tiền] kết quả: ' + kq.map(k => k.kq).join(', ') + '\n');
  };
  console.log(`EOS: ${cfg.eos.cheDo === 'api' ? cfg.eos.url : 'dữ liệu mẫu (thử: DK KH0001 4567)'}`);

  const lenh = process.argv.slice(2);
  if (lenh.length) {
    for (const t of lenh) {
      console.log('> ' + t);
      await xuLy(t);
    }
    return;
  }

  await ht.xuLySuKien({ event_name: 'follow', follower: { id: uid } });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
  rl.prompt();
  for await (const dong of rl) {
    if (dong.trim()) await xuLy(dong);
    rl.prompt();
  }
}

main().catch(e => { console.error('Lỗi:', e.message); process.exitCode = 1; });
