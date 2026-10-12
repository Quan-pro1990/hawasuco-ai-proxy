'use strict';
// Lưu dữ liệu nhỏ ra file JSON (token Zalo, liên kết Zalo ↔ mã khách hàng) và giữ file hoá đơn tạm trong bộ nhớ.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** 1 file JSON. Ghi ra file tạm rồi đổi tên để mất điện giữa chừng không làm hỏng file cũ. */
class TepJson {
  constructor(tep, macDinh) {
    this.tep = tep;
    this.macDinh = macDinh;
    this._bo = null;
  }

  doc() {
    if (this._bo) return this._bo;
    try {
      this._bo = JSON.parse(fs.readFileSync(this.tep, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw new Error('Không đọc được ' + this.tep + ': ' + e.message);
      this._bo = structuredClone(this.macDinh);
    }
    return this._bo;
  }

  ghi(giaTri) {
    if (giaTri !== undefined) this._bo = giaTri;
    fs.mkdirSync(path.dirname(this.tep), { recursive: true });
    const tam = this.tep + '.tam';
    fs.writeFileSync(tam, JSON.stringify(this._bo, null, 2));
    fs.renameSync(tam, this.tep);
  }
}

/** File hoá đơn chờ khách tải qua liên kết /hd/<mã> (khi không gửi thẳng được file qua Zalo). */
class TepTam {
  constructor(phutGiu = 30, bayGio = Date.now) {
    this.phutGiu = phutGiu;
    this.bayGio = bayGio;
    this.ds = new Map();
  }

  them(tep) {
    this.donDep();
    const ma = crypto.randomBytes(16).toString('hex');
    this.ds.set(ma, { ...tep, het: this.bayGio() + this.phutGiu * 60e3 });
    return ma;
  }

  lay(ma) {
    this.donDep();
    return this.ds.get(ma) || null;
  }

  donDep() {
    const t = this.bayGio();
    for (const [ma, tep] of this.ds) if (tep.het < t) this.ds.delete(ma);
  }
}

module.exports = { TepJson, TepTam };
