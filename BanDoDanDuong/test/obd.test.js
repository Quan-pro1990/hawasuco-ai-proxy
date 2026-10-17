import test from 'node:test';
import assert from 'node:assert/strict';
import { docThongSo, pidHoTro, docMaLoi, maLoi, docVin, loiElm, PhienElm, DocXe, CongGoc } from '../public/js/obd.js';

test('đọc thông số chế độ 01 của ELM327', () => {
  assert.equal(docThongSo('010C', '41 0C 1A F8\r\r>'), 1726);                 // (0x1A*256 + 0xF8) / 4
  assert.equal(docThongSo('010C', 'SEARCHING...\r410C0FA0\r'), 1000);
  assert.equal(docThongSo('010D', '7E8 03 41 0D 3C'), 60);                   // có tiêu đề CAN
  assert.equal(docThongSo('0105', '41 05 7B'), 83);
  assert.equal(docThongSo('0111', '41 11 FF'), 100);
  assert.equal(docThongSo('012F', '41 2F 80'), 50);
  assert.equal(docThongSo('0142', '41 42 31 0A'), 12.6);
  assert.equal(docThongSo('ATRV', '12.4V'), 12.4);
  assert.equal(docThongSo('010C', 'NO DATA'), null);
  assert.equal(docThongSo('010C', '41 0C 1A'), null);                        // thiếu byte
  assert.equal(loiElm('NO DATA\r\r>'), 'Xe không trả lời thông số này');
  assert.match(loiElm('SEARCHING...\rUNABLE TO CONNECT'), /ECU/);
  assert.equal(loiElm('41 0C 1A F8'), null);
});

test('PID xe hỗ trợ, mã lỗi, số khung', () => {
  const ds = pidHoTro('0100', '41 00 BE 1F A8 13');
  for (const p of ['0101', '0103', '0104', '0105', '010C', '010D', '0111', '0120']) assert.ok(ds.has(p), p);
  assert.ok(!ds.has('0102') && !ds.has('010A'));
  assert.equal(maLoi(0x01, 0x33), 'P0133');
  assert.equal(maLoi(0xC1, 0x58), 'U0158');
  assert.deepEqual(docMaLoi('43 01 33 00 00 00 00'), ['P0133']);              // giao thức cũ: 3 mã mỗi dòng
  assert.deepEqual(docMaLoi('43 02 01 33 02 21'), ['P0133', 'P0221']);        // CAN: byte đầu là số mã lỗi
  assert.deepEqual(docMaLoi('43 00'), []);
  const vin = '014\r0: 49 02 01 31 48 47\r1: 43 4D 38 32 36 33 33\r2: 41 30 30 34 33 35 32';
  assert.equal(docVin(vin), '1HGCM82633A004352');
});

/** Bộ chuyển ELM327 giả: trả lời từng lệnh, chia phản hồi thành nhiều mảnh như Bluetooth. */
function elmGia(traLoi) {
  const daNhan = [];
  const cong = {
    ghi(chuoi) {
      const lenh = chuoi.trim();
      daNhan.push(lenh);
      const r = typeof traLoi[lenh] === 'function' ? traLoi[lenh]() : traLoi[lenh];
      if (r === undefined) return;                                            // im lặng: hết thời gian chờ
      const day = r + '\r\r>';
      setTimeout(() => phien.nhan(day.slice(0, 3)), 1);
      setTimeout(() => phien.nhan(day.slice(3)), 3);
    }
  };
  const phien = new PhienElm(cong);
  return { phien, daNhan };
}

const XE = {
  ATZ: 'ELM327 v1.5', ATE0: 'OK', ATL0: 'OK', ATS0: 'OK', ATH0: 'OK', ATSP0: 'OK',
  '0100': 'SEARCHING...\r41 00 98 18 80 10', '010C': '41 0C 0C 80', '010D': '41 0D 28', '0105': '41 05 82', '0104': '41 04 40',
  '010F': '41 0F 46', '0111': '41 11 33', ATRV: '14.1V', '03': '43 01 01 71', '04': '44', '0902': 'NO DATA'
};

test('phiên ELM327: gửi tuần tự, chờ dấu nhắc, đọc thông số xe hỗ trợ', async () => {
  const { phien, daNhan } = elmGia(XE);
  const r = await Promise.all([phien.lenh('ATZ'), phien.lenh('ATE0')]);
  assert.deepEqual(r.map(x => x.trim()), ['ELM327 v1.5', 'OK']);
  const giaTri = [];
  const xe = new DocXe(phien, { baoDoi: v => giaTri.push({ ...v }) });
  const hoTro = await xe.khoiTao();
  assert.ok(hoTro.has('010C') && hoTro.has('0105') && !hoTro.has('012F'));
  assert.ok(!daNhan.includes('0120'), 'xe không hỗ trợ dải 0120 thì không hỏi');
  await xe.docMotVong(0);
  const v = giaTri[0];
  assert.equal(v['010C'], 800);
  assert.equal(v['010D'], 40);
  assert.equal(v['0105'], 90);
  assert.equal(v['0104'], 25);
  assert.equal(v.ATRV, 14.1);
  assert.equal(v['012F'], undefined);
  assert.ok(!daNhan.includes('012F'), 'không hỏi thông số xe không hỗ trợ');
  assert.deepEqual(await xe.docLoi(), ['P0171']);
  await xe.xoaLoi();
  assert.equal(await xe.docVin(), null);
});

test('báo lỗi khi bộ chuyển không trả lời hoặc không kết nối được ECU', async () => {
  const { phien } = elmGia({ ...XE, '0100': 'SEARCHING...\rUNABLE TO CONNECT' });
  await assert.rejects(new DocXe(phien).khoiTao(), /ECU/);
  const im = elmGia({});
  await assert.rejects(im.phien.lenh('ATZ', 50), /không trả lời/);
  im.phien.huy();
  await assert.rejects(im.phien.lenh('ATE0', 50), /ngắt/);
});

test('cổng qua ứng dụng gốc chuyển lệnh và dữ liệu', async () => {
  const gui = [];
  const cong = new CongGoc((loai, du) => gui.push([loai, du]));
  const nhan = [];
  let ngat = false;
  const cho = cong.ketNoi(s => nhan.push(s), () => { ngat = true; });
  assert.equal(gui[0][0], 'obdKetNoi');
  cong.suKien('ketNoi', 'OBDII');
  assert.equal(await cho, 'OBDII');
  cong.ghi('010C\r');
  assert.deepEqual(gui[1], ['obdGui', { chuoi: '010C\r' }]);
  cong.suKien('nhan', '41 0C');
  assert.deepEqual(nhan, ['41 0C']);
  cong.suKien('ngat');
  assert.equal(ngat, true);
  const c2 = new CongGoc(() => {});
  const p2 = c2.ketNoi(() => {}, () => {});
  c2.suKien('loi', 'Chưa bật Bluetooth');
  await assert.rejects(p2, /Bluetooth/);
});
