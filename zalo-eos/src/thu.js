'use strict';
// Chạy thử kịch bản trò chuyện ngay trên máy, KHÔNG cần Zalo: gõ như khách nhắn OA, xem câu trả lời.
// Dùng EOS theo .env (EOS_CHE_DO=mau hoặc api) — cách nhanh nhất để kiểm tra đã nối đúng API EOS chưa.
//   node src/thu.js                       gõ từng lệnh (Ctrl+C để thoát)
//   node src/thu.js "DK KH0001 4567" TT   chạy lần lượt các lệnh rồi thoát
// File hoá đơn nhận được lưu vào du-lieu/thu/. Liên kết thử lưu riêng, không lẫn với khách thật.
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { taiCauHinh } = require('./cauhinh');
const { taoEos } = require('./eos');
const { HoiThoai } = require('./hoithoai');

async function main() {
  const cfg = taiCauHinh();
  cfg.thuMucDuLieu = path.join(cfg.thuMucDuLieu, 'thu');
  const eos = taoEos(cfg);
  const gui = {
    chu: async (uid, text) => { console.log('\n[OA trả lời]\n' + text + '\n'); },
    file: async (uid, tep) => {
      if (tep.url) return console.log('[OA gửi liên kết hoá đơn] ' + tep.url + '\n');
      fs.mkdirSync(cfg.thuMucDuLieu, { recursive: true });
      const noi = path.join(cfg.thuMucDuLieu, tep.ten);
      fs.writeFileSync(noi, tep.duLieu);
      console.log(`[OA gửi file] ${tep.ten} (${tep.duLieu.length} byte) → đã lưu ${noi}\n`);
    },
  };
  const ht = new HoiThoai({ cfg, eos, gui });
  const uid = 'nguoi-thu-tren-may';
  console.log(`EOS: ${cfg.eos.cheDo === 'api' ? cfg.eos.url : 'dữ liệu mẫu (thử: DK KH0001 4567)'}`);

  const lenh = process.argv.slice(2);
  if (lenh.length) {
    for (const t of lenh) {
      console.log('> ' + t);
      await ht.xuLyTin(uid, t);
    }
    return;
  }

  await ht.xuLySuKien({ event_name: 'follow', follower: { id: uid } });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
  rl.prompt();
  for await (const dong of rl) {
    if (dong.trim()) await ht.xuLyTin(uid, dong);
    rl.prompt();
  }
}

main().catch(e => { console.error('Lỗi:', e.message); process.exitCode = 1; });
