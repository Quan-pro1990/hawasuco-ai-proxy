import test from 'node:test';
import assert from 'node:assert/strict';
import { gioMatTroi, laBanDem, NhacNho } from '../public/js/nhac-nho.js';
import { caiDat } from '../public/js/kho.js';

const HA_NOI = [105.8542, 21.0285];
const GIO = 3600000;
/** Giờ:phút theo giờ Việt Nam (UTC+7) của mốc thời gian ms, dạng số phút trong ngày. */
const phutVN = ms => { const d = new Date(ms + 7 * GIO); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const luc = (thang, ngay, gio, phut = 0) => Date.UTC(2026, thang - 1, ngay, gio - 7, phut);   // giờ Việt Nam → ms

test('giờ mặt trời mọc / lặn ở Hà Nội', () => {
  const he = gioMatTroi(luc(6, 21, 12), HA_NOI[1], HA_NOI[0]);
  assert.ok(Math.abs(phutVN(he.moc) - (5 * 60 + 13)) <= 6, 'mọc ngày hạ chí ' + phutVN(he.moc));
  assert.ok(Math.abs(phutVN(he.lan) - (18 * 60 + 43)) <= 6, 'lặn ngày hạ chí ' + phutVN(he.lan));
  const dong = gioMatTroi(luc(12, 21, 3), HA_NOI[1], HA_NOI[0]);
  assert.ok(Math.abs(phutVN(dong.moc) - (6 * 60 + 31)) <= 6, 'mọc ngày đông chí ' + phutVN(dong.moc));
  assert.ok(Math.abs(phutVN(dong.lan) - (17 * 60 + 20)) <= 6, 'lặn ngày đông chí ' + phutVN(dong.lan));
  // cùng một ngày dù hỏi lúc sáng sớm hay tối muộn
  assert.equal(gioMatTroi(luc(12, 21, 23, 30), HA_NOI[1], HA_NOI[0]).moc, dong.moc);
  assert.equal(laBanDem(HA_NOI, luc(12, 21, 18)), true);
  assert.equal(laBanDem(HA_NOI, luc(12, 21, 12)), false);
  assert.equal(laBanDem(HA_NOI, luc(12, 21, 5)), true);
  assert.equal(gioMatTroi(luc(12, 21, 12), 85, 0), null);         // đêm địa cực
});

function taoNhacNho() {
  const noi = [], bao = [];
  const nn = new NhacNho({ noi: s => noi.push(s), bip: () => {}, bao: (s, l) => bao.push([s, l]) });
  nn.daNhac = {};
  return { nn, noi, bao };
}

test('báo mất GPS khi đang đi và báo khi có lại', () => {
  const { nn, noi, bao } = taoNhacNho();
  const t0 = luc(6, 21, 12);
  nn.viTri({ viTri: HA_NOI }, 40, t0);
  assert.equal(nn.kiemTra(true, t0 + 10000), false);
  assert.equal(nn.kiemTra(false, t0 + 60000), false, 'không đi thì không báo');
  const dung = taoNhacNho();
  dung.nn.viTri({ viTri: HA_NOI }, 0, t0);
  assert.equal(dung.nn.kiemTra(true, t0 + 60000), false, 'xe đứng yên (GPS không gửi vị trí mới) thì không báo');
  assert.equal(nn.kiemTra(true, t0 + 16000), true);
  assert.ok(/Mất tín hiệu GPS/.test(noi[0]));
  assert.equal(bao[0][1], 'loi');
  nn.kiemTra(true, t0 + 30000);
  assert.equal(noi.length, 1, 'chỉ báo một lần');
  nn.viTri({ viTri: HA_NOI }, 40, t0 + 31000);
  assert.ok(/có lại tín hiệu GPS/.test(noi[1]));
  // tắt cảnh báo mất GPS
  caiDat.canhBaoMatGps = false;
  try {
    assert.equal(nn.kiemTra(true, t0 + 60000), true);
    assert.equal(noi.length, 2);
  } finally { caiDat.canhBaoMatGps = true; }
});

test('nhắc bật đèn sau khi mặt trời lặn, tắt đèn sau khi mọc (mỗi ngày một lần, chỉ khi xe chạy)', () => {
  const { nn, noi } = taoNhacNho();
  nn.viTri({ viTri: HA_NOI }, 3, luc(12, 21, 17, 45));                 // xe đứng yên: không nhắc
  assert.equal(noi.length, 0);
  nn.viTri({ viTri: HA_NOI }, 35, luc(12, 21, 17, 46));
  assert.ok(/bật đèn/.test(noi[0]), noi.join('|'));
  nn.viTri({ viTri: HA_NOI }, 35, luc(12, 21, 18, 30));
  assert.equal(noi.length, 1);
  nn.viTri({ viTri: HA_NOI }, 35, luc(12, 22, 6, 40));                 // mới mọc 9 phút: chưa nhắc
  assert.equal(noi.length, 1);
  nn.viTri({ viTri: HA_NOI }, 35, luc(12, 22, 7, 0));
  assert.ok(/tắt đèn/.test(noi[1]), noi.join('|'));
  caiDat.nhacDen = false;
  try {
    nn.viTri({ viTri: HA_NOI }, 35, luc(12, 22, 18, 0));
    assert.equal(noi.length, 2);
  } finally { caiDat.nhacDen = true; }
});
