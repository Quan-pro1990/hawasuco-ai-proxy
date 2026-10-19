// Vẽ hình trang trí (nền hồng, hoa hồng, hoa sen, cánh hoa, lá) bằng SVG rồi xuất PNG/JPEG.
// Dùng chung cho tao_mau_powerpoint.js; chạy riêng để xem thử: node hinh_ve.js <thư mục ra>

const sharp = require("sharp");

// Số ngẫu nhiên cố định để mỗi lần tạo đều ra cùng một hình.
function rng(seed) {
	let s = seed >>> 0;
	return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const png = async (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

// ----- Nền -----
async function nen(w = 2560, h = 1440, seed = 7) {
	const r = rng(seed);
	let bokeh = "";
	for (let i = 0; i < 46; i++) {
		const cx = r() * w;
		const cy = r() * h;
		const rad = 8 + r() * 46;
		bokeh += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" fill="#FFFFFF" fill-opacity="${(0.18 + r() * 0.4).toFixed(2)}" filter="url(#b${i % 3})"/>`;
	}
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
	<defs>
		<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#FBE3EC"/><stop offset="0.45" stop-color="#FFF4F8"/><stop offset="1" stop-color="#F8D3E0"/>
		</linearGradient>
		<radialGradient id="glow" cx="0.5" cy="0.42" r="0.45"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
		<radialGradient id="pk" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#F6B3C8" stop-opacity="0.55"/><stop offset="1" stop-color="#F6B3C8" stop-opacity="0"/></radialGradient>
		<filter id="b0"><feGaussianBlur stdDeviation="2"/></filter>
		<filter id="b1"><feGaussianBlur stdDeviation="6"/></filter>
		<filter id="b2"><feGaussianBlur stdDeviation="12"/></filter>
	</defs>
	<rect width="${w}" height="${h}" fill="url(#g)"/>
	<ellipse cx="${w * 0.08}" cy="${h * 0.12}" rx="${w * 0.28}" ry="${h * 0.32}" fill="url(#pk)"/>
	<ellipse cx="${w * 0.95}" cy="${h * 0.9}" rx="${w * 0.35}" ry="${h * 0.42}" fill="url(#pk)"/>
	<ellipse cx="${w * 0.5}" cy="${h * 0.42}" rx="${w * 0.42}" ry="${h * 0.5}" fill="url(#glow)"/>
	${bokeh}
	</svg>`;
	return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

// ----- Hoa hồng nhìn từ trên xuống -----
function canhHong(R) {
	const w = R * 0.62;
	return `M0,0 C${-0.8 * w},${-0.12 * R} ${-1.0 * w},${-0.78 * R} ${-0.42 * w},${-0.98 * R} Q${-0.14 * w},${-1.06 * R} 0,${-0.95 * R} Q${0.14 * w},${-1.06 * R} ${0.42 * w},${-0.98 * R} C${1.0 * w},${-0.78 * R} ${0.8 * w},${-0.12 * R} 0,0 Z`;
}

async function hoaHong({ size = 1000, mau = "hong", seed = 3 } = {}) {
	const r = rng(seed);
	const c = size / 2;
	const P = {
		hong: ["#D94C7A", "#F28DB0", "#FFE4EE", "#B8325F"],
		dao: ["#E8795F", "#F6B49A", "#FFF0E8", "#C9563F"],
	}[mau];
	const rings = [
		{ n: 6, R: c * 0.84, rot: 0 },
		{ n: 6, R: c * 0.67, rot: 30 },
		{ n: 5, R: c * 0.5, rot: 12 },
		{ n: 5, R: c * 0.36, rot: 48 },
		{ n: 4, R: c * 0.24, rot: 20 },
	];
	let body = "";
	for (const ring of rings) {
		for (let i = 0; i < ring.n; i++) {
			const a = ring.rot + (360 / ring.n) * i + (r() - 0.5) * 14;
			const RR = ring.R * (0.92 + r() * 0.1);
			const d = canhHong(RR);
			body += `<g transform="translate(${c},${c}) rotate(${a.toFixed(1)})">
				<path d="${d}" fill="${P[3]}" fill-opacity="0.35" filter="url(#sh)" transform="translate(0,${(-RR * 0.04).toFixed(1)}) scale(1.03)"/>
				<path d="${d}" fill="url(#pet)"/>
				<path d="${d}" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="${(size / 400).toFixed(1)}"/>
			</g>`;
		}
	}
	// Nụ xoắn ở giữa
	let core = "";
	for (let k = 0; k < 7; k++) {
		const rad = c * (0.2 - k * 0.025);
		const a0 = k * 75;
		const sweep = 210;
		const p = (ang, rr) => [c + rr * Math.cos((ang * Math.PI) / 180), c + rr * Math.sin((ang * Math.PI) / 180)].map((v) => v.toFixed(1)).join(",");
		core += `<path d="M${p(a0, rad)} A${rad},${rad} 0 1,1 ${p(a0 + sweep, rad)} A${rad * 0.8},${rad * 0.8} 0 1,0 ${p(a0, rad)} Z" fill="url(#core)" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="${(size / 500).toFixed(1)}"/>`;
	}
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
	<defs>
		<radialGradient id="pet" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${c}">
			<stop offset="0" stop-color="${P[0]}"/><stop offset="0.45" stop-color="${P[1]}"/><stop offset="1" stop-color="${P[2]}"/>
		</radialGradient>
		<radialGradient id="core" gradientUnits="userSpaceOnUse" cx="${c}" cy="${c}" r="${c * 0.22}">
			<stop offset="0" stop-color="${P[3]}"/><stop offset="1" stop-color="${P[1]}"/>
		</radialGradient>
		<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${(size / 80).toFixed(1)}"/></filter>
	</defs>
	${body}${core}
	</svg>`;
	return png(svg);
}

// ----- Hoa sen nhìn ngang, kèm nụ và lá -----
function canhSen(L, w) {
	return `M0,0 C${-0.62 * w},${-0.25 * L} ${-0.58 * w},${-0.72 * L} 0,${-L} C${0.58 * w},${-0.72 * L} ${0.62 * w},${-0.25 * L} 0,0 Z`;
}

async function hoaSen({ w = 1100, h = 1100 } = {}) {
	const bx = w * 0.5;
	const by = h * 0.62;
	const petal = (ang, L, wd, grad, extra = "") =>
		`<g transform="translate(${bx},${by}) rotate(${ang})">
			<path d="${canhSen(L, wd)}" fill="url(#${grad})" stroke="#E2588C" stroke-opacity="0.45" stroke-width="2.5"/>
			<path d="M0,-${L * 0.08} Q${wd * 0.06},-${L * 0.5} 0,-${L * 0.9}" fill="none" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="2.5"/>
			<path d="M-${wd * 0.12},-${L * 0.1} Q-${wd * 0.26},-${L * 0.5} -${wd * 0.08},-${L * 0.82}" fill="none" stroke="#F7B6CC" stroke-opacity="0.7" stroke-width="2"/>
			<path d="M${wd * 0.12},-${L * 0.1} Q${wd * 0.26},-${L * 0.5} ${wd * 0.08},-${L * 0.82}" fill="none" stroke="#F7B6CC" stroke-opacity="0.7" stroke-width="2"/>
			${extra}
		</g>`;
	// Lá sen tròn
	let veins = "";
	for (let i = 0; i < 14; i++) {
		const a = (i / 14) * Math.PI * 2;
		veins += `<line x1="0" y1="0" x2="${(Math.cos(a) * 300).toFixed(0)}" y2="${(Math.sin(a) * 90).toFixed(0)}" stroke="#B9E07A" stroke-opacity="0.55" stroke-width="3"/>`;
	}
	const leaf = (x, y, s, rot) => `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})">
		<ellipse cx="0" cy="0" rx="310" ry="95" fill="url(#leaf)"/>
		<path d="M0,0 L300,-40 A310,95 0 0,0 300,30 Z" fill="#2E7D32" fill-opacity="0.35"/>
		${veins}
		<ellipse cx="0" cy="0" rx="310" ry="95" fill="none" stroke="#1B5E20" stroke-opacity="0.35" stroke-width="3"/>
	</g>`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
	<defs>
		<linearGradient id="back" x1="0.5" y1="1" x2="0.5" y2="0"><stop offset="0" stop-color="#FFF6F9"/><stop offset="0.55" stop-color="#F8BFD3"/><stop offset="1" stop-color="#E8608F"/></linearGradient>
		<linearGradient id="front" x1="0.5" y1="1" x2="0.5" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.5" stop-color="#FAD0DE"/><stop offset="1" stop-color="#EC6E9B"/></linearGradient>
		<linearGradient id="bud" x1="0.5" y1="1" x2="0.5" y2="0"><stop offset="0" stop-color="#F9D5E1"/><stop offset="1" stop-color="#E25387"/></linearGradient>
		<linearGradient id="stem" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4E8F2E"/><stop offset="0.5" stop-color="#7CB342"/><stop offset="1" stop-color="#3E7A24"/></linearGradient>
		<radialGradient id="leaf" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="#9CCC65"/><stop offset="0.6" stop-color="#5E9E36"/><stop offset="1" stop-color="#2F6B1F"/></radialGradient>
		<radialGradient id="pod" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#FFF59D"/><stop offset="1" stop-color="#F9A825"/></radialGradient>
		<filter id="soft"><feGaussianBlur stdDeviation="10"/></filter>
	</defs>
	<!-- cuống -->
	<path d="M${bx - 9},${by} C${bx - 30},${by + 160} ${bx + 10},${by + 300} ${bx - 20},${h}" stroke="url(#stem)" stroke-width="22" fill="none"/>
	<path d="M${w * 0.8},${h * 0.42} C${w * 0.78},${h * 0.6} ${w * 0.84},${h * 0.8} ${w * 0.8},${h}" stroke="url(#stem)" stroke-width="16" fill="none"/>
	<!-- nụ sen -->
	<g transform="translate(${w * 0.8},${h * 0.44})">
		<path d="${canhSen(230, 170)}" fill="url(#bud)" stroke="#D84A7E" stroke-opacity="0.5" stroke-width="2.5"/>
		<path d="${canhSen(200, 110)}" transform="rotate(-14)" fill="url(#bud)" fill-opacity="0.9" stroke="#D84A7E" stroke-opacity="0.5" stroke-width="2"/>
		<path d="${canhSen(200, 110)}" transform="rotate(14)" fill="url(#bud)" fill-opacity="0.9" stroke="#D84A7E" stroke-opacity="0.5" stroke-width="2"/>
	</g>
	${leaf(w * 0.3, h * 0.9, 1.0, -8)}
	${leaf(w * 0.82, h * 0.95, 0.75, 10)}
	<ellipse cx="${bx}" cy="${by + 10}" rx="230" ry="40" fill="#C2185B" fill-opacity="0.18" filter="url(#soft)"/>
	${[-78, -54, -28, 0, 28, 54, 78].map((a) => petal(a, 360, 175, "back")).join("")}
	<ellipse cx="${bx}" cy="${by - 70}" rx="70" ry="34" fill="url(#pod)"/>
	${[-44, -15, 15, 44].map((a) => petal(a, 320, 190, "front")).join("")}
	${petal(0, 290, 170, "front")}
	</svg>`;
	return png(svg);
}

// ----- Cánh hoa rơi -----
async function canhHoa(mau, seed) {
	const r = rng(seed);
	const [a, b] = mau;
	const tilt = (r() - 0.5) * 30;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
	<defs><radialGradient id="g" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></radialGradient></defs>
	<g transform="translate(120,128) rotate(${tilt.toFixed(0)})">
		<path d="M0,95 C-95,60 -105,-40 -45,-85 Q-10,-100 0,-78 Q12,-102 50,-84 C108,-40 92,60 0,95 Z" fill="url(#g)"/>
		<path d="M0,88 Q-14,10 -6,-70" fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="5"/>
		<path d="M-60,-40 Q-20,-70 20,-60" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="5"/>
	</g></svg>`;
	return png(svg);
}

// ----- Lá bay -----
async function la(seed) {
	const r = rng(seed);
	const tilt = (r() - 0.5) * 40;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
	<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A5D66B"/><stop offset="1" stop-color="#3C8D2F"/></linearGradient></defs>
	<g transform="translate(150,150) rotate(${(-35 + tilt).toFixed(0)})">
		<path d="M-120,0 C-70,-60 50,-70 125,0 C50,70 -70,60 -120,0 Z" fill="url(#g)"/>
		<path d="M-118,0 L120,0" stroke="#E8F5D0" stroke-opacity="0.7" stroke-width="4"/>
		${[-70, -30, 10, 50].map((x) => `<path d="M${x},0 Q${x + 25},-22 ${x + 45},-38 M${x},0 Q${x + 25},22 ${x + 45},38" fill="none" stroke="#E8F5D0" stroke-opacity="0.5" stroke-width="3"/>`).join("")}
	</g></svg>`;
	return png(svg);
}

// ----- Khung ảnh minh họa (thay bằng ảnh thật) -----
async function khungAnh(w = 1320, h = 1040) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
	<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCE4EC"/><stop offset="1" stop-color="#F48FB1"/></linearGradient>
	<clipPath id="c"><rect width="${w}" height="${h}" rx="40" ry="40"/></clipPath></defs>
	<g clip-path="url(#c)">
		<rect width="${w}" height="${h}" fill="url(#g)"/>
		<circle cx="${w * 0.72}" cy="${h * 0.3}" r="80" fill="#FFFFFF" fill-opacity="0.8"/>
		<path d="M0,${h} L0,${h * 0.75} L${w * 0.3},${h * 0.45} L${w * 0.55},${h * 0.72} L${w * 0.72},${h * 0.56} L${w},${h * 0.82} L${w},${h} Z" fill="#FFFFFF" fill-opacity="0.55"/>
	</g></svg>`;
	return png(svg);
}

module.exports = { nen, hoaHong, hoaSen, canhHoa, la, khungAnh };

if (require.main === module) {
	const fs = require("fs");
	const path = require("path");
	const out = process.argv[2] || ".";
	(async () => {
		fs.writeFileSync(path.join(out, "nen.jpg"), await nen());
		fs.writeFileSync(path.join(out, "hong.png"), await hoaHong());
		fs.writeFileSync(path.join(out, "hong_dao.png"), await hoaHong({ mau: "dao", seed: 9 }));
		fs.writeFileSync(path.join(out, "sen.png"), await hoaSen());
		fs.writeFileSync(path.join(out, "canh1.png"), await canhHoa(["#E2557F", "#FBC7D7"], 1));
		fs.writeFileSync(path.join(out, "la1.png"), await la(2));
		fs.writeFileSync(path.join(out, "anh.png"), await khungAnh());
		console.log("ok");
	})();
}
