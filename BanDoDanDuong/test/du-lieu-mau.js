/* Dữ liệu mẫu cho kiểm thử: tuyến đường dạng OSRM quanh Hồ Hoàn Kiếm, dữ liệu Overpass, kết quả tìm kiếm. */

const A = [105.8500, 21.0250], B = [105.8500, 21.0304], C = [105.8548, 21.0304], D = [105.8548, 21.0340];

/** Chia đoạn thẳng thành các điểm cách nhau khoảng 100 m. */
function chia(a, b, soDoan) {
  const kq = [];
  for (let i = 0; i <= soDoan; i++) kq.push([+(a[0] + (b[0] - a[0]) * i / soDoan).toFixed(6), +(a[1] + (b[1] - a[1]) * i / soDoan).toFixed(6)]);
  return kq;
}

function buoc(ten, g, kieu, huong, dai, tg, them = {}) {
  return {
    name: ten, ref: '', distance: dai, duration: tg, mode: 'driving', geometry: { type: 'LineString', coordinates: g },
    maneuver: { type: kieu, modifier: huong, location: g[0], bearing_before: them.truoc || 0, bearing_after: them.sau || 0, exit: them.loiRa },
    intersections: [{ location: g[0], classes: them.lop, lanes: them.lanes }]
  };
}

export function tuyenOsrm() {
  return {
    code: 'Ok',
    routes: [
      {
        distance: 1500, duration: 155, weight: 155,
        legs: [{
          summary: 'Hàng Bài, Tràng Tiền', distance: 1500, duration: 155,
          steps: [
            buoc('Hàng Bài', chia(A, B, 6), 'depart', undefined, 600, 60, { sau: 0 }),
            buoc('Tràng Tiền', chia(B, C, 5), 'turn', 'right', 500, 50, {
              truoc: 0, sau: 90,
              lanes: [{ indications: ['left'], valid: false }, { indications: ['straight'], valid: false }, { indications: ['right'], valid: true }]
            }),
            buoc('Lý Thái Tổ', chia(C, D, 4), 'turn', 'left', 400, 45, { truoc: 90, sau: 0 }),
            buoc('Lý Thái Tổ', [D, D], 'arrive', 'right', 0, 0, { truoc: 0 })
          ]
        }]
      },
      {
        distance: 1750, duration: 190, weight: 190,
        legs: [{
          summary: 'Hai Bà Trưng, Đinh Lễ', distance: 1750, duration: 190,
          steps: [
            buoc('Hai Bà Trưng', chia(A, [105.8548, 21.0250], 5), 'depart', undefined, 500, 55, { sau: 90 }),
            buoc('Đinh Lễ', chia([105.8548, 21.0250], D, 9), 'turn', 'left', 1000, 120, { truoc: 90, sau: 0, lop: ['toll'] }),
            buoc('Đinh Lễ', [D, D], 'arrive', '', 0, 0)
          ]
        }]
      }
    ],
    waypoints: [{ location: A }, { location: D }]
  };
}

export const DIEM = { A, B, C, D };

/** Phản hồi Overpass cho truy vấn đường quanh vị trí. */
export function overpassDuong() {
  const way = (id, ten, hw, toaDo, tags = {}) => ({ type: 'way', id, tags: { highway: hw, name: ten, ...tags }, geometry: toaDo.map(p => ({ lon: p[0], lat: p[1] })) });
  const ds = [
    way(1, 'Hàng Bài', 'secondary', [A, B]),
    way(2, 'Tràng Tiền', 'tertiary', [B, C], { maxspeed: '30' }),
    way(3, 'Lý Thái Tổ', 'secondary', [C, D], { maxspeed: '50', 'maxspeed:motorcycle': '40' })
  ];
  // nhiều ngõ nhỏ xung quanh → khu đông dân cư
  for (let i = 0; i < 30; i++) {
    const y = 21.0255 + i * 0.0003;
    ds.push(way(100 + i, 'Ngõ ' + (i + 1), 'residential', [[105.8505, y], [105.8515, y]]));
  }
  return { elements: ds };
}

/** Phản hồi Overpass cho truy vấn camera / đường sắt / trạm thu phí. */
export function overpassDiem() {
  return {
    elements: [
      { type: 'node', id: 9001, lat: 21.0304, lon: 105.8530, tags: { highway: 'speed_camera', maxspeed: '30' } },
      { type: 'node', id: 9002, lat: 21.0325, lon: 105.8548, tags: { railway: 'level_crossing' } }
    ]
  };
}

export function photon() {
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: D }, properties: { name: 'Nhà hát Lớn Hà Nội', street: 'Tràng Tiền', housenumber: '1', district: 'Hoàn Kiếm', city: 'Hà Nội', osm_value: 'theatre' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [105.8522, 21.0287] }, properties: { name: 'Hồ Hoàn Kiếm', district: 'Hoàn Kiếm', city: 'Hà Nội', osm_value: 'water' } }
    ]
  };
}

export function nominatimNguoc() {
  return {
    name: '', display_name: '15, Tràng Tiền, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội, 11000, Việt Nam',
    address: { house_number: '15', road: 'Tràng Tiền', suburb: 'Phường Tràng Tiền', city: 'Hà Nội' }
  };
}
