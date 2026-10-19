// Tạo mẫu trình chiếu PowerPoint "Mừng ngày Phụ nữ Việt Nam 20/10" có hiệu ứng động,
// dùng logo HAWASUCO. Mọi chữ trong file là ô chữ thường nên sửa trực tiếp được trong PowerPoint.
//
//   npm install pptxgenjs sharp react react-dom react-icons   (một lần, ở thư mục bất kỳ)
//   NODE_PATH=<thư mục đó>/node_modules node mau-powerpoint/nguon/tao_mau_powerpoint.js
//
// Kết quả: mau-powerpoint/HAWASUCO_Mung_20-10.pptx
// pptxgenjs không hỗ trợ hiệu ứng, nên hiệu ứng chuyển trang (Curtains, Morph) và hiệu ứng
// xuất hiện / lặp lại (cánh hoa rơi, hoa xoay, chữ nhịp đập) được ghi thẳng vào XML sau khi tạo file.

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const fa = require("react-icons/fa");
const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));
const art = require("./hinh_ve");

const ROOT = path.resolve(__dirname, "..", "..");
const LOGO = path.join(ROOT, "2", "src", "logo.png");
const OUT = path.resolve(__dirname, "..", "HAWASUCO_Mung_20-10.pptx");
const APPLY_THEME = process.env.APPLY_THEME; // đường dẫn tới apply_theme.js của skill pptx (nếu có)

const THEME = {
	name: "HAWASUCO 20-10",
	headFontFace: "Cambria",
	bodyFontFace: "Calibri",
	colors: {
		dk1: "3D1F33",
		lt1: "FFFFFF",
		dk2: "1B3A8C",
		lt2: "FDEEF3",
		accent1: "D23B4F",
		accent2: "E5679A",
		accent3: "0049B7",
		accent4: "5E9E36",
		accent5: "8C5A72",
		accent6: "F8C6D6",
		hlink: "0049B7",
		folHlink: "8C5A72",
	},
};
const HEX = THEME.colors;
const W = 13.333;
const H = 7.5;
const ORG = "CÔNG ĐOÀN CÔNG TY CỔ PHẦN CẤP THOÁT NƯỚC – CÔNG TRÌNH ĐÔ THỊ HẬU GIANG";

async function iconPng(name, color) {
	const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(fa[name], { color: "#" + color, size: "256" }));
	return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}
const b64 = (buf, mime = "png") => `image/${mime};base64,` + buf.toString("base64");

// ======================= Hiệu ứng (ghi vào XML) =======================
// Mỗi hiệu ứng: { name, fx, at (ms tính từ lúc mở trang), dur, ... }. Tất cả là "With Previous"
// có độ trễ, nên các hiệu ứng lặp vô hạn không chặn hiệu ứng khác.

const ENTR = { fade: [10, 0], float: [42, 0], zoom: [53, 16], wipeL: [22, 8] };

function effectXml(e, shape, grpId, nodeType, nextId) {
	const tgt = `<p:tgtEl><p:spTgt spid="${shape.id}"/></p:tgtEl>`;
	const grp = shape.kind === "pic" ? "" : ` grpId="${grpId}"`;
	const id = nextId();
	const cTn = (attrs, body) => `<p:par><p:cTn id="${id}" ${attrs} fill="hold"${grp} nodeType="${nodeType}"><p:stCondLst><p:cond delay="${Math.round(e.at)}"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par>`;
	const bhvr = (dur, extra = "") => `<p:cBhvr><p:cTn id="${nextId()}" dur="${dur}" fill="hold"/>${tgt}${extra}</p:cBhvr>`;
	const attr = (...names) => `<p:attrNameLst>${names.map((n) => `<p:attrName>${n}</p:attrName>`).join("")}</p:attrNameLst>`;
	const str = (v) => `<p:strVal val="${v}"/>`;
	const anim = (a, from, to) => `<p:anim calcmode="lin" valueType="num">${bhvr(e.dur, attr(a))}<p:tavLst><p:tav tm="0"><p:val>${from}</p:val></p:tav><p:tav tm="100000"><p:val>${to}</p:val></p:tav></p:tavLst></p:anim>`;
	const filter = (f) => `<p:animEffect transition="in" filter="${f}"><p:cBhvr><p:cTn id="${nextId()}" dur="${e.dur}"/>${tgt}</p:cBhvr></p:animEffect>`;
	const loop = ` repeatCount="indefinite"${e.autoRev ? ' autoRev="1"' : ""}`;

	if (ENTR[e.fx]) {
		const [pid, sub] = ENTR[e.fx];
		let body = `<p:set><p:cBhvr><p:cTn id="${nextId()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${tgt}${attr("style.visibility")}</p:cBhvr><p:to>${str("visible")}</p:to></p:set>`;
		if (e.fx === "fade") body += filter("fade");
		if (e.fx === "float") body += filter("fade") + anim("ppt_x", str("#ppt_x"), str("#ppt_x")) + anim("ppt_y", str("#ppt_y+.1"), str("#ppt_y"));
		if (e.fx === "zoom") body += anim("ppt_w", '<p:fltVal val="0"/>', str("#ppt_w")) + anim("ppt_h", '<p:fltVal val="0"/>', str("#ppt_h")) + filter("fade");
		if (e.fx === "wipeL") body += filter("wipe(left)");
		return cTn(`presetID="${pid}" presetClass="entr" presetSubtype="${sub}"`, body);
	}
	if (e.fx === "pulse") return cTn(`presetID="6" presetClass="emph" presetSubtype="0"${loop}`, `<p:animScale>${bhvr(e.dur)}<p:by x="${e.scale || 106000}" y="${e.scale || 106000}"/></p:animScale>`);
	if (e.fx === "spin") return cTn(`presetID="8" presetClass="emph" presetSubtype="0"${loop}`, `<p:animRot by="${Math.round(e.deg * 60000)}">${bhvr(e.dur, attr("r"))}</p:animRot>`);
	if (e.fx === "path")
		return cTn(`presetID="0" presetClass="path" presetSubtype="0"${loop}`, `<p:animMotion origin="layout" path="${e.path}" pathEditMode="relative" ptsTypes="">${bhvr(e.dur, attr("ppt_x", "ppt_y"))}</p:animMotion>`);
	throw new Error("Hiệu ứng lạ: " + e.fx);
}

function timingXml(effects, shapes) {
	let n = 4;
	const nextId = () => ++n;
	const grpCount = new Map();
	const builds = [];
	const sorted = [...effects].sort((a, b) => a.at - b.at);
	const body = sorted
		.map((e) => {
			const shape = shapes.get(e.name);
			if (!shape || shape.dup) throw new Error(`Không tìm thấy (hoặc trùng tên) đối tượng "${e.name}" để gắn hiệu ứng`);
			const g = grpCount.get(shape.id) || 0;
			grpCount.set(shape.id, g + 1);
			if (shape.kind === "sp") builds.push(`<p:bldP spid="${shape.id}" grpId="${g}" animBg="1"/>`);
			if (shape.kind === "graphicFrame") builds.push(`<p:bldGraphic spid="${shape.id}" grpId="${g}"><p:bldAsOne/></p:bldGraphic>`);
			return effectXml(e, shape, g, "withEffect", nextId);
		})
		.join("");
	return (
		`<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
		`<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
		`<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>` +
		`<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par>` +
		`</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn>` +
		`<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
		`<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>` +
		`</p:childTnLst></p:cTn></p:par></p:tnLst>${builds.length ? `<p:bldLst>${builds.join("")}</p:bldLst>` : ""}</p:timing>`
	);
}

const MC = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
const P14 = 'xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"';
const P15 = 'xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main"';
const P159 = 'xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main"';
const FALLBACK = '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback>';

function transitionXml(kind) {
	if (kind === "curtains")
		return `<mc:AlternateContent ${MC}><mc:Choice ${P15} ${P14} Requires="p15"><p:transition spd="slow" p14:dur="2500"><p15:prstTrans prst="curtains"/></p:transition></mc:Choice>${FALLBACK}</mc:AlternateContent>`;
	if (kind === "morph")
		return `<mc:AlternateContent ${MC}><mc:Choice ${P159} ${P14} Requires="p159"><p:transition spd="slow" p14:dur="1800"><p159:morph option="byObject"/></p:transition></mc:Choice>${FALLBACK}</mc:AlternateContent>`;
	return `<p:transition spd="slow"><p:fade/></p:transition>`;
}

function shapesOf(xml) {
	const map = new Map();
	const re = /<p:nv(Sp|Pic|GraphicFrame|CxnSp)Pr>\s*<p:cNvPr id="(\d+)" name="([^"]*)"/g;
	let m;
	while ((m = re.exec(xml))) {
		// Tên trùng (vd các ô chữ mặc định "Text 1") chỉ là lỗi khi chính tên đó được gắn hiệu ứng.
		map.set(m[3], map.has(m[3]) ? { dup: true } : { id: m[2], kind: m[1] === "Pic" ? "pic" : m[1] === "GraphicFrame" ? "graphicFrame" : "sp" });
	}
	return map;
}

async function finish(file, plan) {
	const zip = await JSZip.loadAsync(fs.readFileSync(file));
	for (let i = 0; i < plan.length; i++) {
		const part = `ppt/slides/slide${i + 1}.xml`;
		let xml = await zip.file(part).async("string");
		if (!xml.includes("</p:clrMapOvr></p:sld>")) throw new Error(`${part}: không đúng cấu trúc mong đợi`);
		const { transition, effects } = plan[i];
		xml = xml.replace("</p:clrMapOvr></p:sld>", `</p:clrMapOvr>${transitionXml(transition)}${effects.length ? timingXml(effects, shapesOf(xml)) : ""}</p:sld>`);
		zip.file(part, xml);
	}
	// pptxgenjs lưu một bản ảnh cho mỗi lần dùng, đặt tên ảnh theo tên bố cục (có dấu tiếng Việt)
	// và luôn dùng đuôi .png kể cả ảnh JPEG: gộp ảnh trùng, đặt lại tên ASCII với đuôi đúng định dạng.
	const target = new Map();
	const kept = new Map();
	let k = 0;
	for (const name of Object.keys(zip.files).filter((f) => f.startsWith("ppt/media/") && !zip.files[f].dir).sort()) {
		const buf = await zip.file(name).async("nodebuffer");
		const hash = crypto.createHash("sha1").update(buf).digest("hex");
		if (!kept.has(hash)) {
			const ext = buf[0] === 0xff && buf[1] === 0xd8 ? "jpeg" : "png";
			kept.set(hash, `hinh${++k}.${ext}`);
			zip.file("ppt/media/" + kept.get(hash), buf);
		}
		target.set(path.basename(name), kept.get(hash));
		zip.remove(name);
	}
	for (const name of Object.keys(zip.files).filter((f) => f.endsWith(".rels"))) {
		const xml = await zip.file(name).async("string");
		const out = xml.replace(/Target="\.\.\/media\/([^"]+)"/g, (all, f) => (target.has(f) ? `Target="../media/${target.get(f)}"` : all));
		if (out !== xml) zip.file(name, out);
	}
	fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

// ======================= Trình chiếu =======================

async function main() {
	const pres = new pptxgen();
	pres.layout = "LAYOUT_WIDE";
	pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
	pres.title = "Mừng ngày Phụ nữ Việt Nam 20/10";
	pres.author = "HAWASUCO";
	pres.company = "Công ty CP Cấp thoát nước – Công trình đô thị Hậu Giang";
	const C = pres.SchemeColor;

	// ----- Hình ảnh -----
	const logo = b64(fs.readFileSync(LOGO));
	const bg = b64(await art.nen(), "jpeg");
	const hong = b64(await art.hoaHong());
	const hongDao = b64(await art.hoaHong({ mau: "dao", seed: 9 }));
	const sen = b64(await art.hoaSen());
	const anh = b64(await art.khungAnh());
	const petalColors = [
		["#E2557F", "#FBC7D7"],
		["#F28DB0", "#FFE8EF"],
		["#E8795F", "#FDD9CB"],
		["#D94C7A", "#F7B3C9"],
	];
	const petals = [];
	for (let i = 0; i < petalColors.length; i++) petals.push(b64(await art.canhHoa(petalColors[i], i + 11)));
	const leaves = [b64(await art.la(3)), b64(await art.la(8))];

	const shadow = () => ({ type: "outer", color: "B0436B", opacity: 0.18, blur: 16, offset: 4, angle: 90 });

	// ----- Bố cục -----
	pres.defineSlideMaster({ title: "Phông chính", background: { data: bg }, objects: [] });
	const brand = [
		{ image: { data: logo, x: 0.5, y: 0.32, w: 0.7, h: 0.7, altText: "Logo HAWASUCO" } },
		{ text: { text: ORG, options: { x: 1.32, y: 0.47, w: 9.5, h: 0.4, fontFace: THEME.bodyFontFace, fontSize: 12, bold: true, color: C.text2, charSpacing: 0.5, margin: 0, valign: "middle" } } },
	];
	pres.defineSlideMaster({ title: "Có logo", background: { data: bg }, objects: brand });
	pres.defineSlideMaster({
		title: "Nội dung",
		background: { data: bg },
		objects: [
			...brand,
			{ placeholder: { options: { name: "title", type: "title", x: 0.8, y: 1.2, w: 11.7, h: 0.85, fontSize: 40, bold: true, color: C.text2, align: "left", valign: "middle", margin: 0 }, text: "Tiêu đề trang" } },
			{ placeholder: { options: { name: "sub", type: "body", x: 0.8, y: 2.05, w: 11.7, h: 0.45, fontSize: 18, italic: true, color: C.accent2, align: "left", valign: "top", margin: 0 }, text: "Dòng phụ" } },
		],
	});

	// ----- Thành phần dùng chung -----
	// Hoa: tên bắt đầu bằng "!!" để Morph nối vị trí giữa các trang.
	const flower = (s, name, data, x, y, w, extra = {}) => s.addImage({ data, objectName: name, x, y, w, h: w, altText: "Hoa trang trí", ...extra });
	const flowers = (s, pos) => {
		if (pos.hongdao) flower(s, "!!hongdao", hongDao, ...pos.hongdao);
		if (pos.hong) flower(s, "!!hong", hong, ...pos.hong);
		if (pos.hongnho) flower(s, "!!hongnho", hong, ...pos.hongnho);
		if (pos.sen) flower(s, "!!sen", sen, ...pos.sen, { rotate: -1.5 });
	};
	// Hiệu ứng lặp cho hoa: hồng xoay chậm, sen đung đưa.
	const flowerLoops = (pos, at = 0) => [
		pos.hong && { name: "!!hong", fx: "spin", deg: 360, dur: 60000, at },
		pos.hongdao && { name: "!!hongdao", fx: "spin", deg: -360, dur: 45000, at },
		pos.hongnho && { name: "!!hongnho", fx: "spin", deg: 360, dur: 50000, at },
		pos.sen && { name: "!!sen", fx: "spin", deg: 3, dur: 2600, autoRev: true, at },
	].filter(Boolean);

	// Cánh hoa và lá rơi: đặt sẵn phía trên mép trang, rơi xuống rồi lặp lại đến hết trang.
	const FALL = [
		[0.6, 0, 0.42, 11000, 0.06], [1.9, 1, 0.34, 9500, -0.04], [3.1, 2, 0.46, 12500, 0.08], [4.3, 3, 0.36, 10000, -0.06],
		[5.6, 0, 0.3, 9000, 0.05], [6.8, 1, 0.44, 11500, -0.07], [8.0, 2, 0.34, 10500, 0.06], [9.1, 3, 0.4, 12000, -0.05],
		[10.3, 0, 0.36, 9800, 0.07], [11.4, 1, 0.42, 11200, -0.08], [12.5, 2, 0.32, 10200, -0.04], [7.4, 3, 0.3, 9300, 0.04],
	];
	const FALL_LEAF = [[2.5, 0, 0.55, 13000, 0.1], [8.8, 1, 0.5, 14000, -0.09], [12.0, 0, 0.48, 12500, -0.12]];
	function falling(s) {
		const fx = [];
		const add = (list, imgs, prefix, start) =>
			list.forEach(([x, k, size, dur, dx], i) => {
				const name = `${prefix} ${i + 1}`;
				s.addImage({ data: imgs[k % imgs.length], objectName: name, x, y: -0.9, w: size, h: size, altText: "Cánh hoa rơi" });
				const q = (v) => v.toFixed(3);
				const path = `M 0 0 C ${q(dx)} 0.2 ${q(-dx)} 0.4 ${q(dx * 0.4)} 0.6 C ${q(dx * 1.4)} 0.8 ${q(-dx * 0.2)} 1.0 ${q(dx * 0.8)} 1.18 E`;
				const at = start + ((i * 1370) % 7000);
				fx.push({ name, fx: "path", path, dur, at });
				fx.push({ name, fx: "spin", deg: i % 2 ? -360 : 360, dur: 3500 + ((i * 700) % 3000), at });
			});
		add(FALL, petals, "Cánh hoa rơi", 0);
		add(FALL_LEAF, leaves, "Lá rơi", 1500);
		return fx;
	}

	const plan = [];

	// ===== 1. Phông chính =====
	{
		const s = pres.addSlide({ masterName: "Phông chính" });
		const pos = { hongdao: [8.75, 5.55, 2.7], hong: [9.55, 3.35, 5.1], hongnho: [11.75, -1.05, 2.3], sen: [-0.6, 3.35, 4.4] };
		flowers(s, pos);
		s.addImage({ data: leaves[0], objectName: "Lá 1", x: 0.7, y: 0.55, w: 0.6, h: 0.6, altText: "Lá trang trí" });
		s.addImage({ data: leaves[1], objectName: "Lá 2", x: 11.1, y: 1.6, w: 0.55, h: 0.55, altText: "Lá trang trí" });
		s.addImage({ data: petals[1], objectName: "Cánh hoa 1", x: 1.5, y: 2.35, w: 0.38, h: 0.38, altText: "Cánh hoa" });
		s.addImage({ data: petals[0], objectName: "Cánh hoa 2", x: 10.5, y: 0.75, w: 0.32, h: 0.32, altText: "Cánh hoa" });
		s.addImage({ data: logo, objectName: "Logo", x: W / 2 - 0.47, y: 0.25, w: 0.94, h: 0.94, altText: "Logo Công ty CP Cấp thoát nước – Công trình đô thị Hậu Giang" });
		const t = (text, name, y, h, o) => s.addText(text, { objectName: name, x: 1.67, y, w: 10, h, align: "center", valign: "middle", margin: 0, isTextBox: true, ...o });
		t(ORG, "Đơn vị", 1.25, 0.4, { fontSize: 15, bold: true, color: C.text2, charSpacing: 0.5 });
		t("Mừng ngày", "Mừng ngày", 1.72, 0.95, { fontFace: THEME.headFontFace, fontSize: 54, italic: true, color: C.text2 });
		t("Phụ Nữ", "Phụ Nữ", 2.62, 1.3, { fontFace: THEME.headFontFace, fontSize: 88, bold: true, color: C.text2 });
		t("Việt Nam", "Việt Nam", 3.88, 1.3, { fontFace: THEME.headFontFace, fontSize: 88, bold: true, color: C.accent1 });
		t("20/10", "Ngày", 5.2, 0.9, { fontFace: THEME.headFontFace, fontSize: 60, bold: true, color: C.accent1 });
		s.addText([{ text: "Kỷ niệm 96 năm Ngày thành lập Hội LHPN Việt Nam", options: { breakLine: true } }, { text: "(20/10/1930 – 20/10/2026)" }], {
			objectName: "Kỷ niệm", x: 4.17, y: 6.12, w: 5.0, h: 0.75, fontSize: 15, italic: true, color: C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true,
		});
		s.addNotes(
			"PHÔNG CHÍNH – dùng làm phông sân khấu / màn hình chờ.\n" +
				"• Sửa chữ: nhấp đúp vào chữ để sửa (tên đơn vị, năm kỷ niệm…). Có thể đổi phông chữ \"Mừng ngày\" sang phông thư pháp có hỗ trợ tiếng Việt.\n" +
				"• Đổi logo: Chuột phải vào logo → Change Picture.\n" +
				"• Cánh hoa rơi được đặt sẵn phía trên mép trang chiếu, khi trình chiếu (F5) sẽ rơi liên tục đến hết trang.\n" +
				"• Hiệu ứng chuyển trang Curtains (rèm sân khấu) và Morph cần PowerPoint 2019 / Microsoft 365; bản cũ hơn sẽ tự dùng hiệu ứng Fade."
		);
		plan.push({
			transition: "curtains",
			effects: [
				...falling(s),
				{ name: "!!hong", fx: "zoom", dur: 900, at: 0 },
				{ name: "!!hongdao", fx: "zoom", dur: 900, at: 250 },
				{ name: "!!hongnho", fx: "zoom", dur: 900, at: 400 },
				{ name: "!!sen", fx: "float", dur: 1000, at: 200 },
				{ name: "Logo", fx: "zoom", dur: 500, at: 700 },
				{ name: "Đơn vị", fx: "fade", dur: 600, at: 1000 },
				{ name: "Mừng ngày", fx: "wipeL", dur: 1000, at: 1400 },
				{ name: "Phụ Nữ", fx: "zoom", dur: 600, at: 2200 },
				{ name: "Việt Nam", fx: "float", dur: 700, at: 2700 },
				{ name: "Ngày", fx: "zoom", dur: 500, at: 3300 },
				{ name: "Kỷ niệm", fx: "fade", dur: 700, at: 3700 },
				{ name: "Ngày", fx: "pulse", dur: 800, autoRev: true, at: 4400 },
				...flowerLoops(pos, 1100),
			],
		});
	}

	// ===== 2. Lời chúc =====
	{
		const s = pres.addSlide({ masterName: "Có logo" });
		const pos = { hongdao: [11.6, 5.55, 2.4], hong: [10.6, -1.7, 3.8], sen: [-0.45, 1.95, 5.8] };
		flowers(s, pos);
		s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: "Khung lời chúc", x: 5.9, y: 1.3, w: 6.8, h: 5.5, rectRadius: 0.25, fill: { color: C.background1, transparency: 12 }, line: { color: C.accent6, width: 1.5 }, shadow: shadow() });
		s.addImage({ data: await iconPng("FaHeart", HEX.accent2), objectName: "Trái tim", x: 6.4, y: 1.92, w: 0.42, h: 0.42, altText: "Trái tim" });
		s.addText("Thân gửi các chị em phụ nữ HAWASUCO,", { objectName: "Lời mở", x: 6.95, y: 1.66, w: 5.45, h: 0.95, fontFace: THEME.headFontFace, fontSize: 22, italic: true, bold: true, color: C.text2, margin: 0, valign: "middle", isTextBox: true });
		s.addText(
			[
				{ text: "Nhân kỷ niệm 96 năm Ngày Phụ nữ Việt Nam (20/10/1930 – 20/10/2026), Ban Giám đốc và Ban Chấp hành Công đoàn Công ty xin gửi tới toàn thể chị em lời chúc mừng tốt đẹp nhất.", options: { breakLine: true, paraSpaceAfter: 12 } },
				{ text: "Chúc các chị em luôn mạnh khỏe, xinh đẹp, hạnh phúc – là điểm tựa vững chắc của mỗi gia đình và là niềm tự hào của tập thể HAWASUCO!" },
			],
			{ objectName: "Lời chúc", x: 6.4, y: 2.8, w: 5.85, h: 2.95, fontSize: 18, color: C.text1, margin: 0, valign: "top", isTextBox: true, lineSpacingMultiple: 1.12 }
		);
		s.addText("Ban Chấp hành Công đoàn Công ty", { objectName: "Ký tên", x: 6.4, y: 5.95, w: 5.85, h: 0.5, fontFace: THEME.headFontFace, fontSize: 18, italic: true, color: C.accent1, align: "right", margin: 0, valign: "middle", isTextBox: true });
		s.addNotes("LỜI CHÚC – Sửa lời chúc và tên người gửi trực tiếp trong khung. Hoa sen và hoa hồng tự trượt từ trang trước sang nhờ hiệu ứng Morph.");
		plan.push({
			transition: "morph",
			effects: [
				...falling(s),
				{ name: "Khung lời chúc", fx: "float", dur: 700, at: 300 },
				{ name: "Trái tim", fx: "zoom", dur: 500, at: 800 },
				{ name: "Lời mở", fx: "wipeL", dur: 900, at: 900 },
				{ name: "Lời chúc", fx: "fade", dur: 900, at: 1700 },
				{ name: "Ký tên", fx: "float", dur: 600, at: 2500 },
				{ name: "Trái tim", fx: "pulse", dur: 600, autoRev: true, scale: 115000, at: 3200 },
				...flowerLoops(pos, 1800),
			],
		});
	}

	// ===== 3. Chương trình =====
	{
		const s = pres.addSlide({ masterName: "Nội dung" });
		const pos = { hongdao: [-0.9, 6.0, 1.9], hong: [10.65, -1.75, 3.7], sen: [9.6, 3.35, 4.3] };
		flowers(s, pos);
		s.addText("Chương trình họp mặt", { placeholder: "title" });
		s.addText("Kỷ niệm 96 năm Ngày Phụ nữ Việt Nam 20/10", { placeholder: "sub" });
		const rows = [
			["08:00", "Đón tiếp đại biểu, văn nghệ chào mừng"],
			["08:30", "Tuyên bố lý do, giới thiệu đại biểu"],
			["08:40", "Ôn lại truyền thống Ngày Phụ nữ Việt Nam 20/10"],
			["09:00", "Phát biểu chúc mừng của Ban Giám đốc Công ty"],
			["09:20", "Tặng hoa, quà chúc mừng – giao lưu, chụp ảnh lưu niệm"],
		];
		const effects = [...falling(s)];
		rows.forEach(([time, text], i) => {
			const y = 2.75 + i * 0.84;
			s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: `Dòng ${i + 1}`, x: 0.8, y, w: 8.4, h: 0.68, rectRadius: 0.34, fill: { color: C.background1, transparency: 20 }, line: { type: "none" }, shadow: shadow() });
			s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: `Giờ nền ${i + 1}`, x: 0.88, y: y + 0.08, w: 1.3, h: 0.52, rectRadius: 0.26, fill: { color: i % 2 ? C.accent2 : C.accent1 }, line: { type: "none" } });
			s.addText(time, { objectName: `Giờ ${i + 1}`, x: 0.88, y: y + 0.08, w: 1.3, h: 0.52, fontSize: 17, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
			s.addText(text, { objectName: `Nội dung ${i + 1}`, x: 2.45, y, w: 6.6, h: 0.68, fontSize: 18, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
			const at = 400 + i * 380;
			for (const n of [`Dòng ${i + 1}`, `Giờ nền ${i + 1}`, `Giờ ${i + 1}`, `Nội dung ${i + 1}`]) effects.push({ name: n, fx: "float", dur: 550, at });
		});
		s.addNotes("CHƯƠNG TRÌNH – Sửa giờ và nội dung từng dòng. Thêm dòng: chọn cả 4 đối tượng của một dòng (khung, nền giờ, giờ, nội dung) → Ctrl+D rồi kéo xuống.");
		plan.push({ transition: "morph", effects: [...effects, ...flowerLoops(pos, 1800)] });
	}

	// ===== 4. Ý nghĩa =====
	{
		const s = pres.addSlide({ masterName: "Nội dung" });
		const pos = { hongdao: [11.0, 5.75, 2.2], hong: [10.95, 4.6, 3.4], sen: [-0.75, 4.35, 3.6] };
		flowers(s, pos);
		s.addText("Ý nghĩa Ngày Phụ nữ Việt Nam", { placeholder: "title" });
		s.addText("Tôn vinh vẻ đẹp và những đóng góp của phụ nữ Việt Nam", { placeholder: "sub" });
		const cards = [
			["FaCalendarAlt", "20/10/1930", "Hội Phụ nữ phản đế Việt Nam – tiền thân của Hội Liên hiệp Phụ nữ Việt Nam – được thành lập."],
			["FaFlag", "Truyền thống vẻ vang", "Phụ nữ Việt Nam kiên cường trong đấu tranh, chăm chỉ, sáng tạo trong xây dựng đất nước."],
			["FaHeart", "Lời tri ân", "Dịp để mỗi gia đình và tập thể gửi lời cảm ơn, yêu thương tới mẹ, vợ, chị em và đồng nghiệp."],
		];
		const cw = (11.733 - 2 * 0.35) / 3;
		const effects = [...falling(s)];
		for (const [i, [ic, t, d]] of cards.entries()) {
			const x = 0.8 + i * (cw + 0.35);
			const y = 2.75;
			s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: `Thẻ ${i + 1}`, x, y, w: cw, h: 2.75, rectRadius: 0.2, fill: { color: C.background1, transparency: 12 }, line: { color: C.accent6, width: 1 }, shadow: shadow() });
			s.addShape(pres.shapes.OVAL, { objectName: `Vòng ${i + 1}`, x: x + 0.35, y: y + 0.35, w: 0.8, h: 0.8, fill: { color: i === 1 ? C.text2 : C.accent1 }, line: { type: "none" } });
			s.addImage({ data: await iconPng(ic, "FFFFFF"), objectName: `Biểu tượng ${i + 1}`, x: x + 0.56, y: y + 0.56, w: 0.38, h: 0.38, altText: t });
			s.addText(t, { objectName: `Tiêu đề ${i + 1}`, x: x + 1.35, y: y + 0.35, w: cw - 1.6, h: 0.8, fontFace: THEME.headFontFace, fontSize: 20, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
			s.addText(d, { objectName: `Mô tả ${i + 1}`, x: x + 0.35, y: y + 1.35, w: cw - 0.7, h: 1.25, fontSize: 15, color: C.text1, valign: "top", margin: 0, isTextBox: true });
			const at = 400 + i * 450;
			for (const n of [`Thẻ ${i + 1}`, `Vòng ${i + 1}`, `Biểu tượng ${i + 1}`, `Tiêu đề ${i + 1}`, `Mô tả ${i + 1}`]) effects.push({ name: n, fx: "float", dur: 600, at });
		}
		s.addText([{ text: "Tám chữ vàng Bác Hồ khen tặng phụ nữ Việt Nam", options: { fontFace: THEME.bodyFontFace, fontSize: 16, bold: false, color: C.accent5, breakLine: true } }, { text: "Anh hùng – Bất khuất – Trung hậu – Đảm đang" }], {
			objectName: "Tám chữ vàng", x: 2.47, y: 5.72, w: 8.4, h: 1.05, fontFace: THEME.headFontFace, fontSize: 26, bold: true, italic: true, color: C.accent1, align: "center", valign: "middle", margin: 0, isTextBox: true,
		});
		effects.push({ name: "Tám chữ vàng", fx: "zoom", dur: 700, at: 1900 });
		s.addNotes("Ý NGHĨA – Nội dung tham khảo, có thể sửa theo bài phát biểu của đơn vị. \"Anh hùng, bất khuất, trung hậu, đảm đang\" là tám chữ vàng Chủ tịch Hồ Chí Minh khen tặng phụ nữ Việt Nam.");
		plan.push({ transition: "morph", effects: [...effects, ...flowerLoops(pos, 1800)] });
	}

	// ===== 5. Khoảnh khắc =====
	{
		const s = pres.addSlide({ masterName: "Nội dung" });
		const pos = { hongdao: [-0.95, 5.3, 2.4], hong: [10.8, -1.6, 3.5], sen: [10.35, 4.3, 3.4] };
		flowers(s, pos);
		s.addText("Khoảnh khắc đáng nhớ", { placeholder: "title" });
		s.addText("Hình ảnh hoạt động của chị em HAWASUCO", { placeholder: "sub" });
		const captions = ["Nữ cán bộ, nhân viên Công ty", "Hội thao – văn nghệ chào mừng", "Gia đình HAWASUCO"];
		const fw = 3.45;
		const fh = 3.55;
		const gap = 0.55;
		const x0 = (W - (3 * fw + 2 * gap)) / 2;
		const effects = [...falling(s)];
		const angles = [-4, 2.5, -2];
		for (let i = 0; i < 3; i++) {
			const ang = angles[i];
			const fx = x0 + i * (fw + gap);
			const fy = 2.85;
			const cx = fx + fw / 2;
			const cy = fy + fh / 2;
			const rad = (ang * Math.PI) / 180;
			// Đặt ảnh và chú thích theo góc xoay của khung để cả cụm nghiêng cùng nhau.
			const place = (ox, oy, w, h) => {
				const dx = ox + w / 2 - fw / 2;
				const dy = oy + h / 2 - fh / 2;
				return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad) - w / 2, y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) - h / 2, w, h, rotate: ang };
			};
			s.addShape(pres.shapes.RECTANGLE, { objectName: `Khung ảnh ${i + 1}`, ...place(0, 0, fw, fh), fill: { color: C.background1 }, line: { color: C.accent6, width: 0.75 }, shadow: shadow() });
			s.addImage({ data: anh, objectName: `Ảnh ${i + 1}`, ...place(0.15, 0.15, fw - 0.3, (fw - 0.3) / 1.27), altText: "Ảnh minh họa – thay bằng ảnh thật" });
			s.addText(captions[i], { objectName: `Chú thích ${i + 1}`, ...place(0.15, 0.15 + (fw - 0.3) / 1.27 + 0.1, fw - 0.3, 0.7), fontFace: THEME.headFontFace, fontSize: 17, italic: true, color: C.text2, align: "center", valign: "middle", margin: 0, isTextBox: true });
			const at = 400 + i * 450;
			for (const n of [`Khung ảnh ${i + 1}`, `Ảnh ${i + 1}`, `Chú thích ${i + 1}`]) effects.push({ name: n, fx: "zoom", dur: 600, at });
		}
		s.addNotes("KHOẢNH KHẮC – Thay ảnh: Chuột phải vào ảnh hồng → Change Picture → From a File. Ảnh mới giữ nguyên vị trí, góc nghiêng và hiệu ứng. Sửa chú thích bên dưới mỗi ảnh.");
		plan.push({ transition: "morph", effects: [...effects, ...flowerLoops(pos, 1800)] });
	}

	// ===== 6. Kết thúc =====
	{
		const s = pres.addSlide({ masterName: "Phông chính" });
		const pos = { hongdao: [-0.75, 5.5, 2.6], hong: [-1.55, 3.7, 4.6], hongnho: [-0.9, -1.0, 2.2], sen: [9.35, 3.35, 4.4] };
		flowers(s, pos);
		s.addImage({ data: leaves[1], objectName: "Lá 1", x: 12.2, y: 0.6, w: 0.6, h: 0.6, altText: "Lá trang trí" });
		s.addImage({ data: petals[2], objectName: "Cánh hoa 1", x: 2.1, y: 0.9, w: 0.36, h: 0.36, altText: "Cánh hoa" });
		s.addImage({ data: logo, objectName: "Logo", x: W / 2 - 0.47, y: 0.45, w: 0.94, h: 0.94, altText: "Logo Công ty CP Cấp thoát nước – Công trình đô thị Hậu Giang" });
		const t = (text, name, y, h, o) => s.addText(text, { objectName: name, x: 1.67, y, w: 10, h, align: "center", valign: "middle", margin: 0, isTextBox: true, ...o });
		t("Chúc các chị em", "Chúc", 1.75, 0.9, { fontFace: THEME.headFontFace, fontSize: 48, italic: true, color: C.text2 });
		t("Luôn xinh đẹp, hạnh phúc", "Dòng 1", 2.7, 1.05, { fontFace: THEME.headFontFace, fontSize: 60, bold: true, color: C.accent1 });
		t("và thành công!", "Dòng 2", 3.75, 1.05, { fontFace: THEME.headFontFace, fontSize: 60, bold: true, color: C.text2 });
		s.addImage({ data: await iconPng("FaHeart", HEX.accent2), objectName: "Trái tim", x: W / 2 - 0.3, y: 5.05, w: 0.6, h: 0.6, altText: "Trái tim" });
		t("HAWASUCO trân trọng!", "Lời kết", 5.85, 0.6, { fontSize: 20, italic: true, color: C.text1 });
		s.addNotes("KẾT THÚC – Sửa lời chúc cuối chương trình. Trang này có thể để chiếu suốt phần giao lưu, cánh hoa rơi liên tục.");
		plan.push({
			transition: "morph",
			effects: [
				...falling(s),
				{ name: "Logo", fx: "zoom", dur: 500, at: 300 },
				{ name: "Chúc", fx: "wipeL", dur: 900, at: 700 },
				{ name: "Dòng 1", fx: "zoom", dur: 700, at: 1500 },
				{ name: "Dòng 2", fx: "float", dur: 700, at: 2100 },
				{ name: "Trái tim", fx: "zoom", dur: 500, at: 2700 },
				{ name: "Lời kết", fx: "fade", dur: 700, at: 3000 },
				{ name: "Trái tim", fx: "pulse", dur: 600, autoRev: true, scale: 118000, at: 3500 },
				...flowerLoops(pos, 1800),
			],
		});
	}

	await pres.writeFile({ fileName: OUT });
	if (APPLY_THEME) await require(APPLY_THEME).applyTheme(OUT, THEME);
	await finish(OUT, plan);
	console.log("Đã tạo", OUT, (fs.statSync(OUT).size / 1048576).toFixed(1) + " MB");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
