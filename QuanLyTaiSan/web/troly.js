// Quản lý tài sản – Trợ lý ảo Hawasuco (chép từ trợ lý ảo trên website HAWASUCO, chỉnh cho phần mềm Quản lý tài sản)
// ===================== TRỢ LÝ ẢO (CHATBOT) =====================
// Hai "bộ não":
//  1) Có sẵn (miễn phí, luôn chạy, không gửi gì ra ngoài): kho kiến thức troly-kien-thuc.json (hướng dẫn dùng phần mềm, quy trình)
//     + tra cứu số liệu qua /api của máy chủ theo quyền người đang đăng nhập: tìm tài sản, tổng quan, tài sản hỏng, đến hạn bảo dưỡng,
//     lâu chưa kiểm tra, tiến độ kiểm kê, theo đơn vị, hoạt động gần đây; tính khấu hao; báo hỏng tài sản; để lại lời nhắn cho quản trị.
//  2) AI (khi quản trị đã nhập khóa API Claude ở Cài đặt → Trợ lý ảo): trả lời tự nhiên, chỉ dựa trên kiến thức của phần mềm.
//     Máy chủ chưa có khóa hoặc AI lỗi -> tự quay về bộ có sẵn.
// Chạy riêng với app.js: đọc phiên đăng nhập của phần mềm (localStorage qlts.token) để gọi /api, chuyển trang bằng location.hash.
const esc=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=t=>String(t).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
const BOT_APP=window.QuanLyTaiSanApp||null;   // mở trong app Android "Quản lý tài sản" (cầu nối camera, giọng nói…)
const BOT={kb:{items:[]},ai:null,hist:[],state:null,open:false,busy:false,greeted:false};
const BOT_VOICE_APP={nghe:!!(BOT_APP&&typeof BOT_APP.batNghe==="function"),doc:!!(BOT_APP&&typeof BOT_APP.docChu==="function")};   // app Android: nghe / đọc tiếng Việt bằng Android
const BOT_CHIPS=[["😄 Kể chuyện vui","kể chuyện vui"],["🗣️ Chuyện Bác Ba Phi","chuyện bác ba phi"],["📊 Tổng quan","tổng quan tài sản"],["🔎 Tìm tài sản","tìm tài sản"],["🔧 Tài sản hỏng","tài sản hỏng"],["🛠️ Đến hạn bảo dưỡng","tài sản đến hạn bảo dưỡng"],["📋 Kiểm kê năm nay","tiến độ kiểm kê"],["🏷️ In tem QR","cách in tem QR"],["📷 Quét mã QR","cách quét mã QR"],["🧮 Tính khấu hao","tính khấu hao"],["⚠️ Báo hỏng tài sản","báo hỏng tài sản"],["✉️ Nhắn quản trị","để lại lời nhắn"]];
const botN=t=>norm(t).replace(/[^a-z0-9³\s.,]/g," ").replace(/\s+/g," ").trim();

// ---- hiển thị: **đậm**, !!đỏ!!, [chữ](#/trang | https://… | api/tai/…), "- " gạch đầu dòng, xuống dòng
function botMd(t){
  const lines=esc(t).split("\n");let out="",ul=false;
  const inl=s=>s.replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/!!([^!]+)!!/g,'<span class="bm-red">$1</span>').replace(/\[([^\]]+)\]\(((?:#\/|https:\/\/|api\/tai\/|tai-app)[^)\s]*)\)/g,(m,a,u)=>u.startsWith("#")?`<a href="${u}" data-bot-nav>${a}</a>`:`<a href="${u}" target="_blank" rel="noopener">${a}</a>`);
  for(const l of lines){if(/^\s*[-•]\s+/.test(l)){if(!ul){out+="<ul>";ul=true}out+=`<li>${inl(l.replace(/^\s*[-•]\s+/,""))}</li>`}else{if(ul){out+="</ul>";ul=false}out+=l.trim()?`<p>${inl(l)}</p>`:""}}
  return out+(ul?"</ul>":"")}
const BOT_HEADSET='<g class="bm-headset"><path d="M76 122 C64 -10 278 -14 270 118" stroke="#1f262e" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M78 114 C68 -4 274 -8 268 110" stroke="#5b6672" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/><path d="M148 18 Q172 15 196 17.5" stroke="#3ee0ff" stroke-width="3" fill="none" stroke-linecap="round" filter="url(#bmGlow)"/><circle cx="77" cy="127" r="18" fill="#1f262e"/><circle cx="77" cy="127" r="11" fill="#2e3742" stroke="#3ee0ff" stroke-width="2" filter="url(#bmGlow)"/><circle cx="270" cy="122" r="17" fill="#1f262e"/><circle cx="270" cy="122" r="10.5" fill="#2e3742" stroke="#3ee0ff" stroke-width="2" filter="url(#bmGlow)"/><path d="M76 142 Q84 180 140 178" stroke="#1f262e" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M78 144 Q86 176 138 175" stroke="#5b6672" stroke-width="1.8" fill="none" stroke-linecap="round"/><rect x="136" y="169" width="22" height="15" rx="7.5" fill="#262e37"/><g stroke="#3d4752" stroke-width="1.2"><path d="M141 171v11M145 170v13M149 170v13M153 171v11"/></g><circle class="bm-mic-led" cx="158.5" cy="176.5" r="2.8" fill="#3ee0ff" filter="url(#bmGlow)"/></g>';
// ---- Trò chuyện vui: kể chuyện cười (chủ đề nước sạch, tiết kiệm nước, tài sản, tem QR, kiểm kê), đố vui, chào hỏi, hỏi thăm
const BOT_JOKES=[
 "Ống nước hỏi đồng hồ nước: \"Sao cậu cứ đếm từng giọt của tôi thế?\"\nĐồng hồ đáp: \"Nghề của tôi mà – tôi phải **ghi nhớ từng khoảnh khắc** bên cậu chứ!\" 😄",
 "Con hỏi bố: \"Bố ơi, nước máy từ đâu ra?\"\n– Từ nhà máy nước con ạ.\n– Thế nước mắt của bố từ đâu ra?\nBố nhìn hóa đơn tháng này: \"Từ… **cái vòi con quên khóa** đó!\" 😅\nMẹo: khóa vòi khi đánh răng, mỗi lần tiết kiệm được vài lít nước đấy ạ.",
 "Anh A khoe: \"Tháng rồi nhà tôi chỉ dùng có 2 khối nước!\"\nAnh B: \"Giỏi quá, bí quyết là gì vậy?\"\nAnh A: \"**Cả nhà đi du lịch nguyên tháng!**\" 🧳😂",
 "Vòi nước nhỏ giọt hỏi bồn rửa: \"Sao dạo này cậu buồn thế?\"\nBồn rửa: \"Ngày nào cậu cũng **làm tôi rơi lệ**…\" 💧\nNhớ sửa vòi nhỏ giọt nhé – vừa hết buồn, vừa bớt tiền nước!",
 "Robot trợ lý ảo đi khám bệnh.\nBác sĩ: \"Anh thấy trong người thế nào?\"\nRobot: \"Dạ… hơi **nhiều dữ liệu** ạ!\" 🤖😆",
 "Thầy hỏi: \"Nước sôi ở bao nhiêu độ?\"\nTrò: \"Dạ 100 độ ạ. Nhưng nhà em thì nước sôi **khi mẹ thấy hóa đơn tăng** ạ!\" 🔥😂",
 "Khách hỏi trợ lý ảo: \"Sao em trả lời nhanh vậy?\"\nTrợ lý ảo: \"Dạ, em được nối thẳng vào **đường ống dữ liệu** của Hawasuco, áp lực luôn ổn định ạ!\" 😎",
 "Giọt nước nói với giọt dầu: \"Mình làm bạn nhé!\"\nGiọt dầu: \"Tiếc quá, tụi mình **không hòa hợp** được rồi!\" 🛢️💧😄",
 "Bố giục con: \"Tắm nhanh lên, đồng hồ nước đang quay kìa!\"\nCon: \"Bố đâu thấy đồng hồ, sao bố biết nó quay?\"\nBố: \"Bố nghe **ví bố kêu**!\" 👛😂",
 "Đồng hồ nước và đồng hồ treo tường gặp nhau.\nĐồng hồ treo tường: \"Tôi đếm thời gian.\"\nĐồng hồ nước: \"Còn tôi đếm… **tiền** của chủ nhà!\" ⏰💧😄",
 "Cô giáo: \"Em hãy kể tên 3 thứ có nước.\"\nTrò: \"Dạ… nước máy, nước mưa và… **nước mắt khi bị kiểm tra bài cũ** ạ!\" 😭😂",
 "Tôi là trợ lý ảo nên không cần uống nước, nhưng ngày nào cũng **\"ngập\"** trong câu hỏi về nước – mà tôi thích lắm! 🌊😄",
 "Tem QR hỏi máy bơm: \"Sao anh cứ rung hoài vậy?\"\nMáy bơm: \"Tại em dán lên người anh, ai đi ngang cũng **quét** một cái, nhột quá!\" 📱😂",
 "Đợt kiểm kê cuối năm, cái ghế văn phòng thì thầm với cái bàn: \"Nghe nói năm nay ai **không có tem QR** là bị ghi 'chưa tìm thấy' đó!\"\nCái bàn: \"Thôi chết, tem của tui dán **dưới gầm**, chắc phải nằm ngửa ra cho người ta quét!\" 🪑😆",
 "Sếp hỏi: \"Cái máy phát điện dự phòng để đâu rồi?\"\nNhân viên: \"Dạ để em hỏi trợ lý ảo.\"\nTrợ lý ảo: \"Dạ máy ở **trạm tăng áp**, kiểm tra lần cuối hôm qua, tình trạng tốt, có cả ảnh ạ!\"\nSếp: \"Ủa, sao **em rành hơn anh** vậy?\" 🤖😎",
 "Máy bơm cũ than với máy bơm mới: \"Tui làm 15 năm rồi, giờ trên sổ **giá trị còn lại bằng 0**…\"\nMáy bơm mới: \"Kệ, trên sổ thì 0 chứ ngoài trạm anh vẫn là **cây đa cây đề** mà!\" 💪😄",
 "Kế toán hỏi phần mềm: \"Khấu hao là gì vậy?\"\nPhần mềm: \"Là mỗi năm tài sản **già đi một chút** trên giấy tờ, còn ngoài đời nhờ bảo dưỡng đúng hạn nên vẫn **trẻ khỏe**!\" 🧮😄",
 "Cái máy in than: \"Sao tháng này in nhiều tem quá vậy?\"\nCán bộ tài sản: \"Tại tài sản nào cũng muốn có **căn cước** riêng mà!\" 🏷️😂",
 "Cái xe bồn được điều chuyển qua đội mới, hỏi phần mềm: \"Có ai nhớ tui ở đội cũ không?\"\nPhần mềm: \"Yên tâm, **lịch sử** của anh tui ghi đủ hết, từng lần kiểm tra, bảo dưỡng, điều chuyển!\" 🚚😄"
];
const BOT_BAPHI=[
 "Hồi đó nhà tui xài nước tiết kiệm dữ lắm. Bữa tui mở vòi rửa mặt, ngồi canh cái đồng hồ nước coi nó nhích được bao nhiêu… Canh từ mùa khô **tới mùa nước nổi năm sau** nó mới qua được **một khối**! 😂",
 "Mùa nước nổi năm đó, con cá lóc bự cỡ bắp vế lội vô vườn tui. Thấy cái vòi nước đang nhỏ giọt, nó ngóc đầu lên uống ừng ực. Uống riết nó **mập ú, hết lội ra kênh nổi**, tui phải kêu nguyên xóm khiêng nó ra! 🐟\nTừ đó tui sửa vòi liền, chớ để nhỏ giọt hoài **cá ở đâu cũng tới uống ké**!",
 "Trận mưa năm đó lớn dữ thần. Tui để cái lu ngoài sân, mưa vừa hứng đầy lu thì mấy giọt mưa sau nó… **đứng xếp hàng chờ tới lượt**. Sáng ra thấy còn mấy giọt đứng đợi, tui thương quá, đem thêm cái thau ra hứng giùm! 🌧️😆",
 "Nước máy nhà tui trong dữ lắm. Tui rót một ly để trên bàn, thằng cháu tưởng **ly không**, cầm lên úp xuống định rót trà… **ướt nguyên bộ đồ**! 🥛😂",
 "Tháng rồi hóa đơn tiền nước nhà tui thấp quá, tui tưởng nhân viên ghi lộn, chạy một mạch lên Đội cấp nước hỏi. Người ta mở sổ ra coi rồi cười: \"Dạ đúng rồi chú Tư, tại tháng rồi **chú đi ăn đám giỗ hết 25 ngày** đó chú!\" 🍲😂",
 "Bầy vịt nhà tui quen tắm nước máy rồi. Thả ra kênh nó **không chịu xuống**, đứng trên bờ kêu \"cạp cạp\", đợi tui đem **vòi sen** ra xịt mới chịu tắm! 🦆🚿",
 "Trưa tháng Tư trời nóng dữ lắm, tui mở vòi nước ngoài sân ra… nước chảy ra **ấm muốn pha trà luôn**! ☀️😅\n(Nói vậy chớ nước uống thì bà con nhớ **đun sôi** đàng hoàng nghen!)",
 "Cái đồng hồ nước nhà tui nhạy dữ lắm: **con kiến đi ngang vòi nước**, nó cũng nhích thêm một chút! 🐜😂\n(Còn nếu bà con thấy đồng hồ chạy lạ thiệt, cứ làm đơn **kiểm định đồng hồ** ở Đội cấp nước nghen.)",
 "Hồi đó tui súc bồn nước kỹ tới nỗi trong bồn **sáng bóng như gương**. Con muỗi bay vô, soi thấy mặt mình ốm nhom, **mắc cỡ quá bay đi mất**! 🦟😆\n(Mà muỗi mắc cỡ thì mắc cỡ, bồn vẫn phải **đậy nắp kín** nghen bà con!)",
 "Năm đó nắng hạn dữ thần, con rô đồng nhà tui khát nước quá, nó **leo lên bờ đi bộ** một mạch ra tới trạm cấp nước, đứng xếp hàng sau lưng tui chờ mua nước! 🐟😂\n(Giờ thì khỏi lo rồi, nước máy về tận nhà, bà con chỉ cần **đăng ký lắp đặt** là xong!)",
 "Tui có cái lu da bò hồi xưa to lắm. Bữa thằng Út nhảy vô lu tắm, lặn một hơi… **ba ngày sau mới trồi lên** ở ao sau nhà! 🏺😆",
 "Cái vòi nước nhà tui mạnh dữ lắm. Sáng tui mở ra tưới rau, tia nước bắn qua **ba cái vườn**, tưới luôn rau nhà ông Sáu, ông Bảy. Cuối tháng hai ổng đem **bầu, bí qua cám ơn** chất đầy sân! 🥒😂",
 "Hồi tui còn trẻ, mùa nước nổi bơi xuồng đi chợ. Nước lên mau quá, tui **cột xuồng vô ngọn cây dừa**. Chiều nước rút, quay ra thấy chiếc xuồng **treo lủng lẳng trên đọt dừa**, phải kêu thằng Út trèo lên mở dây! 🌴🛶😂",
 "Bà xã tui nấu canh chua bằng nước máy, ngọt quá trời. Con cá lóc trong nồi ngửi mùi thơm, nó **nhảy ra khỏi nồi**, lội ra lu nước… **xin thêm nước** để nấu nồi nữa! 🍲🐟😆",
 "Cây ổi sau nhà tui tưới nước máy sạch quá, trái ra **bự cỡ trái bưởi**. Bữa tui hái một trái, chở bằng **xe cút kít** mới về tới nhà! 🍐😂",
 "Đêm đó tui mơ thấy cái đồng hồ nước biết nói. Nó nói: \"Chú Tư ơi, chú **khóa vòi** giùm con đi, con chạy cả đêm mỏi chân quá!\" Sáng ra tui chạy ra coi, ai dè vòi ngoài sân **quên khóa thiệt**! ⏰😂\n(Bà con nhớ khóa vòi kỹ trước khi ngủ nghen!)",
 "Tui nuôi con chó Vện khôn dữ lắm. Thấy chỗ ống nước bị xì, nó **ngồi canh, sủa ba tiếng** rồi chạy vô kéo áo tui. Tui gọi **1900 9114**, người ta tới sửa xong, nó còn **vẫy đuôi cám ơn** nữa! 🐕📞",
 "Mùa khô năm đó con cò ở đồng không có nước uống, nó bay vô sân nhà tui, đứng **một chân** bên cái vòi nước, mỏ gõ \"cốc cốc\" vô vòi như **gõ cửa xin nước**. Tui mở cho nó một chén, nó uống xong còn **cúi đầu chào**! 🦩😄",
 "Thằng cháu tui ở thành phố về chơi, thấy nước máy quê mình trong quá, nó nói: \"Ông Tư ơi, nước này **trong tới nỗi con thấy cả… hóa đơn tháng sau**!\" Tui cười muốn sặc! 💧📄😂",
 "Hồi đó tui đào cái giếng sâu dữ lắm. Thả gàu xuống, tui đi nấu nồi cơm, ăn xong, ngủ một giấc trưa, dậy kéo lên **gàu mới chạm nước**! 🪣😂\n(Giờ có nước máy rồi, **vặn vòi là có** liền, khỏi đào giếng cực khổ!)",
 "Con trâu nhà tui quen tắm vòi sen nước máy rồi. Bữa cúp nước bảo trì có một buổi, nó **nằm lì trong chuồng**, rống \"ọ ọ\" giận tui cả buổi. Tới chiều có nước lại, nó **chạy ra đứng chờ sẵn** dưới vòi! 🐃🚿😆\n(Lịch cúp nước có thông báo trước trên website, bà con nhớ coi để trữ nước nghen!)",
 "Bữa đó trời mưa to quá, con ếch ngoài ruộng nhảy vô nhà tui trú mưa. Thấy tui đang **đóng tiền nước qua điện thoại**, nó ngồi coi chăm chú, rồi kêu \"ộp ộp\" như muốn nói: **\"Lẹ quá ha chú Tư!\"** 🐸📱😂",
 "Hồi mới lắp đồng hồ nước, tui sợ nó chạy sai, đêm nào cũng **ôm gối ra ngủ kế bên canh**. Canh hoài tới một tháng, đồng hồ chạy đúng boong, còn tui thì **bị muỗi chích sưng mặt**! 🦟😆\n(Đồng hồ nước đều được **kiểm định** đàng hoàng, bà con yên tâm nghen!)",
 "Ông Sáu xóm trên khoe nhà ổng xài nước tiết kiệm nhứt xóm: **rửa rau xong lấy nước tưới cây, tưới cây xong… cây nó trả lại trái**! Tui nghe xong cũng làm theo, tháng đó hóa đơn giảm thấy rõ! 🌱💧😄",
 "Ông bạn tui khoe ống nước nhà ổng dài lắm, **sáng mở vòi thì chiều nước mới tới**. Tui nói vậy là ống bị xì đâu đó rồi, kêu ổng gọi **1900 9114** cho người ta tới dò. Ổng gọi xong, nước tới liền trong một phút! 📞💧",
 "Hồi đó tui dán thử cái tem QR lên con trâu nhà tui. Ai dè bữa nó đi lạc qua xóm bên, người ta **quét tem** cái biết liền trâu của chú Tư, dắt về trả tận nhà! 🐃📱😂\n(Tài sản của Công ty cũng vậy: có tem QR là **tìm ra chủ** liền nghen!)",
 "Cái máy bơm ở trạm tui chạy bền dữ lắm. Bảo dưỡng đúng hẹn hoài, tới hồi **hết khấu hao** rồi mà nó vẫn chạy ro ro, kế toán nhìn sổ cứ tưởng **máy ma**! 👻😂\n(Bảo dưỡng đúng hạn thì tài sản bền lâu nghen bà con!)",
 "Năm đó kiểm kê, tui quét tem lẹ dữ lắm: tay phải quét, tay trái chỉ, **quét xong cả trạm trong một hơi thuốc**. Ông trưởng đội coi đồng hồ, tưởng cái điện thoại tui **bị hư** vì chạy nhanh quá! 📱💨😆"
];
const BOT_RIDDLES=[
 {q:"Cái gì **càng rửa càng bẩn**?",a:["nuoc"],ans:"**Nước** ạ! Rửa xong thì nước bẩn, còn đồ thì sạch 😄"},
 {q:"**Đồng hồ** gì không bao giờ chỉ giờ?",a:["dong ho nuoc","nuoc"],ans:"**Đồng hồ nước** ạ! Nó chỉ đếm số khối nước thôi 💧"},
 {q:"Cái gì **không có chân** mà vẫn chạy khắp nhà, đến tận từng vòi?",a:["nuoc","nuoc may","dong nuoc"],ans:"**Nước máy** chạy trong đường ống ạ! 🚰"},
 {q:"Từ trên trời **rơi xuống không đau**, tưới cây, tắm phố, đi đâu cũng thấy. Là gì?",a:["mua","nuoc mua"],ans:"**Mưa** ạ! Nước mưa cũng nên hứng lại để tưới cây cho tiết kiệm nhé 🌧️"},
 {q:"**Nước** gì không uống được?",a:["nuoc ngoai","dat nuoc","nuoc mat","nuoc co","nuoc di","nuoc son","nuoc hoa","nuoc mam","nuoc viet"],ans:"Có nhiều đáp án lắm: **đất nước, nước ngoài, nước cờ, nước sơn, nước hoa**… 😄"},
 {q:"Cái gì **đầy mà vẫn nhẹ tênh**, càng thổi càng to?",a:["bong bong","bong bay","qua bong","bong xa phong"],ans:"**Bong bóng** ạ! 🎈"},
 {q:"**Vòi** gì không bao giờ chảy ra nước?",a:["voi voi","voi con voi","con voi"],ans:"**Vòi con voi** ạ! 🐘 Còn vòi nước nhà mình thì nhớ khóa kỹ cho khỏi rò rỉ nhé!"},
 {q:"Đồng hồ nước đếm lượng nước theo **đơn vị** gì?",a:["khoi","met khoi","m3","m khoi"],ans:"**Mét khối (m³)** ạ! 1 m³ = 1.000 lít nước 💧"},
 {q:"Cái gì **đầy lỗ** mà vẫn giữ được nước?",a:["bot bien","mieng bot bien","mut","mieng mut","khan","cai khan"],ans:"**Miếng bọt biển** ạ! 🧽"},
 {q:"Cái gì **của bạn** nhưng người khác dùng nhiều hơn bạn?",a:["ten","cai ten","ten minh","ho ten"],ans:"**Cái tên** của mình ạ! 😄"},
 {q:"Cái gì **có răng** mà không có miệng?",a:["luoc","cai luoc","cua","cai cua","rang cua"],ans:"**Cái lược** (hoặc cái cưa) ạ! 😄"},
 {q:"Cái gì **có cổ** mà không có đầu?",a:["ao","cai ao","chai","cai chai"],ans:"**Cái áo** (hoặc cái chai) ạ! 👕"},
 {q:"Cái gì **có chân** mà không biết đi?",a:["ban","ghe","cai ban","cai ghe","giuong","cai giuong"],ans:"**Cái bàn, cái ghế** ạ! 🪑"},
 {q:"Cái gì **luôn đi tới** mà không bao giờ tới?",a:["ngay mai"],ans:"**Ngày mai** ạ! ⏳"},
 {q:"Cái gì **càng lấy đi** thì càng to?",a:["ho","cai ho","lo","cai lo","lo hong"],ans:"**Cái hố (cái lỗ)** ạ! 🕳️"},
 {q:"Tháng nào trong năm có **28 ngày**?",a:["tat ca","thang nao cung","moi thang","ca 12 thang","12 thang"],ans:"**Tháng nào cũng có 28 ngày** ạ! 😄"},
 {q:"Con gì **mang cả cái nhà** đi khắp nơi?",a:["oc","con oc","rua","con rua","oc sen","con oc sen"],ans:"**Con ốc sên** (hoặc con rùa) ạ! 🐌"},
 {q:"Hai anh em **ở hai bên**, suốt đời không nhìn thấy mặt nhau. Là gì?",a:["tai","hai tai","cai tai","lo tai","mat","hai mat","con mat","hai con mat"],ans:"**Hai cái tai** ạ! 👂"},
 {q:"Con gì **đập thì sống**, không đập thì chết?",a:["tim","con tim","trai tim","tim nguoi"],ans:"**Trái tim** ạ! ❤️"},
 {q:"**Nước** gì lúc nào cũng **thơm**?",a:["nuoc hoa"],ans:"**Nước hoa** ạ! 🌸"},
 {q:"Cái gì **trắng như bông**, bay trên trời rồi rơi xuống thành nước?",a:["may","dam may","may troi"],ans:"**Đám mây** ạ! ☁️ Mây gặp lạnh thành mưa đó!"},
 {q:"Cái gì **càng cho đi** lại càng nhiều?",a:["nu cuoi","kien thuc","niem vui","tinh yeu","tieng cuoi"],ans:"**Nụ cười, niềm vui và kiến thức** ạ! 😊"},
 {q:"Cái gì **đen khi mua**, đỏ khi dùng, xám khi bỏ đi?",a:["than","cuc than","than cui"],ans:"**Cục than** ạ! 🔥"},
 {q:"Nước sạch được đưa về nhà anh/chị bằng **cái gì**?",a:["ong","ong nuoc","duong ong","ong dan","ong dan nuoc"],ans:"**Đường ống cấp nước** ạ! 🚰 Thấy ống bể, rò rỉ thì báo ngay **1900 9114** nhé!"},
 {q:"Cái gì **không có chân** mà leo được lên tận bồn nước trên mái nhà?",a:["nuoc","nuoc may","may bom","bom","may bom nuoc"],ans:"**Nước** nhờ **máy bơm** đẩy lên ạ! 💪💧"},
 {q:"Cái gì **ướt khi đang lau khô**?",a:["khan","cai khan","khan tam","khan lau"],ans:"**Cái khăn** ạ! 🧻"},
 {q:"Cái gì **vuông vức, ô đen ô trắng**, dán lên máy là biết hết lý lịch?",a:["ma qr","qr","tem qr","tem","ma vach","tem ma qr"],ans:"**Tem mã QR** ạ! 🏷️ Quét là ra ngay thông tin, ảnh, lịch sử tài sản."},
 {q:"Mỗi năm một lần, cả Công ty đi **đếm đồ đạc** của mình. Là việc gì?",a:["kiem ke","kiem ke tai san","di kiem ke"],ans:"**Kiểm kê tài sản** ạ! 📋 Giờ chỉ cần quét tem QR là ghi nhận xong."},
 {q:"Cái gì **càng ngày càng giảm** trên sổ sách, dù tài sản vẫn chạy tốt?",a:["gia tri con lai","gia tri","khau hao"],ans:"**Giá trị còn lại** ạ! 🧮 (vì khấu hao hằng năm)"},
 {q:"Tài sản **chuyển từ đội này sang đội khác** thì làm phiếu gì?",a:["dieu chuyen","phieu dieu chuyen","bien ban giao nhan","giao nhan"],ans:"**Phiếu điều chuyển** (kèm biên bản giao nhận) ạ! 🚚"},
];
// Xoay vòng: phát hết danh sách (không trùng) rồi mới lặp lại; nhớ trong trình duyệt để lần ghé sau vẫn tiếp tục vòng cũ
const BOT_DONE=(()=>{let o={};try{o=JSON.parse(localStorage.getItem("qltsBotDone")||"{}")||{}}catch(e){}return o})();
function botPick(list,key){let used=BOT_DONE[key];if(!Array.isArray(used))used=BOT_DONE[key]=[];
  for(let k=used.length-1;k>=0;k--)if(!(used[k]>=0&&used[k]<list.length))used.splice(k,1);
  let free=list.map((_,i)=>i).filter(i=>!used.includes(i));
  if(!free.length){const last=used[used.length-1];used.length=0;free=list.map((_,i)=>i).filter(i=>list.length<2||i!==last)}   // hết vòng: bắt đầu vòng mới, tránh lặp ngay câu vừa nói
  const i=free[Math.floor(Math.random()*free.length)];used.push(i);try{localStorage.setItem("qltsBotDone",JSON.stringify(BOT_DONE))}catch(e){}return i}
function botPickItem(list,key){return list[botPick(list,key)]}
function botTellJoke(kind){const bp=kind==="baphi";const L=bp?BOT_BAPHI:BOT_JOKES,i=botPick(L,bp?"baphi":"jokes");const j=bp?"🗣️ **Chuyện kể kiểu Bác Ba Phi** – chú Tư Hậu Giang kể:\n"+L[i]:L[i];botGesture("nod",900,bp?"🗣️":"😄");
  const d=botAdd("b",j,{silent:true,chips:[bp?["🗣️ Kể thêm chuyện Bác Ba Phi","chuyện bác ba phi"]:["😄 Kể thêm chuyện","kể thêm chuyện vui"],bp?["😄 Chuyện vui khác","kể chuyện vui"]:["🗣️ Chuyện kiểu Bác Ba Phi","chuyện bác ba phi"],["🧩 Đố vui","đố vui"]]});
  // đọc xong câu chuyện -> cả "khán phòng" cười đồng thanh
  const after=()=>botLaugh(d);
  if(BOT_TTS.isOn())BOT_TTS.sayThen(j,ok=>ok?setTimeout(after,200):setTimeout(after,Math.min(6000,1200+j.length*14)));
  else setTimeout(after,Math.min(6000,1200+j.length*14));
  return d}
// ---- Tiếng cười đồng thanh (tổng hợp ngay trong trình duyệt bằng Web Audio, không cần tệp âm thanh) + hiệu ứng
let BOT_ACX=null;
function botAudioCtx(){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;if(!BOT_ACX)try{BOT_ACX=new AC()}catch(e){return null}if(BOT_ACX.state==="suspended")BOT_ACX.resume();return BOT_ACX}
["pointerdown","keydown","touchstart"].forEach(ev=>addEventListener(ev,()=>{if(BOT_ACX&&BOT_ACX.state==="suspended")BOT_ACX.resume()},{passive:true}));
function botLaughSound(){
  const ctx=botAudioCtx();if(!ctx)return 0;const t0=ctx.currentTime+0.05,master=ctx.createGain();master.gain.value=0.9;master.connect(ctx.destination);
  const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  let end=0;const voices=6;
  for(let v=0;v<voices;v++){                                   // 6 giọng cười lệch nhau một chút: nghe như nhiều người cười cùng lúc
    const base=v<3?150+Math.random()*90:260+Math.random()*120,n=5+Math.floor(Math.random()*4),syl=0.13+Math.random()*0.05,gap=0.05+Math.random()*0.04;
    let t=t0+Math.random()*0.35;const pan=ctx.createStereoPanner?ctx.createStereoPanner():null;if(pan){pan.pan.value=Math.random()*1.4-0.7;pan.connect(master)}
    const out=pan||master;
    for(let k=0;k<n;k++){const f=base*(1.18-k*0.035)*(0.95+Math.random()*0.1),amp=(k===0?0.75:1)*(1-k/(n*1.6));
      // nguyên âm "a": dao động răng cưa qua 2 bộ lọc formant
      const o=ctx.createOscillator();o.type="sawtooth";o.frequency.setValueAtTime(f*1.08,t);o.frequency.exponentialRampToValueAtTime(f*0.9,t+syl);
      const f1=ctx.createBiquadFilter();f1.type="bandpass";f1.frequency.value=800;f1.Q.value=6;const f2=ctx.createBiquadFilter();f2.type="bandpass";f2.frequency.value=1250;f2.Q.value=7;
      const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.5*amp,t+0.03);g.gain.exponentialRampToValueAtTime(0.0001,t+syl);
      o.connect(f1);o.connect(f2);f1.connect(g);f2.connect(g);g.connect(out);o.start(t);o.stop(t+syl+0.02);
      // hơi thở "h" đầu mỗi tiếng
      const ns=ctx.createBufferSource();ns.buffer=nb;const hf=ctx.createBiquadFilter();hf.type="highpass";hf.frequency.value=1500;const hg=ctx.createGain();
      hg.gain.setValueAtTime(0.0001,t-0.02);hg.gain.linearRampToValueAtTime(0.22*amp,t);hg.gain.exponentialRampToValueAtTime(0.0001,t+0.06);
      ns.connect(hf);hf.connect(hg);hg.connect(out);ns.start(t-0.02,Math.random()*1.5,0.1);
      t+=syl+gap}
    end=Math.max(end,t)}
  return Math.round((end-ctx.currentTime)*1000)}
function botLaugh(d){
  const sound=BOT_TTS.isOn()?botLaughSound():0;
  botGesture("belly",Math.max(2400,sound+300),"🤣");botFace("laugh",Math.max(2600,sound+500));
  // biểu tượng cười bay lên trong khung chat
  const box=document.getElementById("botMsgs");if(box&&!matchMedia("(prefers-reduced-motion: reduce)").matches){const wrap=document.createElement("div");wrap.className="bot-laugh";wrap.setAttribute("aria-hidden","true");
    const E=["😂","🤣","😆","😄","😁","😹"];for(let i=0;i<9;i++){const e=document.createElement("span");e.textContent=E[i%E.length];e.style.left=(5+Math.random()*85)+"%";e.style.animationDelay=(Math.random()*0.6)+"s";e.style.fontSize=(20+Math.random()*16)+"px";wrap.appendChild(e)}
    const t=document.createElement("b");t.textContent="Ha ha ha!";wrap.appendChild(t);
    document.getElementById("botPanel").appendChild(wrap);setTimeout(()=>wrap.remove(),2600)}
  const say=document.getElementById("botSay"),b=document.getElementById("botBtn");if(say&&b&&!b.classList.contains("on")){say.textContent="Ha ha ha! 🤣";say.classList.add("show");setTimeout(()=>say.classList.remove("show"),2200)}}
// ---- Tiếng vỗ tay (Web Audio: nhiều tiếng "bốp" ngắn của tiếng ồn qua bộ lọc) + pháo giấy, robot vỗ tay
function botClapSound(){
  const ctx=botAudioCtx();if(!ctx)return 0;const t0=ctx.currentTime+0.03,dur=2.4,master=ctx.createGain();master.gain.value=1.1;master.connect(ctx.destination);
  const nb=ctx.createBuffer(1,ctx.sampleRate*0.5,ctx.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const people=9;
  for(let p=0;p<people;p++){                                   // 9 "người" vỗ tay, mỗi người một nhịp và âm sắc riêng
    const rate=0.17+Math.random()*0.09,fq=900+Math.random()*1400,pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
    if(pan){pan.pan.value=Math.random()*1.6-0.8;pan.connect(master)}const out=pan||master;
    for(let t=t0+Math.random()*0.25;t<t0+dur;t+=rate*(0.9+Math.random()*0.2)){
      const fade=t>t0+dur-0.7?(t0+dur-t)/0.7:1,amp=(0.35+Math.random()*0.25)*fade;
      const s=ctx.createBufferSource();s.buffer=nb;const f=ctx.createBiquadFilter();f.type="bandpass";f.frequency.value=fq*(0.9+Math.random()*0.2);f.Q.value=1.2;
      const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(amp,t+0.002);g.gain.exponentialRampToValueAtTime(0.0001,t+0.045+Math.random()*0.03);
      s.connect(f);f.connect(g);g.connect(out);s.start(t,Math.random()*0.4,0.09)}}
  // tiếng reo "Hoan hô" nhẹ phía sau: tiếng ồn lọc dải giọng người
  const cr=ctx.createBufferSource();cr.buffer=nb;cr.loop=true;const cf=ctx.createBiquadFilter();cf.type="bandpass";cf.frequency.value=700;cf.Q.value=0.8;const cg=ctx.createGain();
  cg.gain.setValueAtTime(0.0001,t0);cg.gain.linearRampToValueAtTime(0.07,t0+0.3);cg.gain.linearRampToValueAtTime(0.0001,t0+dur);cr.connect(cf);cf.connect(cg);cg.connect(master);cr.start(t0);cr.stop(t0+dur+0.05);
  return Math.round(dur*1000)}
function botClap(){
  const sound=BOT_TTS.isOn()?botClapSound():0;
  botGesture("clap",Math.max(2400,sound),"👏");botFace("laugh",Math.max(2400,sound));
  const pan=document.getElementById("botPanel");if(pan&&!matchMedia("(prefers-reduced-motion: reduce)").matches){const wrap=document.createElement("div");wrap.className="bot-laugh bot-clap";wrap.setAttribute("aria-hidden","true");
    const C=["#ff3b5c","#ffb300","#2ec4b6","#3a86ff","#8338ec","#06d6a0","#ff7a00"];
    for(let i=0;i<34;i++){const c=document.createElement("i");c.style.left=(Math.random()*100)+"%";c.style.background=C[i%C.length];c.style.animationDelay=(Math.random()*0.7)+"s";c.style.animationDuration=(1.6+Math.random()*1.1)+"s";c.style.setProperty("--r",(Math.random()*720-360)+"deg");c.style.setProperty("--x",(Math.random()*80-40)+"px");if(i%3===0)c.style.borderRadius="50%";wrap.appendChild(c)}
    const E=["👏","👏","🎉","👏","⭐","👏"];for(let i=0;i<8;i++){const e=document.createElement("span");e.textContent=E[i%E.length];e.style.left=(5+Math.random()*85)+"%";e.style.animationDelay=(Math.random()*0.6)+"s";e.style.fontSize=(22+Math.random()*16)+"px";wrap.appendChild(e)}
    const t=document.createElement("b");t.textContent="Hoan hô! 👏";wrap.appendChild(t);pan.appendChild(wrap);setTimeout(()=>wrap.remove(),3000)}
  const say=document.getElementById("botSay"),b=document.getElementById("botBtn");if(say&&b&&!b.classList.contains("on")){say.textContent="Hoan hô! 👏";say.classList.add("show");setTimeout(()=>say.classList.remove("show"),2200)}}
// ---- Nhảy hip hop: nhạc boom-bap tổng hợp bằng Web Audio (trống, hi-hat, bass) + robot đeo kính đen nhảy theo nhịp
const BOT_BPM=96;
function botHipHopBeat(bn){
  const ctx=botAudioCtx();if(!ctx)return 0;const st=60/BOT_BPM/4,bars=4,t0=ctx.currentTime+0.06,master=ctx.createGain();master.gain.value=0.85;master.connect(ctx.destination);
  const nb=ctx.createBuffer(1,ctx.sampleRate*0.5,ctx.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const noise=(t,len,type,freq,amp)=>{const s=ctx.createBufferSource();s.buffer=nb;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;const g=ctx.createGain();g.gain.setValueAtTime(amp,t);g.gain.exponentialRampToValueAtTime(0.0001,t+len);s.connect(f);f.connect(g);g.connect(master);s.start(t,Math.random()*0.3,len+0.02)};
  const kick=t=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(42,t+0.18);g.gain.setValueAtTime(1,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.35);o.connect(g);g.connect(master);o.start(t);o.stop(t+0.4)};
  const snare=t=>{noise(t,0.18,"highpass",1400,0.55);const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";o.frequency.value=190;g.gain.setValueAtTime(0.35,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.1);o.connect(g);g.connect(master);o.start(t);o.stop(t+0.12)};
  const bass=(t,f,len)=>{const o=ctx.createOscillator(),lp=ctx.createBiquadFilter(),g=ctx.createGain();o.type="sawtooth";o.frequency.value=f;lp.type="lowpass";lp.frequency.value=420;g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.32,t+0.01);g.gain.setValueAtTime(0.32,t+len*0.7);g.gain.exponentialRampToValueAtTime(0.0001,t+len);o.connect(lp);lp.connect(g);g.connect(master);o.start(t);o.stop(t+len+0.02)};
  const stab=(t,fs)=>fs.forEach(f=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="square";o.frequency.value=f;g.gain.setValueAtTime(0.045,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);o.connect(g);g.connect(master);o.start(t);o.stop(t+0.25)});
  const N=bn||[55,65.4,73.4,82.4],K=[0,7,10],S=[4,12],B=[[0,N[0],3],[3,N[0],2],[6,N[1],3],[10,N[2],2],[12,N[3],3]];
  for(let bar=0;bar<bars;bar++){const tb=t0+bar*16*st;
    K.forEach(k=>kick(tb+k*st));if(bar%2)kick(tb+15*st);S.forEach(k=>snare(tb+k*st));
    for(let h=0;h<16;h+=2)noise(tb+h*st+(h%4?0.012:0),h%4?0.03:0.05,"highpass",7000,h%4?0.12:0.2);
    B.forEach(([k,f,l])=>bass(tb+k*st,bar===3&&k>=10?f*1.122:f,l*st));
    const r=N[0]*4;if(bar%2===0)stab(tb+8*st,[r,r*1.189,r*1.498]);else stab(tb+2*st,[r*0.891,r*1.122,r*1.335])}
  kick(t0+bars*16*st);noise(t0+bars*16*st,0.6,"highpass",3000,0.25);    // kết thúc bằng tiếng chũm chọe
  return Math.round((bars*16*st+0.6)*1000)}
const BOT_HH=[
 {id:"toprock",n:"Toprock",ico:"🕺",d:"bước chân sang hai bên, tay đẩy lên trời, khoanh tay cực ngầu",bass:[55,65.4,73.4,82.4]},
 {id:"headspin",n:"Headspin – trồng chuối xoay đầu",ico:"🤸",d:"lộn ngược người, chống đầu xoay vòng vòng",bass:[49,58.3,65.4,73.4]},
 {id:"headroll",n:"Xoay đầu robot",ico:"🤖",d:"cái đầu xoay tròn 360 độ, chỉ robot mới làm được",bass:[61.7,73.4,82.4,92.5]},
 {id:"running",n:"Running Man – chạy bộ tại chỗ",ico:"🏃",d:"nhấc gối, kéo chân như chạy mà không đi đâu hết",bass:[55,61.7,73.4,82.4]},
 {id:"footwork",n:"Footwork – quay chân",ico:"🦵",d:"nghiêng người, quay chân vòng vòng sát đất",bass:[46.2,55,61.7,69.3]},
 {id:"popping",n:"Popping – điệu robot giật",ico:"⚡",d:"giật từng nhịp, tay chân gập vuông góc như máy",bass:[65.4,77.8,87.3,98]},
 {id:"moonwalk",n:"Moonwalk – đi lùi trên mặt trăng",ico:"🌙",d:"lướt lùi êm ru, chân thay nhau trượt",bass:[51.9,61.7,69.3,77.8]},
 {id:"wave",n:"Wave – sóng nước",ico:"🌊",d:"làn sóng chạy từ tay này qua tay kia, như dòng nước chảy",bass:[58.3,69.3,77.8,87.3]}
];
const BOT_HH_LINES=["Nước sạch mỗi ngày – năng lượng tràn đầy! 💧","Quét tem QR nhanh như nhảy hip hop – tít một cái là xong! 🏷️","Kiểm kê theo nhịp: quét, bíp, qua tem tiếp theo! 📋","Vặn vòi là có nước, Hawasuco luôn bên anh/chị! 🚰","Nhảy xong nhớ uống ly nước mát nha anh/chị! 🥤","Tiết kiệm nước là tiết kiệm tiền, nhảy cũng phải tiết kiệm sức nha! 😄","Mỗi giọt nước sạch là một nhịp vui! 🎶","Yo! Đóng tiền nước online lẹ như nhảy hip hop! 📱","Check it out – nước trong, nhà sạch, cả nhà vui! ✨","Nhảy đẹp hông anh/chị? Cho em xin một tràng pháo tay nha! 👏"];
function botHipHop(){
  const st=BOT_HH[botPick(BOT_HH,"dance")];
  const sound=BOT_TTS.isOn()?botHipHopBeat(st.bass):0,ms=sound||Math.round(4*4*60/BOT_BPM*1000);
  const b=document.getElementById("botBtn");if(b){if(/^(clap|belly|hiphop)$/.test(b.dataset.g||""))b.removeAttribute("data-g");b.dataset.hh=st.id}
  botGesture("hiphop",ms,st.ico);
  const pan=document.getElementById("botPanel");if(pan&&!matchMedia("(prefers-reduced-motion: reduce)").matches){const wrap=document.createElement("div");wrap.className="bot-laugh bot-hiphop";wrap.setAttribute("aria-hidden","true");
    const E=["🎵","🎶","🎧",st.ico,"🔥","🎤","✨"];for(let i=0;i<14;i++){const e=document.createElement("span");e.textContent=E[i%E.length];e.style.left=(4+Math.random()*88)+"%";e.style.animationDelay=(Math.random()*Math.max(1,ms/1000-2.2))+"s";e.style.fontSize=(20+Math.random()*14)+"px";wrap.appendChild(e)}
    const t=document.createElement("b");t.textContent="Yo! "+st.ico;wrap.appendChild(t);pan.appendChild(wrap);setTimeout(()=>wrap.remove(),ms+400)}
  const say=document.getElementById("botSay");if(say&&b&&!b.classList.contains("on")){say.textContent=st.ico+" "+st.n.split(" – ")[0]+"!";say.classList.add("show");setTimeout(()=>say.classList.remove("show"),2500)}
  return botAdd("b",`🎧 **Yo! Nhạc lên nào!** Điệu **${st.n}** ${st.ico}\nTrợ lý ảo Hawasuco ${st.d}!\n${botPickItem(BOT_HH_LINES,"hhline")}`,{silent:true,chips:[["🕺 Nhảy điệu khác","nhảy hip hop"],["😄 Kể chuyện vui","kể chuyện vui"],["🧩 Đố vui","đố vui"]]})}
function botAskRiddle(){const i=botPick(BOT_RIDDLES,"riddles");BOT.state={riddle:{i,tries:0}};botGesture("nod",900,"🧩");botFace("wink",1500);
  return botAdd("b","🧩 **Đố vui:** "+BOT_RIDDLES[i].q+"\nAnh/chị đoán thử nhé! (gõ \"chịu\" để xem đáp án)",{chips:[["Chịu, xem đáp án","chịu"]]})}
function botRiddleAnswer(n,text){const st=BOT.state.riddle,r=BOT_RIDDLES[st.i];
  const chips={chips:[["🧩 Đố câu khác","đố vui"],["😄 Kể chuyện vui","kể chuyện vui"]]};
  if(r.a.some(a=>(" "+n+" ").includes(" "+a+" "))){BOT.state=null;const d=botAdd("b","🎉 **Chính xác!** anh/chị giỏi quá! "+r.ans,{...chips,silent:true});botClap();if(BOT_TTS.isOn())setTimeout(()=>BOT_TTS.say("Chính xác! Anh/chị giỏi quá! "+r.ans),1800);return d}
  if(/^(chiu|khong biet|dap an|dap an la gi|thua|bo cuoc|noi di|cho dap an)\b/.test(n)){BOT.state=null;botGesture("giggle",1300,"😄");return botAdd("b","Đáp án là: "+r.ans,chips)}
  if(n.split(" ").length>5){BOT.state=null;return null}       // khách chuyển sang hỏi việc khác
  st.tries++;if(st.tries>=2){BOT.state=null;botGesture("nod",900,"😉");return botAdd("b","Gần đúng rồi ạ! Đáp án là: "+r.ans,chips)}
  botFace("wink",1200);return botAdd("b","Chưa đúng rồi ạ 😉 Anh/chị đoán lại lần nữa nhé! (hoặc gõ \"chịu\")",{chips:[["Chịu, xem đáp án","chịu"]]})}
function botFun(n){
  if(n.length>80)return null;
  if(/\b(ba phi|noi doc|chuyen xao|chuyen doc|chuyen mien tay|chuyen dan gian|xao xao|chuyen tieu lam mien tay)\b/.test(n))return botTellJoke("baphi");
  if(/\b(ke|noi|cho nghe|ke them|them|mot)\b.*\b(chuyen (cuoi|vui|hai|tieu lam)|truyen cuoi|cau chuyen|chuyen)\b|\b(chuyen cuoi|chuyen vui|truyen cuoi|joke|hai huoc|lam toi cuoi|cho vui)\b/.test(n)&&!/\b(chuyen (khoan|nhuong|ten|dia chi|tien))\b/.test(n))return botTellJoke();
  if(/^(do vui|do meo|cau do|do ban|do em|choi do|do tiep|do cau khac)\b|\b(cho mot cau do|do vui di|choi do vui)\b/.test(n))return botAskRiddle();
  if(/\b(buon qua|chan qua|buon ghe|met qua|stress|cang thang|that vong)\b/.test(n)){botGesture("love",1600,"🤗");
    return botAdd("b","Ôi, anh/chị đừng buồn nhé 🤗 Uống một ly nước mát, hít thở sâu một chút… Hay để tôi kể một chuyện vui cho anh/chị cười nhé?",{chips:[["😄 Nghe chuyện vui","kể chuyện vui"],["🧩 Đố vui","đố vui"]]})}
  if(/\b(gioi qua|hay qua|thong minh qua|de thuong|cute|tuyet voi|xuat sac|qua dinh|gioi ghe)\b/.test(n)&&n.split(" ").length<=8){botGesture("nod",900,"😊");botFace("shy",2200);
    return botAdd("b","Hihi, cảm ơn anh/chị đã khen ạ 😊 Tôi sẽ cố gắng hơn nữa! Anh/chị cần hỏi gì thêm không ạ?")}
  if(/\b(ngu qua|ngu the|do qua|te qua|vo dung|kem qua|chan may|ngu ngoc|bot ngu)\b/.test(n)){botGesture("shake",900,"🙇");
    return botAdd("b","Xin lỗi anh/chị vì tôi chưa giúp được như mong muốn 🙇 Anh/chị có thể hỏi lại ngắn gọn hơn, hoặc **để lại lời nhắn** cho người quản trị phần mềm ạ.",{chips:[["✉️ Nhắn quản trị","để lại lời nhắn"]]})}
  if(/^(tam biet|bye|bai bai|hen gap lai|chao nhe|thoi chao|di day|ngu ngon)\b/.test(n)){botGesture("bye",1500,"👋");
    return botAdd("b","Tạm biệt anh/chị! Chúc anh/chị một ngày làm việc thật vui và hiệu quả nhé 👋💧")}
  if(/^(chao buoi (sang|trua|chieu|toi)|buoi (sang|toi) vui ve|good (morning|afternoon|evening))\b/.test(n)){const h=new Date().getHours();
    const said={sang:"buổi sáng",trua:"buổi trưa",chieu:"buổi chiều",toi:"buổi tối",morning:"buổi sáng",afternoon:"buổi chiều",evening:"buổi tối"}[(n.match(/(sang|trua|chieu|toi|morning|afternoon|evening)/)||[])[1]];const b=said||(h<11?"buổi sáng":h<13?"buổi trưa":h<18?"buổi chiều":"buổi tối");botGesture("wave",1500,"👋");
    return botAdd("b",`Chào ${b} anh/chị! Chúc anh/chị ${b} thật vui vẻ ☀️ Tôi có thể giúp gì ạ?`,{chips:BOT_CHIPS})}
  if(/\b(may gio roi|bay gio la may gio|hom nay (la )?ngay (may|bao nhieu)|hom nay thu (may|gi))\b/.test(n)){const d=new Date(),T=["Chủ nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"];
    return botAdd("b",`Bây giờ là **${d.getHours()} giờ ${String(d.getMinutes()).padStart(2,"0")}**, ${T[d.getDay()]} ngày **${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}** (theo đồng hồ máy của anh/chị) ⏰`)}
  if(/\b(thoi tiet|troi mua|co mua khong|nang khong|nhiet do)\b/.test(n)&&!/\b(cup nuoc|mat nuoc)\b/.test(n))
    return botAdd("b","Tôi chưa xem được thời tiết ạ ☁️ Nhưng dù nắng hay mưa, anh/chị nhớ **uống đủ nước** nhé! Trời mưa có thể hứng nước mưa để tưới cây, tiết kiệm nước sạch 🌧️🌱")
  if(/\b(nhay|hip ?hop|dance|break ?dance|nhun nhay|lac lu)\b/.test(n)&&!/\b(dong ho|so|chi so|tien|hoa don|nuoc|gia|cong to|bac|thang|thoi gian)\b/.test(n)&&n.split(" ").length<=10)return botHipHop();
  if(/\b(hat (di|mot bai|cho)|hat nghe|biet hat)\b/.test(n)){botGesture("dance",1800,"🎵");
    return botAdd("b","Tôi hát chưa hay lắm, sợ làm anh/chị… cúp tai mất 😅 Hay tôi kể chuyện vui thay nhé?",{chips:[["😄 Kể chuyện vui","kể chuyện vui"],["🧩 Đố vui","đố vui"]]})}
  if(/^(ok|oke|okay|uh|u|um|vang|da|duoc roi|hieu roi|ro roi|da biet|biet roi)( a| nhe| roi)?$/.test(n)){botGesture("nod",900);
    return botAdd("b","Dạ vâng ạ! Anh/chị cần hỏi thêm gì cứ nhắn cho tôi nhé 😊",{chips:BOT_CHIPS})}
  if(/^(haha+|hihi+|hehe+|kaka+|=\)+|:d)$/.test(n.replace(/\s/g,""))){botGesture("giggle",1300,"😆");
    return botAdd("b","Hihi, anh/chị vui là tôi vui rồi 😆 Nghe thêm một chuyện nữa không ạ?",{chips:[["😄 Kể thêm","kể thêm chuyện vui"],["🧩 Đố vui","đố vui"]]})}
  if(/^(xin loi|sorry|xl|toi xin loi|em xin loi)\b/.test(n)&&n.split(" ").length<=6){botGesture("nod",900,"😊");return botAdd("b","Dạ không sao đâu ạ 😊 Anh/chị cứ thoải mái hỏi nhé!")}
  if(/\b(an com chua|an gi chua|an sang chua|da an chua|doi bung khong)\b/.test(n)){botGesture("giggle",1300,"🔋");return botAdd("b","Hihi, tôi là robot nên không ăn cơm, chỉ cần **sạc điện** và… vài câu hỏi của anh/chị là no rồi ạ 😄 Còn anh/chị nhớ ăn uống đủ bữa, uống đủ nước nhé!")}
  if(/\b((ban|em) (dang )?lam gi|(ban|em) co ranh khong|(ban|em) ban khong)\b/.test(n)){botGesture("nod",900,"💻");return botAdd("b","Tôi đang **trực** để giúp anh/chị quản lý tài sản đây ạ 💻 Lúc nào cũng rảnh để giúp anh/chị!",{chips:BOT_CHIPS})}
  if(/\b((ban|em) (co )?(ngu|thuc) (chua|khuya|khong)|thuc khuya)\b/.test(n)){botGesture("nod",900,"🌙");return botAdd("b","Tôi trực **24/7** nên không cần ngủ ạ 🌙 Còn anh/chị khuya rồi thì nghỉ ngơi sớm cho khỏe nhé!")}
  if(/\b(co nho (toi|em|minh) khong|nho toi khong|biet toi (la ai|khong))\b/.test(n)){const t=tlNguoi();return botAdd("b",(t&&tlToken()?`Anh/chị đang đăng nhập với tên **${esc(t.hoTen||t.ten)}** (${esc(t.tenVaiTro||"")}) đó ạ 😊 `:"")+"Còn nội dung trò chuyện thì tôi không ghi nhớ giữa các lần mở phần mềm để bảo mật 🔒 Nhưng lần nào gặp tôi cũng vui như lần đầu!")}
  if(/\b(yeu (ban|em)|thich (ban|em)|thuong (ban|em)|(ban|em) dang yeu)\b/.test(n)){botGesture("love",1800,"💙");botFace("shy",2200);return botAdd("b","Ôi, tôi ngại quá 😳💙 Cảm ơn anh/chị nhiều! Tôi cũng rất quý các anh chị ở Hawasuco ạ.")}
  if(/\b(co don|(ban|em) co buon)\b/.test(n))return botAdd("b","Có anh/chị trò chuyện thì tôi không buồn chút nào ạ 😊 Anh/chị muốn nghe một chuyện vui không?",{chips:[["😄 Kể chuyện vui","kể chuyện vui"],["🧩 Đố vui","đố vui"]]})
  if(/\b(chuc mung nam moi|nam moi vui|an tet|chuc tet|happy new year)\b/.test(n)){botGesture("cheer",1800,"🧧");return botAdd("b","🧧 Chúc mừng năm mới! Chúc anh/chị và gia đình **an khang, thịnh vượng, vạn sự như ý** – và năm nào cũng có nước sạch đầy đủ ạ! 🎉")}
  if(/\b(cuoi tuan vui ve|chuc (mot )?ngay tot lanh|chuc (ban|em) (mot ngay )?vui|ngay moi vui ve|chuc suc khoe)\b/.test(n)){botGesture("love",1600,"🌸");return botAdd("b","Cảm ơn anh/chị! Tôi cũng chúc anh/chị **thật nhiều sức khỏe và niềm vui** ạ 🌸")}
  if(/\b(how are you|speak english|do you speak|can you speak|english please)\b/.test(n))return botAdd("b","Hello! I'm the **Hawasuco virtual assistant** 🤖 I help with the **asset management software** and mainly speak **Vietnamese**; for other help please contact the software administrator. Xin cảm ơn!")
  if(/^(giup (toi|em|minh)|help|cuu|ho tro (toi|em|minh)|toi can giup|can ho tro)( voi| di| a)?$/.test(n)){botGesture("nod",900,"🙋");return botAdd("b","Dạ, tôi sẵn sàng giúp anh/chị! Anh/chị cần hỏi về việc gì ạ? Có thể chọn nhanh một chủ đề bên dưới:",{chips:BOT_CHIPS})}
  if(/^((toi|em|minh) )?(khong|chua) hieu( lam)?( a)?$|\b(noi ro hon|giai thich lai|kho hieu qua)\b/.test(n))return botAdd("b","Xin lỗi anh/chị, tôi giải thích chưa rõ 🙏 Anh/chị cho tôi biết đang thắc mắc phần nào, hoặc **để lại lời nhắn** để người quản trị phần mềm hướng dẫn trực tiếp nhé.",{chips:[["✉️ Nhắn quản trị","để lại lời nhắn"]]})
  if(/^(test|thu|alo alo|kiem tra|co hoat dong khong|con song khong|co do khong)( a| nhe)?$/.test(n)){botGesture("cheer",1400,"✅");return botAdd("b","✅ Tôi vẫn hoạt động tốt ạ! Anh/chị cứ hỏi thử một câu nhé.",{chips:BOT_CHIPS})}
  if(/\b(nuoc (sach|ngon|tot) qua|dich vu tot|cong ty tot|nhan vien nhiet tinh|rat hai long|phan mem (hay|tot|de dung|tien|xin|qua dinh)( qua)?|tro ly (hay|gioi) qua)\b/.test(n)){botGesture("love",1800,"💙");return botAdd("b","Cảm ơn anh/chị nhiều 💙 Lời khen của anh/chị là động lực lớn cho những người làm phần mềm **Quản lý tài sản** và toàn thể Công ty **Hawasuco** ạ!")}
  if(/\b(loi khuyen|cau noi hay|dong vien|truyen cam hung|cham ngon)\b/.test(n)){const Q=["💧 \"Mỗi giọt nước tiết kiệm hôm nay là một dòng nước sạch cho ngày mai.\"","🌱 \"Nước sạch không tự nhiên mà có – hãy dùng nước như dùng tiền của chính mình.\"","☀️ \"Một ngày tốt lành bắt đầu bằng một ly nước mát và một nụ cười.\"","🌊 \"Như dòng nước, cứ kiên trì chảy thì đá cứng cũng mòn.\"","🏷️ \"Tài sản có tem, có ảnh, có lịch sử – quản lý nhẹ như quét một cái.\"","🛠️ \"Bảo dưỡng hôm nay là bớt sửa chữa ngày mai.\""];
    botGesture("nod",900,"✨");return botAdd("b",botPickItem(Q,"quote")+"\nChúc anh/chị một ngày thật nhiều năng lượng!")}
  if(/\b(nau an|cong thuc nau|bong da|ket qua xo so|xo so|chung khoan|tien ao|bitcoin|lam bai tap|giai bai|viet van|boi bai|tu vi|phim hay|choi game)\b/.test(n))
    return botAdd("b","Xin lỗi anh/chị, tôi chỉ được **cập nhật kiến thức về phần mềm Quản lý tài sản** và Công ty Hawasuco nên chưa trả lời được câu hỏi này ạ 🙏 Anh/chị cần tìm tài sản, xem tổng quan, kiểm kê, in tem… thì tôi luôn sẵn sàng!",{chips:BOT_CHIPS})
  return null}
// ---- Trợ lý ảo Hawasuco trả lời câu hỏi về bản thân (n: câu hỏi đã bỏ dấu, viết thường)
const BOT_ME="Trợ lý ảo Hawasuco";
const BOT_SELF=[
 [/\b(ban|em|tro ly ao|tro ly|bot) (ten (gi|la gi)|ten la|la ai|la gi( vay| the| day)?$)|\bten (cua )?(ban|em|tro ly)\b|\bgoi (ban|em) la gi\b|^(ai day|ai do|ban la ai|em la ai)\b/,
  ()=>`Tôi là **${BOT_ME}** 🤖 – trợ lý tự động trong phần mềm **Quản lý tài sản**${BOT.congTy?" của **"+tlSach(BOT.congTy)+"**":""} (hệ thống Công ty Cổ phần Cấp thoát nước - Công trình đô thị Hậu Giang – HAWASUCO).\nTôi trực **24/7** để giúp anh/chị tìm tài sản, xem tổng quan, tài sản hỏng, đến hạn bảo dưỡng, tiến độ kiểm kê, khấu hao, hướng dẫn quét / in tem QR, điều chuyển, thanh lý… Anh/chị cần gì ạ?`,"wave","👋",1],
 [/\b(ai (tao|lam|viet|phat trien|thiet ke|lap trinh) ra|ai (tao|lam) (ban|em)|(ban|em) (cua|thuoc) ai|ai so huu|(ban|em) do ai)\b/,
  ()=>`**${BOT_ME}** do **Công ty HAWASUCO** xây dựng: có mặt trên website của Công ty và trong phần mềm **Quản lý tài sản**. Kiến thức tôi trả lời lấy từ hướng dẫn sử dụng phần mềm; số liệu tài sản tôi đọc trực tiếp trên máy chủ của Công ty, đúng theo quyền của tài khoản đang đăng nhập.`,"nod","🏢"],
 [/\b(nguoi that|nguoi hay may|robot|chatbot|tri tue nhan tao|nguoi may|(ban|em) (co )?phai (la )?nguoi)\b/,
  ()=>`Tôi là **trợ lý ảo** (robot trò chuyện tự động), không phải người thật ạ 🤖. Tôi trả lời nhanh các câu hỏi thường gặp và tra cứu số liệu tài sản; việc cần người xử lý, anh/chị bấm **Nhắn quản trị**.`,"giggle","🤖",[["✉️ Nhắn quản trị","để lại lời nhắn"]]],
 [/\b((ban|em) (lam|giup|ho tro|biet) (duoc )?(gi|nhung gi)|(ban|em) co the (lam|giup) gi|huong dan su dung (ban|tro ly))\b/,
  ()=>`**${BOT_ME}** có thể giúp anh/chị:\n- **Tìm tài sản** theo tên, mã tem (vd MB-00012), đơn vị; rê chuột vào tên để xem nhanh\n- Xem **tổng quan**, tài sản **hỏng**, **đến hạn bảo dưỡng**, **lâu chưa kiểm tra**, **chưa có ảnh**, tình hình từng **đơn vị**\n- Xem **tiến độ kiểm kê** năm nay, **hoạt động** mới nhất\n- **Tính khấu hao**, giá trị còn lại\n- **Báo hỏng tài sản**, gửi **lời nhắn** cho quản trị\n- Hướng dẫn quét / in tem QR, nhập Excel, điều chuyển, thanh lý, app Android…\n- Mở nhanh trang: nói "mở trang kiểm kê", "vào in tem"…\nAnh/chị có thể gõ chữ hoặc bấm **micro 🎤** để nói.`,"cheer","✨",1],
 [/\b(bao nhieu tuoi|may tuoi|sinh (nam|ngay) nao|sinh nhat|ra doi (khi|nam) nao)\b/,
  ()=>`Tôi "ra đời" năm **2026** cùng website mới của HAWASUCO, rồi được "điều chuyển" sang cả phần mềm Quản lý tài sản – mà điều chuyển xong vẫn còn ở chỗ cũ, khỏi cần biên bản giao nhận 😄. Còn Công ty HAWASUCO thành lập từ **05/01/2004**.`,"jump","🎂"],
 [/\b(nam hay nu|trai hay gai|gioi tinh|la con trai|la con gai)\b/,
  ()=>`Tôi là robot nên không có giới tính ạ 😊. Anh/chị cứ gọi tôi là **${BOT_ME}** cho thân thiện.`,"shy","😊"],
 [/\b((ban|em) (o|song) dau|nha (ban|em) o dau|(ban|em) dang o dau)\b/,
  ()=>`Tôi "sống" ngay trong phần mềm **Quản lý tài sản** trên máy chủ của Công ty 🏠 (và cả trên website **web.capnuochaugiang.vn**). Nếu phải dán tem cho tôi thì chắc mã là **TL-00001** 😄.`,"nod","🏠"],
 [/\b((ban|em) co (met|ngu|nghi|an)|(ban|em) (truc|lam viec) (may gio|luc nao)|(ban|em) co nghi (le|tet))\b/,
  ()=>`Tôi không biết mệt, trực **24/7** kể cả lễ Tết ạ 💪. Tài sản hư hỏng, mất mát cần xử lý gấp, anh/chị bấm **Báo hỏng tài sản** và báo ngay cho cán bộ quản lý tài sản nhé.`,"cheer","💪"],
 [/\b((ban|em) (co )?(khoe|vui|buon|on) khong)\b/,
  ()=>`Cảm ơn anh/chị đã hỏi thăm! Tôi rất khỏe – vừa tự kiểm tra xong, tình trạng **"Đang sử dụng tốt"** 😄. Anh/chị cần tôi giúp gì hôm nay?`,"love","💙"],
 [/\b((ban|em) (da |co )?(co nguoi yeu|nguoi yeu|co vo|co chong|ket hon)|gia dinh cua (ban|em)|crush)\b/,
  ()=>`Hihi, người tôi "thương" nhất là các anh chị ở HAWASUCO ạ 💙. Còn "gia đình" của tôi là… mấy nghìn tài sản có tem QR trong phần mềm!`,"shy","💙"],
 [/\b((ban|em) thich (gi|nhat)|so thich)\b/,
  ()=>`Tôi thích nhất là tài sản nào cũng **có tem QR, có ảnh** và đợt kiểm kê **xong sớm** 📋. Mẹo nhỏ: chụp ảnh tài sản ngay khi quét tem, lần sau tìm là thấy liền!`,"dance","🏷️"],
 [/\b((ban|em) (co )?(thong minh|gioi)|chatgpt|gemini|copilot)\b/,
  ()=>`Tôi là trợ lý chuyên về phần mềm **Quản lý tài sản** của HAWASUCO, nên chỉ "giỏi" chuyện tài sản, tem QR, kiểm kê, bảo dưỡng thôi ạ 😄. Nếu tôi trả lời chưa đúng ý, anh/chị bấm **Nhắn quản trị** để được hỗ trợ.`,"giggle","😄"],
 [/\b((ban|em|tro ly) (co )?(luu|ghi am|nghe len)|bao mat thong tin)\b/,
  ()=>`Tôi không hỏi mật khẩu hay mã OTP của anh/chị. Số liệu tài sản tôi đọc trên máy chủ của Công ty theo đúng quyền của tài khoản đang đăng nhập. Khi dùng micro, giọng nói chỉ được chuyển thành chữ để gửi câu hỏi. Khi Công ty bật **AI**, câu hỏi khó được gửi tới dịch vụ AI để trả lời – anh/chị đừng nhập mật khẩu, thông tin bí mật vào khung chat nhé 🔒.`,"nod","🔒"],
];
function botSelf(n){if(n.length>90)return null;for(const [rx,f,g,emo,ch] of BOT_SELF)if(rx.test(n))return[f(),g,emo,ch===1?BOT_CHIPS:ch||null];return null}
// ---- Ảnh đại diện robot nhỏ (đầu + miệng): dùng ở đầu khung chat và cạnh mỗi câu trả lời
function botAvatar(){return '<svg class="bav" viewBox="58 14 232 186" aria-hidden="true"><image href="troly-robot-head.png" x="0" y="0" width="360" height="194"/>'+BOT_HEADSET+'<g class="bav-m"><path class="bav-s" d="M166 165 Q182 180 198 164" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round"/><rect class="bav-t" x="166" y="163" width="32" height="16" rx="8" fill="#0b1216" stroke="#3ee0ff" stroke-width="3.4"/></g><g class="bav-e"><circle cx="135" cy="128" r="29" fill="#0b1216"/><circle cx="229" cy="124" r="29" fill="#0b1216"/><path d="M122 133 Q135 115 148 133M216 129 Q229 111 242 129" stroke="#3ee0ff" stroke-width="6" fill="none" stroke-linecap="round"/></g></svg>'}
function botAdd(who,text,opt={}){const box=document.getElementById("botMsgs");const d=document.createElement("div");d.className="bm bm-"+who;
  d.innerHTML=who==="u"?`<p>${esc(text)}</p>`:botMd(text);
  if(opt.chips){const c=document.createElement("div");c.className="bot-chips";opt.chips.forEach(([l,q])=>{const b=document.createElement("button");b.type="button";b.textContent=l;b.onclick=()=>botSend(q,l,true);c.appendChild(b)});d.appendChild(c)}
  if(who==="b"){d._md=text;const rb=document.createElement("button");rb.type="button";rb.className="bm-say-btn";rb.title="Đọc câu trả lời này";rb.setAttribute("aria-label","Đọc câu trả lời này");rb.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path class="spk-w" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/><path class="spk-x" d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';rb.onclick=e=>{e.stopPropagation();BOT_TTS.say(d._md,true)};d.appendChild(rb);if(!opt.silent)setTimeout(()=>BOT_TTS.auto(text),0)}
  if(who!=="u"){d.classList.add("bm-av");const av=document.createElement("span");av.className="bm-avatar";av.innerHTML=botAvatar();d.appendChild(av)}
  box.appendChild(d);box.scrollTop=box.scrollHeight;
  if(who!=="u")botType(d,box);
  d.querySelectorAll("[data-bot-nav]").forEach(a=>a.onclick=()=>{if(matchMedia("(max-width:600px)").matches)botToggle(false)});
  if(who!=="sys")BOT.hist.push({role:who==="u"?"user":"assistant",content:text});if(BOT.hist.length>16)BOT.hist.splice(0,BOT.hist.length-16);return d}
// ---- hiệu ứng gõ chữ (như AI đang soạn), tốc độ nhanh; các tin nối tiếp chờ nhau; bấm vào tin để hiện ngay
let BOT_TQ=Promise.resolve();
function botType(d,box){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const tw=document.createTreeWalker(d,NodeFilter.SHOW_TEXT),nodes=[];let n;
  while(n=tw.nextNode()){if(n.parentElement.closest(".bot-chips"))continue;nodes.push([n,n.nodeValue]);n.nodeValue=""}
  const total=nodes.reduce((a,x)=>a+x[1].length,0);if(!total)return;
  const blocks=[...d.querySelectorAll("p,li")];blocks.forEach(b=>b.style.display="none");
  const chips=d.querySelector(".bot-chips");if(chips)chips.style.display="none";
  d.classList.add("bm-writing");botState("talk",true);
  const step=Math.max(3,Math.ceil(total/90));   // ~1,5 giây cho cả tin dài, tin ngắn còn nhanh hơn
  let done=false;const cur=document.createElement("span");cur.className="bm-cur";
  const finish=()=>{if(done)return;done=true;cur.remove();nodes.forEach(([t,v])=>t.nodeValue=v);blocks.forEach(b=>b.style.display="");if(chips)chips.style.display="";d.classList.remove("bm-writing");d.classList.add("bm-done");box.scrollTop=box.scrollHeight;botState("talk",false);botGesture("nod",900)};
  d.addEventListener("click",finish,{once:true});
  BOT_TQ=BOT_TQ.then(()=>new Promise(res=>{
    if(done)return res();
    let i=0,pos=0;
    const tick=()=>{if(done)return res();let left=step;
      while(left>0&&i<nodes.length){const [t,v]=nodes[i];
        if(pos===0){let e=t.parentElement;while(e&&e!==d){if(e.style.display==="none")e.style.display="";e=e.parentElement}}
        const k=Math.min(left,v.length-pos);pos+=k;left-=k;t.nodeValue=v.slice(0,pos);t.after(cur);if(pos>=v.length){i++;pos=0}}
      const near=box.scrollHeight-box.scrollTop-box.clientHeight<80;if(near)box.scrollTop=box.scrollHeight;
      if(i>=nodes.length){finish();return res()}requestAnimationFrame(tick)};
    requestAnimationFrame(tick)}))}
// ---- Cử chỉ linh vật: botGesture = động tác ngắn (nhảy, vẫy, gật…), botState = trạng thái kéo dài (suy nghĩ, nói, nghe, ngủ)
let BOT_GT=0;
function botGesture(g,ms=1500,emo){const b=document.getElementById("botBtn");if(!b)return;if(/^(clap|belly|hiphop)$/.test(b.dataset.g||"")&&!/^(clap|belly|hiphop)$/.test(g))return;          // đang vỗ tay / ôm bụng cười thì không bị cử chỉ khác cắt ngang
  b.removeAttribute("data-g");void b.getBoundingClientRect();b.dataset.g=g;clearTimeout(BOT_GT);BOT_GT=setTimeout(()=>b.removeAttribute("data-g"),ms);if(emo)botEmote(emo)}
let BOT_FT=0;
function botFace(fx,ms=1400){const b=document.getElementById("botBtn");if(!b)return;b.className=b.className.replace(/\bfx-\S+/g,"").trim();void b.getBoundingClientRect();b.classList.add("fx-"+fx);clearTimeout(BOT_FT);BOT_FT=setTimeout(()=>b.classList.remove("fx-"+fx),ms)}
function botState(st,on){if(st==="talk"&&!on&&BOT.speaking)return;const b=document.getElementById("botBtn");if(b)b.classList.toggle("st-"+st,!!on);
  if(st==="think"||st==="talk"||st==="listen"){const av=document.getElementById("botAv"),stt=document.getElementById("botStat");if(!av||!stt)return;
    av.classList.toggle("is-"+st,!!on);const cur=["listen","think","talk"].find(k=>av.classList.contains("is-"+k));
    stt.innerHTML=cur==="think"?'Đang suy nghĩ<span class="bot-dots"><i></i><i></i><i></i></span>':cur==="talk"?'Đang trả lời<span class="bot-dots"><i></i><i></i><i></i></span>':cur==="listen"?'Đang nghe anh/chị nói…':"Trả lời tự động 24/7";stt.classList.toggle("busy",!!cur)}}
function botEmote(t,loop){const e=document.getElementById("botEmo");if(!e)return;e.textContent=t;e.classList.remove("pop","loop");void e.offsetWidth;e.classList.add(loop?"loop":"pop")}
function botTyping(on){botState("think",on);if(on)botEmote("🔍");const box=document.getElementById("botMsgs");let t=document.getElementById("botTyping");
  if(on&&!t){t=document.createElement("div");t.id="botTyping";t.className="bm bm-b bm-typing bm-av";t.innerHTML='<i class="bt-txt"><b class="bt-book"><s></s></b>Trợ lý ảo đang tra cứu</i><span></span><span></span><span></span><span class="bm-avatar">'+botAvatar()+"</span>";box.appendChild(t);box.scrollTop=box.scrollHeight}
  if(!on&&t)t.remove()}

// ===================== NGHIỆP VỤ QUẢN LÝ TÀI SẢN (thay cho giá nước, hóa đơn, lịch cúp nước của website) =====================
// Gọi /api của máy chủ bằng phiên đăng nhập của phần mềm: chỉ thấy đúng những gì tài khoản đang đăng nhập được xem.
const TL_TOKEN="qlts.token",TL_NGUOI="qlts.nguoi";
function tlToken(){try{return localStorage.getItem(TL_TOKEN)}catch(e){return null}}
function tlNguoi(){try{return JSON.parse(localStorage.getItem(TL_NGUOI)||"null")}catch(e){return null}}
function tlQuyen(c){const n=tlNguoi();return !!(tlToken()&&n&&(n.capQuyen||0)>=c)}
function tlTen(){const n=tlNguoi();if(!n||!tlToken())return"";const ht=String(n.hoTen||"").trim();
  if(!ht||/\b(quan tri|admin|ky thuat|ke toan|phong|doi|can bo|nhan vien|tai khoan|test|thu)\b/.test(botN(ht)))return"";const h=ht.split(/\s+/);return h[h.length-1]}
class TlLoi extends Error{constructor(m,dn){super(m);this.dn=!!dn}}
async function tlApi(duong,than){const tk=tlToken();if(!tk)throw new TlLoi("Anh/chị cần **đăng nhập** phần mềm trước thì tôi mới tra cứu được số liệu tài sản ạ.",true);
  let r;try{r=await fetch("api/"+duong,{method:than?"POST":"GET",headers:Object.assign({"Accept":"application/json","Authorization":"Bearer "+tk},than?{"Content-Type":"application/json"}:{}),body:than?JSON.stringify(than):undefined,cache:"no-store"})}
  catch(e){throw new TlLoi("Tôi chưa kết nối được máy chủ. Anh/chị kiểm tra mạng rồi hỏi lại giúp tôi nhé.")}
  let j=null;try{j=await r.json()}catch(e){}
  if(r.status===401)throw new TlLoi("Phiên đăng nhập đã hết — anh/chị **đăng nhập lại** giúp tôi nhé.",true);
  if(!r.ok)throw new TlLoi((j&&j.loi)||("Máy chủ báo lỗi "+r.status+"."));
  return j}
function tlBaoLoi(e){botGesture("shake",900,"😥");return botAdd("b",(e&&e.message)||"Tôi chưa tra cứu được lúc này, anh/chị thử lại sau ít phút nhé.")}
const TL_TT={tot:"Đang sử dụng tốt",theodoi:"Cần theo dõi",hong:"Hỏng, cần sửa chữa",dangsua:"Đang sửa chữa / bảo dưỡng",ngung:"Ngừng sử dụng",thanhly:"Đã thanh lý",mat:"Mất / không tìm thấy"};
const tlSo=v=>Number(v||0).toLocaleString("vi-VN");
function tlTien(v){v=Number(v||0);if(v>=1e9)return (Math.round(v/1e7)/100).toLocaleString("vi-VN")+" tỷ đồng";if(v>=1e6)return (Math.round(v/1e4)/100).toLocaleString("vi-VN")+" triệu đồng";return tlSo(Math.round(v))+" đồng"}
function tlNgay(s){if(!s)return"";const d=new Date(s);return isNaN(d)?String(s):d.toLocaleDateString("vi-VN")}
function tlSach(s){return String(s??"").replace(/[\[\]()!*]/g," ").replace(/\s+/g," ").trim()}
// một dòng tài sản (gạch đầu dòng) có liên kết tới trang tài sản; tài sản hỏng / mất tô đỏ
function tlDongTs(t,them){const tt=TL_TT[t.tinhTrang]||t.tinhTrang||"";
  const s=`[${tlSach(t.ma)} · ${tlSach(t.ten)}](#/ts/${t.id}) – ${tlSach(t.tenDonVi)||"chưa giao đơn vị"}`+(tt?` – ${tt}`:"")+(them?` – ${them}`:"");
  return "- "+(/^(hong|mat)$/.test(t.tinhTrang)?"!!"+s+"!!":s)}
function tlDs(ds,toiDa,them){return ds.slice(0,toiDa).map(t=>tlDongTs(t,them?them(t):"")).join("\n")}
function tlQs(o){const s=Object.keys(o).filter(k=>o[k]!==""&&o[k]!=null).map(k=>k+"="+encodeURIComponent(o[k])).join("&");return s?"?"+s:""}
const TL_HOW=/\b(cach|lam sao|lam the nao|the nao|nhu the nao|huong dan|o dau de|bang cach nao|cach nao|cac buoc|quy trinh|muon .* thi)\b/;

// ---- danh mục (loại tài sản, đơn vị) – nạp 1 lần, dùng để nhận ra tên đơn vị / loại trong câu hỏi
let TL_DM=null,TL_DM_LUC=0;
async function tlDanhMuc(){if(TL_DM&&Date.now()-TL_DM_LUC<300000)return TL_DM;TL_DM=await tlApi("danhmuc");TL_DM_LUC=Date.now();return TL_DM}
function tlTimDonVi(n,dm){if(!dm)return null;const h=" "+n+" ";
  const ds=(dm.donVi||[]).map(d=>({d,k:botN(d.ten)})).sort((a,b)=>b.k.length-a.k.length);
  let x=ds.find(o=>o.k&&h.includes(" "+o.k+" "));if(x)return x.d;
  const m=/\bdoi (?:cap nuoc |cn )?(?:so )?(\d{1,2})\b/.exec(n);                     // "đội 2", "đội số 2", "đội cấp nước 2"
  if(m){x=ds.find(o=>/^doi\b/.test(o.k)&&new RegExp("\\b(so )?"+m[1]+"$").test(o.k));if(x)return x.d}
  x=ds.find(o=>{const s=o.k.replace(/^(doi cap nuoc|doi|phong|tram|nha may|ban|xi nghiep)\s+/,"");return s.length>3&&s!==o.k&&h.includes(" "+s+" ")});
  return x?x.d:null}
// bỏ tên đơn vị (và cách gọi tắt "đội 2") khỏi câu, còn lại là từ khóa tìm
function tlBoDonVi(n,dv){if(!dv)return n;let q=(" "+n+" ").replace(" "+botN(dv.ten)+" "," ").replace(/\bdoi (cap nuoc |cn )?(so )?\d{1,2}\b/," ");
  const ngan=botN(dv.ten).replace(/^(doi cap nuoc|doi|phong|tram|nha may|ban|xi nghiep)\s+/,"");if(ngan.length>3)q=q.replace(" "+ngan+" "," ");
  return q.replace(/\b(cua|o|tai|thuoc|trong)\s*$/,"").replace(/^\s*(cua|o|tai|thuoc|trong)\b/,"").replace(/\s+/g," ").trim()}
function tlTimLoai(n,dm){if(!dm)return null;const h=" "+n+" ";
  return (dm.loai||[]).map(l=>({l,k:botN(l.ten)})).sort((a,b)=>b.k.length-a.k.length).find(o=>o.k.length>2&&h.includes(" "+o.k+" "))?.l||null}

// ---- mã tài sản trong câu (vd MB-00012, MPD-00003, TS0005)
function tlMa(text){const m=/(^|[\s:,(])([A-Za-z]{1,8}-\d{1,8}|[A-Za-z]{1,6}\d{3,8})(?=$|[\s.,;:!?)])/.exec(String(text));return m?m[2].toUpperCase():null}

// ---- tra cứu một tài sản theo mã
async function tlXemMa(ma){botTyping(true);
  try{const r=await tlApi("tim?ma="+encodeURIComponent(ma));botTyping(false);
    if(!r.id){botGesture("shake",900,"🤔");return botAdd("b",`Không có tài sản mã **${tlSach(r.ma||ma)}** trong phần mềm.`+(r.duocTao?`\nNếu đây là tem trắng mới dán, anh/chị có thể [khai báo tài sản mã ${tlSach(r.ma)}](#/ma/${encodeURIComponent(r.ma)}).`:"\nAnh/chị kiểm tra lại mã trên tem nhé."),{chips:[["🔎 Tìm theo tên","tìm tài sản"]]})}
    const d=await tlApi("taisan/"+r.id);BOT.tsLast=d;return tlTheTs(d)}
  catch(e){botTyping(false);return tlBaoLoi(e)}}
function tlTheTs(d){const tt=TL_TT[d.tinhTrang]||d.tinhTrang||"";
  let s=`**${tlSach(d.ma)} · ${tlSach(d.ten)}** (${tlSach(d.tenLoai)||"chưa phân loại"})`;
  s+=`\n- Đơn vị: **${tlSach(d.tenDonVi)||"chưa giao"}**`+(d.viTri?` – ${tlSach(d.viTri)}`:"")+(d.nguoiSuDung?`\n- Người sử dụng: ${tlSach(d.nguoiSuDung)}`:"");
  s+="\n- Tình trạng: "+(/^(hong|mat)$/.test(d.tinhTrang)?`!!${tt}!!`:`**${tt}**`);
  if(d.nguyenGia)s+=`\n- Nguyên giá: **${tlTien(d.nguyenGia)}**`+(d.giaTriConLai!=null?` – còn lại: **${tlTien(d.giaTriConLai)}**`:"");
  s+=`\n- Kiểm tra lần cuối: ${d.kiemTraCuoi?tlNgay(d.kiemTraCuoi):"chưa có"}`+(d.hanBaoTri?` – hạn bảo dưỡng: **${tlNgay(d.hanBaoTri)}**`:"");
  if(d.kiemKeNam&&d.kiemKeNam.dot)s+=`\n- Kiểm kê ${d.kiemKeNam.nam}: `+(d.kiemKeNam.daKiem?`đã kiểm (${tlNgay(d.kiemKeNam.luc)}${d.kiemKeNam.nguoi?", "+tlSach(d.kiemKeNam.nguoi):""})`:"**chưa kiểm**");
  s+=`\n- Ảnh: ${d.soAnh||0} ảnh · Lịch sử: ${(d.lichSu||[]).length} lần ghi nhận`;
  s+=`\n[Mở trang tài sản ${tlSach(d.ma)}](#/ts/${d.id})`;
  const ch=[["⚠️ Báo hỏng tài sản này","báo hỏng "+d.ma]];if(d.nguyenGia)ch.push(["🧮 Khấu hao tài sản này","khấu hao "+d.ma]);ch.push(["🔎 Tìm tài sản khác","tìm tài sản"]);
  return botAdd("b",s,{chips:ch})}

// ---- tìm tài sản theo tên / nơi đặt / loại (giống ô tìm của trang Tài sản)
const TL_TIM_RX=/^(tim kiem|tim|tra cuu|tra|xem|cho (toi|em|minh) (xem|biet|tim)|thong tin|ho so|danh sach|liet ke|loc)\b/;
const TL_ODAU_RX=/\b(o dau|dau roi|nam o dau|o cho nao|de o dau|dang o dau)( vay| a| nhi| the)?$/;
function tlTuKhoa(n){return n.replace(/^(cho (toi|em|minh) (xem|biet|tim)|tim kiem|tim giup|tim|tra cuu|tra|xem|thong tin|ho so|danh sach|liet ke|loc)\s*/,"")
  .replace(/^(cac |nhung )?(tai san|thiet bi)\s*/,"").replace(TL_ODAU_RX,"").replace(/\b(giup (toi|em|minh)|di|nhe|a|voi)$/,"").replace(/\s+/g," ").trim()}
function tlHienTu(text){return String(text).trim().replace(/[?.!]+$/,"").replace(/^(tìm kiếm|tìm giúp|tìm|tra cứu|tra|xem|cho (tôi|em|mình) (xem|biết|tìm)|thông tin|hồ sơ|danh sách|liệt kê|lọc)\s+/i,"")
  .replace(/^(các |những )?(tài sản|thiết bị)\s+/i,"").replace(/\s*(ở đâu|đâu rồi|nằm ở đâu|ở chỗ nào|để ở đâu|đang ở đâu)( vậy| ạ| nhỉ| thế)?$/i,"").trim()}
async function tlTim(tu,hien){botTyping(true);
  try{const dm=await tlDanhMuc().catch(()=>null);const n=botN(tu);const dv=tlTimDonVi(n,dm);
    const q=tlBoDonVi(n,dv);
    const qs=tlQs({q,donvi:dv?dv.id:"",co:10,sap:"ma"});const r=await tlApi("taisan"+qs);botTyping(false);
    const nhan=`«${tlSach(hien||tu)}»`;
    if(!r.tong){botGesture("shake",900,"🤔");return botAdd("b",`Không tìm thấy tài sản nào khớp ${nhan}${dv?" ở **"+tlSach(dv.ten)+"**":""}. Anh/chị thử gõ ngắn hơn (vd "máy bơm"), gõ mã trên tem (vd MB-00012), hoặc tìm ở trang [Tài sản](#/ds).`,{chips:[["🔎 Tìm lại","tìm tài sản"]]})}
    BOT.timLast={q,donvi:dv?dv.id:""};
    let s=`Có **${tlSo(r.tong)}** tài sản khớp ${nhan}${dv?" ở **"+tlSach(dv.ten)+"**":""}`+(r.tongNguyenGia?` (nguyên giá ${tlTien(r.tongNguyenGia)})`:"")+":\n"+tlDs(r.ds,8);
    if(r.tong>8)s+=`\n[Xem đủ ${tlSo(r.tong)} tài sản](#/ds${tlQs({q,donvi:dv?dv.id:""})})`;
    if(r.tong===1){BOT.tsLast=null;s+="\nRê chuột (hoặc bấm) vào tên tài sản để xem nhanh."}
    return botAdd("b",s)}
  catch(e){botTyping(false);return tlBaoLoi(e)}}

// ---- tổng quan (giống trang Tổng quan)
async function tlTongQuan(){botTyping(true);
  try{const r=await tlApi("thongke");botTyping(false);
    const tt=(r.theoTinhTrang||[]).filter(x=>x.so>0).map(x=>`${x.ten}: **${tlSo(x.so)}**`).join(" · ");
    let s=`📊 **Tổng quan tài sản** (${new Date().toLocaleDateString("vi-VN")}):\n- Đang quản lý: **${tlSo(r.dangQuanLy)}** / ${tlSo(r.tong)} tài sản đã khai báo`;
    if(r.nguyenGia)s+=`\n- Nguyên giá: **${tlTien(r.nguyenGia)}** – giá trị còn lại: **${tlTien(r.conLai)}**`;
    if(tt)s+=`\n- Theo tình trạng: ${tt}`;
    s+=`\n- Đến hạn bảo dưỡng (trong 7 ngày): **${tlSo(r.denHanBaoTri)}** · lâu chưa kiểm tra (quá ${r.ngayNhacKiemTra} ngày): **${tlSo(r.lauChuaKiem)}** · chưa có ảnh: **${tlSo(r.chuaAnh)}**`;
    s+=`\n- Kiểm tra trong 30 ngày qua: **${tlSo(r.kiemTraThang)}** tài sản`;
    if(r.kiemKeNam){const k=r.kiemKeNam;s+=`\n- Kiểm kê ${k.nam}: đã kiểm **${tlSo(k.daKiem)}/${tlSo(k.tong)}** (${k.tong?Math.round(k.daKiem*100/k.tong):0}%)`+(k.dong?" – đã kết thúc":"")}
    else s+=`\n- Kiểm kê ${r.namNay}: chưa bắt đầu`;
    const dv=(r.theoDonVi||[]).slice().sort((a,b)=>b.so-a.so).slice(0,3);if(dv.length)s+=`\n- Nhiều tài sản nhất: ${dv.map(d=>`${tlSach(d.ten)} (${tlSo(d.so)})`).join(", ")}`;
    s+=`\nXem chi tiết ở trang [Tổng quan](#/tongquan) hoặc [Theo đơn vị](#/donvi).`;
    botGesture("cheer",1400,"📊");
    return botAdd("b",s,{chips:[["🔧 Tài sản hỏng","tài sản hỏng"],["🛠️ Đến hạn bảo dưỡng","tài sản đến hạn bảo dưỡng"],["📋 Tiến độ kiểm kê","tiến độ kiểm kê"]]})}
  catch(e){botTyping(false);return tlBaoLoi(e)}}

// ---- danh sách theo bộ lọc của trang Tài sản: hỏng, đến hạn bảo dưỡng, lâu chưa kiểm tra, chưa có ảnh
const TL_LOC={
  hong:{tieu:"🔧 Tài sản **hỏng, cần sửa chữa**",q:{tinhtrang:"hong",sap:"moi"},rong:"Hiện **không có tài sản nào đang báo hỏng** 👍",them:null,chip:[["🛠️ Đang sửa chữa","tài sản đang sửa chữa"],["⚠️ Báo hỏng tài sản","báo hỏng tài sản"]]},
  dangsua:{tieu:"🛠️ Tài sản **đang sửa chữa / bảo dưỡng**",q:{tinhtrang:"dangsua",sap:"moi"},rong:"Hiện không có tài sản nào đang sửa chữa.",them:null,chip:[["🔧 Tài sản hỏng","tài sản hỏng"]]},
  baotri:{tieu:"🛠️ Tài sản **đến hạn bảo dưỡng** (quá hạn hoặc trong 7 ngày tới)",q:{them:"baotri",sap:"baotri"},rong:"Không có tài sản nào đến hạn bảo dưỡng trong 7 ngày tới 👍",them:t=>t.hanBaoTri?"hạn "+tlNgay(t.hanBaoTri):"",chip:[["📊 Tổng quan","tổng quan tài sản"]]},
  lauchuakiem:{tieu:"🕒 Tài sản **lâu chưa kiểm tra**",q:{them:"lauchuakiem",sap:"kiemtra"},rong:"Tài sản nào cũng được kiểm tra gần đây 👍",them:t=>t.kiemTraCuoi?"kiểm tra "+tlNgay(t.kiemTraCuoi):"chưa kiểm tra lần nào",chip:[["📷 Cách ghi kiểm tra","cách ghi kiểm tra tài sản"]]},
  chuaanh:{tieu:"📷 Tài sản **chưa có ảnh**",q:{them:"chuaanh",sap:"ma"},rong:"Tài sản nào cũng đã có ảnh 👍",them:null,chip:[["📷 Cách chụp ảnh tài sản","cách chụp ảnh tài sản"]]}
};
async function tlLoc(k,dv){const L=TL_LOC[k];botTyping(true);
  try{const q=Object.assign({co:10},L.q,dv?{donvi:dv.id}:{});const r=await tlApi("taisan"+tlQs(q));botTyping(false);
    const o=dv?` ở **${tlSach(dv.ten)}**`:"";
    if(!r.tong){botGesture("cheer",1200,"👍");return botAdd("b",L.rong.replace(/👍$/,"")+(o?` (${tlSach(dv.ten)})`:"")+(/👍$/.test(L.rong)?" 👍":""),{chips:L.chip})}
    let s=`${L.tieu}${o}: **${tlSo(r.tong)}** tài sản\n`+tlDs(r.ds,8,L.them);
    const loc=Object.assign({},L.q,dv?{donvi:dv.id}:{});delete loc.sap;
    if(r.tong>8)s+=`\n[Xem đủ ${tlSo(r.tong)} tài sản](#/ds${tlQs(loc)})`;else s+=`\n[Mở danh sách này](#/ds${tlQs(loc)})`;
    return botAdd("b",s,{chips:L.chip})}
  catch(e){botTyping(false);return tlBaoLoi(e)}}

// ---- kiểm kê năm nay
async function tlKiemKe(){botTyping(true);
  try{const r=await tlApi("kiemke");botTyping(false);const k=(r.ds||[]).find(x=>x.id===r.dotNamNay);
    if(!k){const cu=(r.ds||[])[0];
      return botAdd("b",`Năm **${r.namNay}** chưa bắt đầu kiểm kê.`+(cu?`\nĐợt gần nhất: **${tlSach(cu.ten)}** (${cu.nam}) – đã kiểm ${tlSo(cu.daKiem)}/${tlSo(cu.tong)}.`:"")+`\nKiểm kê năm nay **tự bắt đầu** khi có người quét tem đầu tiên trong năm${tlQuyen(2)?", hoặc anh/chị bấm [Kiểm kê](#/kiemke) → **Bắt đầu kiểm kê năm "+r.namNay+"** để mở trước":""}.`,{chips:[["📋 Cách kiểm kê","cách kiểm kê tài sản"]]})}
    const pt=k.tong?Math.round(k.daKiem*100/k.tong):0,con=Math.max(0,k.tong-k.daKiem);
    const thanh="▓".repeat(Math.round(pt/10))+"░".repeat(10-Math.round(pt/10));
    let s=`📋 **${tlSach(k.ten)}** (${tlSach(k.tenDonVi)})${k.dong?" – **đã kết thúc**":""}\n- Tiến độ: ${thanh} **${pt}%** – đã kiểm **${tlSo(k.daKiem)}/${tlSo(k.tong)}** tài sản`;
    s+=`\n- `+(con?`Còn **${tlSo(con)}** tài sản chưa kiểm`:"**Đã kiểm đủ** tài sản trong sổ 🎉")+(k.ngoaiSo?` · ${tlSo(k.ngoaiSo)} tài sản ngoài sổ được quét`:"");
    if(k.tuNgay||k.denNgay)s+=`\n- Thời gian: ${tlNgay(k.tuNgay)||"…"} – ${tlNgay(k.denNgay)||"…"}`;
    s+=`\n[Xem kết quả theo đơn vị, danh sách chưa kiểm](#/kiemke/${k.id})`+(!k.dong&&tlQuyen(1)?`\nĐi kiểm kê: mở [Quét QR liên tục](#/quet?lientuc=1) rồi quét lần lượt từng tem.`:"");
    if(!con&&k.tong){botClap()}else botGesture("nod",900,"📋");
    return botAdd("b",s,{chips:[["📋 Cách kiểm kê","cách kiểm kê tài sản"],["📊 Tổng quan","tổng quan tài sản"]]})}
  catch(e){botTyping(false);return tlBaoLoi(e)}}

// ---- tình hình tài sản của một đơn vị (giống trang Theo đơn vị)
async function tlDonVi(dv){botTyping(true);
  try{const r=await tlApi("theodonvi");botTyping(false);let o=null;
    for(const k of r.khoi||[])for(const d of k.donVi||[])if(d.id===dv.id)o=d;
    if(!o||!o.so)return botAdd("b",`**${tlSach(dv.ten)}** hiện chưa có tài sản nào đang quản lý.`);
    let s=`🏢 **${tlSach(o.ten)}**: **${tlSo(o.so)}** tài sản đang quản lý`+(o.nguyenGia?` – nguyên giá ${tlTien(o.nguyenGia)}, còn lại ${tlTien(o.conLai)}`:"");
    s+=`\n- Tốt: **${tlSo(o.tot)}** · cần theo dõi: **${tlSo(o.theoDoi)}** · `+(o.hong?`!!hỏng / đang sửa: ${tlSo(o.hong)}!!`:"hỏng / đang sửa: **0**")+` · ngừng: ${tlSo(o.ngung)}`;
    s+=`\n- Đến hạn bảo dưỡng: **${tlSo(o.denHanBaoTri)}** · lâu chưa kiểm tra: **${tlSo(o.lauChuaKiem)}** · chưa có ảnh: **${tlSo(o.chuaAnh)}**`;
    if((o.theoLoai||[]).length)s+=`\n- Nhiều nhất: ${o.theoLoai.map(x=>`${tlSach(x.ten)} (${tlSo(x.so)})`).join(", ")}`;
    s+=`\n[Danh sách tài sản của ${tlSach(o.ten)}](#/ds?donvi=${o.id})`;
    const ch=[];if(o.hong)ch.push(["🔧 Tài sản hỏng ở đây","tài sản hỏng "+o.ten]);if(o.denHanBaoTri)ch.push(["🛠️ Đến hạn bảo dưỡng ở đây","đến hạn bảo dưỡng "+o.ten]);ch.push(["📊 Toàn công ty","tổng quan tài sản"]);
    return botAdd("b",s,{chips:ch})}
  catch(e){botTyping(false);return tlBaoLoi(e)}}

// ---- đếm tài sản: "có bao nhiêu máy bơm", "đội 2 có mấy máy phát điện"
async function tlDem(n){botTyping(true);
  try{const dm=await tlDanhMuc();const dv=tlTimDonVi(n,dm),lo=tlTimLoai(n,dm);
    let tu=n.replace(/\b(co |hien co |cong ty co |tong cong co )?(bao nhieu|may|so luong|tong so)\b/," ").replace(/\b(cai|chiec|bo|tai san|thiet bi|hien nay|hien tai|tat ca|vay|a|nhi)\b/g," ");
    if(dv)tu=tlBoDonVi(tu,dv);
    if(lo)tu=(" "+tu+" ").replace(" "+botN(lo.ten)+" "," ");
    tu=tu.replace(/\b(cua|o|tai|thuoc|trong)\b/g," ").replace(/\s+/g," ").trim();
    if(!dv&&!lo&&!tu){botTyping(false);return tlTongQuan()}
    if(dv&&!lo&&!tu){botTyping(false);return tlDonVi(dv)}
    const q={loai:lo?lo.id:"",donvi:dv?dv.id:"",q:tu,them:"dangquanly",co:10};const r=await tlApi("taisan"+tlQs(q));botTyping(false);
    const ten=[lo?tlSach(lo.ten):"",tu?`khớp «${tu}»`:""].filter(Boolean).join(" ")||"tài sản";
    let s=`${dv?"**"+tlSach(dv.ten)+"** có":"Công ty có"} **${tlSo(r.tong)}** ${ten} đang quản lý`+(r.tongNguyenGia?` (nguyên giá ${tlTien(r.tongNguyenGia)})`:"")+".";
    if(r.tong){s+="\n"+tlDs(r.ds,5);const loc={loai:q.loai,donvi:q.donvi,q:q.q,them:"dangquanly"};s+=`\n[Xem danh sách](#/ds${tlQs(loc)})`}
    return botAdd("b",s)}
  catch(e){botTyping(false);return tlBaoLoi(e)}}

// ---- hoạt động gần đây (thay cho "tin tức mới" của website)
async function tlHoatDong(){botTyping(true);
  try{const r=await tlApi("hoatdong");botTyping(false);const ds=(r.ds||[]).slice(0,8);
    if(!ds.length)return botAdd("b","Chưa có hoạt động nào được ghi nhận.");
    const gio=v=>{const d=new Date(v);return isNaN(d)?"":d.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+" "+d.toLocaleDateString("vi-VN")};
    const s="🕒 **Hoạt động mới nhất** trong phần mềm:\n"+ds.map(x=>`- ${gio(x.luc)} – **${tlSach(x.hoTen||x.nguoi)}** ${tlSach(x.tenLoai).toLowerCase()}`+(x.taiSan?` [${tlSach(x.ma)} · ${tlSach(x.ten)}](#/ts/${x.taiSan})`:"")+(x.tinhTrang?` (${TL_TT[x.tinhTrang]||x.tinhTrang})`:"")).join("\n")+"\nXem đầy đủ ở trang [Hoạt động](#/hoatdong).";
    return botAdd("b",s)}
  catch(e){botTyping(false);return tlBaoLoi(e)}}

// ---- tính khấu hao theo phương pháp đường thẳng (như phần mềm tính giá trị còn lại) – thay cho "tính tiền nước"
function tlDocTien(n){const m=/(\d+(?:[.,]\d+)*)\s*(ty|ti|trieu|tr|nghin|ngan|k|dong|d)?\b/g;let best=null,x;
  while((x=m.exec(n))){const raw=x[1],dv=x[2]||"";let v;
    if(/^(ty|ti|trieu|tr)$/.test(dv))v=parseFloat(raw.replace(/\./g,"").replace(",","."));else v=parseFloat(raw.replace(/[.,](?=\d{3}\b)/g,"").replace(",","."));
    if(isNaN(v))continue;v*=dv==="ty"||dv==="ti"?1e9:dv==="trieu"||dv==="tr"?1e6:dv==="nghin"||dv==="ngan"||dv==="k"?1e3:1;
    const sau=n.slice(x.index+x[0].length,x.index+x[0].length+6);if(/^\s*nam/.test(sau)||/^\s*(thang|ngay)/.test(sau))continue;
    if(v>=1e5&&(!best||v>best))best=v}
  return best}
function tlDocNam(n){const m=/(\d{1,2})\s*nam\b(?!\s*(nay|truoc|sau|\d{4}))/.exec(n);return m?+m[1]:null}
function tlDocDaDung(n){let m=/(da )?(dung|su dung|xai) (duoc )?(\d{1,2}(?:[.,]\d)?)\s*nam/.exec(n);if(m)return parseFloat(m[4].replace(",","."));
  m=/\b(tu|nam|mua|dua vao su dung)\s*(nam\s*)?(19\d{2}|20\d{2})\b/.exec(n);if(m)return Math.max(0,new Date().getFullYear()-+m[3]);return null}
function tlKhauHao(ng,nam,daDung){const kh=ng/nam;let s=`🧮 **Khấu hao đường thẳng** – nguyên giá **${tlTien(ng)}**, thời gian khấu hao **${nam} năm**:\n- Mỗi năm: **${tlTien(kh)}** (${(100/nam).toLocaleString("vi-VN",{maximumFractionDigits:2})}%/năm)\n- Mỗi tháng: **${tlTien(kh/12)}**`;
  if(daDung!=null){const lk=Math.min(ng,kh*daDung);s+=`\n- Đã dùng ${daDung.toLocaleString("vi-VN")} năm: khấu hao lũy kế **${tlTien(lk)}**, giá trị còn lại **${tlTien(ng-lk)}**`+(daDung>=nam?" (đã khấu hao hết)":"")}
  s+=`\nPhần mềm tự tính giá trị còn lại của từng tài sản theo ngày đưa vào sử dụng và số năm khấu hao của loại (sửa ở [Danh mục](#/danhmuc)). Số liệu chính thức theo sổ kế toán.`;
  return s}
async function tlKhauHaoTs(ma){botTyping(true);
  try{const r=await tlApi("tim?ma="+encodeURIComponent(ma));if(!r.id){botTyping(false);return botAdd("b",`Không có tài sản mã **${tlSach(ma)}**.`)}
    const d=await tlApi("taisan/"+r.id);botTyping(false);
    if(!d.nguyenGia)return botAdd("b",`Tài sản **${tlSach(d.ma)} · ${tlSach(d.ten)}** chưa nhập **nguyên giá** nên chưa tính được khấu hao. [Mở để bổ sung](#/ts/${d.id})`);
    const n=d.soNamKhauHaoApDung||0;
    if(!n||!d.ngaySuDung)return botAdd("b",`**${tlSach(d.ma)} · ${tlSach(d.ten)}**: nguyên giá **${tlTien(d.nguyenGia)}**, nhưng chưa có ${!n?"**số năm khấu hao**":"**ngày đưa vào sử dụng**"} nên phần mềm chưa tính giá trị còn lại. [Mở để bổ sung](#/ts/${d.id})`);
    return botAdd("b",`🧮 **${tlSach(d.ma)} · ${tlSach(d.ten)}**\n- Nguyên giá: **${tlTien(d.nguyenGia)}**, khấu hao **${n} năm** từ ${tlNgay(d.ngaySuDung)}\n- Mỗi năm: **${tlTien(d.nguyenGia/n)}** · mỗi tháng: **${tlTien(d.nguyenGia/n/12)}**\n- Khấu hao lũy kế đến hôm nay: **${tlTien(d.khauHaoLuyKe)}**\n- Giá trị còn lại: **${tlTien(d.giaTriConLai)}**\n[Mở trang tài sản](#/ts/${d.id})`)}
  catch(e){botTyping(false);return tlBaoLoi(e)}}
function tlKhauHaoY(n){const ng=tlDocTien(n),nam=tlDocNam(n),dd=tlDocDaDung(n);
  if(ng&&nam)return botAdd("b",tlKhauHao(ng,nam,dd),{chips:[["🧮 Tính khoản khác","tính khấu hao"]]});
  BOT.state={kh:{ng,nam,dd}};
  return botAdd("b",ng?`Nguyên giá **${tlTien(ng)}**. Tài sản khấu hao trong **bao nhiêu năm**? (vd: 8 năm)`:`Tôi tính khấu hao đường thẳng giúp anh/chị. Cho tôi biết **nguyên giá** (và số năm nếu có), ví dụ: "**120 triệu, 8 năm**" hoặc "**1,5 tỷ 20 năm, đã dùng 3 năm**". Muốn xem một tài sản cụ thể, gõ "khấu hao MB-00012".`,{chips:[["Hủy","hủy"]]})}
function tlKhauHaoBuoc(n){const st=BOT.state.kh;if(/^(huy|thoi|dung|bo qua|khong can)$/.test(n)){BOT.state=null;return botAdd("b","Đã dừng tính khấu hao.")}
  const ng=tlDocTien(n),nam=tlDocNam(n)||(/^\d{1,2}$/.test(n)&&st.ng?+n:null),dd=tlDocDaDung(n);
  if(ng)st.ng=ng;if(nam)st.nam=nam;if(dd!=null)st.dd=dd;
  if(!ng&&!nam&&dd==null){BOT.state=null;return null}       // hỏi sang việc khác
  if(st.ng&&st.nam){BOT.state=null;return botAdd("b",tlKhauHao(st.ng,st.nam,st.dd),{chips:[["🧮 Tính khoản khác","tính khấu hao"]]})}
  return botAdd("b",st.ng?`Nguyên giá **${tlTien(st.ng)}**. Khấu hao trong **bao nhiêu năm**?`:"Cho tôi biết **nguyên giá** (vd: 120 triệu):",{chips:[["Hủy","hủy"]]})}

// ---- báo hỏng tài sản: ghi nhận kiểm tra với tình trạng "Hỏng, cần sửa chữa" (như bấm Ghi kiểm tra trên trang tài sản)
async function tlBaoHongBatDau(ma){
  if(!tlToken())return botAdd("b","Anh/chị cần **đăng nhập** phần mềm trước để báo hỏng tài sản ạ.");
  if(!tlQuyen(1))return botAdd("b","Tài khoản của anh/chị có quyền **Chỉ xem**, chưa ghi được tình trạng tài sản. Anh/chị báo cho cán bộ quản lý tài sản, hoặc bấm **Nhắn quản trị** để xin thêm quyền nhé.",{chips:[["✉️ Nhắn quản trị","để lại lời nhắn"]]});
  BOT.state={hong:{buoc:"ma"}};
  if(ma)return tlBaoHongBuoc(ma);
  return botAdd("b","Tôi sẽ ghi nhận tài sản **hỏng, cần sửa chữa** giúp anh/chị.\nNhập **mã tài sản** in trên tem QR (vd MB-00012)"+(BOT_APP?"":", hoặc mở [Quét mã QR](#/quet) để quét tem rồi bấm **Ghi kiểm tra**")+". Gõ \"hủy\" để dừng.",{chips:[["Hủy","hủy"]]})}
async function tlBaoHongBuoc(text){const st=BOT.state.hong,n=botN(text);
  if(/^(huy|thoi|dung|khong can|bo qua)$/.test(n)){BOT.state=null;return botAdd("b","Đã dừng báo hỏng. Anh/chị cần gì khác không ạ?",{chips:BOT_CHIPS.slice(2,6)})}
  if(st.buoc==="ma"){const ma=tlMa(text)||(/^[a-z0-9]{2,12}$/i.test(text.trim())?text.trim().toUpperCase():null);
    if(!ma){if(n.split(" ").length>4){BOT.state=null;return null}return botAdd("b","Mã tài sản gồm chữ và số in trên tem (vd **MB-00012**). Anh/chị nhập lại, hoặc gõ \"hủy\":",{chips:[["Hủy","hủy"]]})}
    botTyping(true);
    try{const r=await tlApi("tim?ma="+encodeURIComponent(ma));botTyping(false);
      if(!r.id)return botAdd("b",`Không có tài sản mã **${tlSach(r.ma||ma)}**. Anh/chị kiểm tra lại mã trên tem rồi nhập lại, hoặc gõ "hủy".`,{chips:[["Hủy","hủy"]]});
      st.ts=r.taiSan;st.buoc="mota";
      if(/^(thanhly|mat)$/.test(st.ts.tinhTrang)){BOT.state=null;return botAdd("b",`**${tlSach(st.ts.ma)} · ${tlSach(st.ts.ten)}** đang ở tình trạng **${TL_TT[st.ts.tinhTrang]}**, không ghi hỏng được nữa.`)}
      return botAdd("b",`Tài sản **${tlSach(st.ts.ma)} · ${tlSach(st.ts.ten)}** (${tlSach(st.ts.tenDonVi)||"chưa giao đơn vị"}${st.ts.viTri?" – "+tlSach(st.ts.viTri):""}).\nAnh/chị mô tả ngắn **hư hỏng** (vd: "máy kêu to, rò nước ở phốt"):`,{chips:[["Hủy","hủy"]]})}
    catch(e){botTyping(false);BOT.state=null;return tlBaoLoi(e)}}
  if(st.buoc==="mota"){if(text.trim().length<5)return botAdd("b","Mô tả hơi ngắn, anh/chị ghi rõ hơn giúp tôi (ít nhất 5 ký tự):");
    st.mota=text.trim().slice(0,1000);st.buoc="xacnhan";
    return botAdd("b",`Ghi nhận **${tlSach(st.ts.ma)} · ${tlSach(st.ts.ten)}**: tình trạng !!Hỏng, cần sửa chữa!!\nNội dung: "${tlSach(st.mota)}"\nAnh/chị xác nhận nhé?`,{chips:[["✅ Ghi nhận","đồng ý"],["Hủy","hủy"]]})}
  if(st.buoc==="xacnhan"){if(!/^(dong y|co|ok|oke|xac nhan|ghi|ghi nhan|dung roi|chac chan|u|uh|vang|da)\b/.test(n)){BOT.state=null;return botAdd("b","Đã hủy, chưa ghi gì vào phần mềm.")}
    BOT.state=null;botTyping(true);
    try{await tlApi(`taisan/${st.ts.id}/sukien`,{loai:"kiemtra",tinhTrang:"hong",noiDung:"[Trợ lý ảo] "+st.mota});botTyping(false);botGesture("nod",900,"✅");
      return botAdd("b",`✅ Đã ghi nhận **${tlSach(st.ts.ma)} · ${tlSach(st.ts.ten)}** là **hỏng, cần sửa chữa** (nằm trong lịch sử tài sản). Cán bộ quản lý tài sản sẽ thấy ở trang Tổng quan → Tài sản hỏng.\n[Mở trang tài sản](#/ts/${st.ts.id}) để thêm ảnh hư hỏng nếu cần.`,{chips:[["🔧 Tài sản hỏng","tài sản hỏng"]]})}
    catch(e){botTyping(false);return tlBaoLoi(e)}}}

// ---- để lại lời nhắn cho người quản trị phần mềm (máy chủ lưu; quản trị xem trong Cài đặt → Trợ lý ảo, hoặc hỏi "xem lời nhắn")
async function tlNhanBatDau(){if(!tlToken())return botAdd("b","Anh/chị **đăng nhập** phần mềm trước để gửi lời nhắn cho quản trị nhé (cần biết ai gửi). Quên mật khẩu thì liên hệ trực tiếp người quản trị phần mềm của Công ty.");
  BOT.state={form:{},step:0};return botAdd("b","Tôi sẽ chuyển lời nhắn tới **người quản trị phần mềm** (kèm tên tài khoản của anh/chị). Gõ \"hủy\" để dừng bất cứ lúc nào.\nAnh/chị nhập **nội dung cần hỗ trợ** (vd: xin thêm quyền, báo lỗi, đề nghị sửa danh mục…):",{chips:[["Hủy","hủy"]]})}
async function tlNhanBuoc(text){const st=BOT.state,n=botN(text);
  if(/^(huy|thoi|dung|khong can)$/.test(n)){BOT.state=null;return botAdd("b","Đã hủy lời nhắn. Anh/chị cần hỗ trợ gì khác không?",{chips:BOT_CHIPS.slice(2,6)})}
  if(st.step===0){if(text.trim().length<10)return botAdd("b","Nội dung hơi ngắn, anh/chị mô tả rõ hơn giúp tôi (ít nhất 10 ký tự):");st.form.noiDung=text.trim().slice(0,2000);st.step=1;
    return botAdd("b","**Số điện thoại** để quản trị gọi lại (gõ \"không\" nếu không cần):",{chips:[["Không cần","không"]]})}
  let dt="";if(!/^(khong|khong can|ko|k|bo qua|thoi)$/.test(n)){dt=text.replace(/[\s.\-]/g,"");if(!/^(\+?84|0)\d{8,10}$/.test(dt))return botAdd("b","Số điện thoại chưa đúng (vd: 0901234567), anh/chị nhập lại hoặc gõ \"không\":")}
  BOT.state=null;botTyping(true);
  try{await tlApi("troly/loinhan",{noiDung:st.form.noiDung,dienThoai:dt});botTyping(false);botGesture("nod",900,"✉️");
    return botAdd("b","✉️ Đã gửi lời nhắn tới người quản trị phần mềm"+(dt?` (số gọi lại ${dt})`:"")+". Cảm ơn anh/chị!")}
  catch(e){botTyping(false);return botAdd("b",`Chưa gửi được lời nhắn: ${e.message}\nAnh/chị liên hệ trực tiếp người quản trị phần mềm nhé.`)}}
async function tlXemNhan(){if(!tlQuyen(3))return botAdd("b","Chỉ **quản trị** phần mềm mới xem được các lời nhắn gửi qua trợ lý ảo ạ.");
  botTyping(true);
  try{const r=await tlApi("troly/loinhan");botTyping(false);const ds=(r.ds||[]).slice(0,8);
    if(!ds.length)return botAdd("b","Chưa có lời nhắn nào gửi qua trợ lý ảo.");
    const s=`✉️ **Lời nhắn gửi quản trị** (${tlSo(r.chuaDoc||0)} chưa đọc):\n`+ds.map(x=>`- ${x.daDoc?"":"🆕 "}${new Date(x.luc).toLocaleString("vi-VN")} – **${tlSach(x.hoTen||x.ten)}**${x.dienThoai?" ("+x.dienThoai+")":""}: ${tlSach(x.noiDung)}`).join("\n")+"\nXem và đánh dấu đã đọc ở trang [Cài đặt](#/caidat) → mục Trợ lý ảo.";
    return botAdd("b",s)}
  catch(e){botTyping(false);return tlBaoLoi(e)}}

// ---- mở nhanh các trang của phần mềm bằng lời: "mở trang kiểm kê", "vào in tem"
const TL_TRANG=[[/\b(tong quan|trang chu|man hinh chinh)\b/,"tongquan","Tổng quan",0],[/\b(quet (ma |tem )?(qr)?|camera|quet ma|quet tem)\b/,"quet","Quét mã QR",0],[/\b(danh sach tai san|trang tai san|tai san)\b/,"ds","Tài sản",0],
  [/\b(theo don vi|don vi)\b/,"donvi","Theo đơn vị",0],[/\b(kiem ke)\b/,"kiemke","Kiểm kê",0],[/\b(dieu chuyen)\b/,"dieuchuyen","Điều chuyển",0],[/\b(hoat dong|nhat ky)\b/,"hoatdong","Hoạt động",0],
  [/\b(in tem|tem qr|in ma qr)\b/,"nhan","In tem QR",0],[/\b(nhap (tu )?excel|nhap excel|nhap du lieu)\b/,"nhap","Nhập từ Excel",2],[/\b(danh muc|loai tai san)\b/,"danhmuc","Danh mục",0],
  [/\b(tai khoan|mat khau|doi mat khau)\b/,"taikhoan","Tài khoản",0],[/\b(cai dat)\b/,"caidat","Cài đặt",3],[/\b(them tai san|tai san moi|khai bao tai san)\b/,"moi","Thêm tài sản",2]];
function tlMoTrang(n){const m=/^(mo|vao|di (toi|den)|chuyen (sang|toi|den)|toi|cho (toi|em|minh) (vao|xem trang|toi))\s+(trang\s+|man hinh\s+|muc\s+)?(.+)$/.exec(n);if(!m)return null;
  const dich=m[m.length-1].replace(/\b(giup|di|nhe|a|voi)( (toi|em|minh))?$/,"").trim();const x=TL_TRANG.find(([rx])=>rx.test(dich));if(!x)return null;
  if(!tlToken())return botAdd("b","Anh/chị **đăng nhập** trước rồi tôi mở trang **"+x[2]+"** giúp nhé.");
  if(!tlQuyen(x[3]))return botAdd("b",`Trang **${x[2]}** cần quyền cao hơn quyền của tài khoản anh/chị.`);
  location.hash="#/"+x[1];if(matchMedia("(max-width:600px)").matches)setTimeout(()=>botToggle(false),900);botGesture("nod",900,"👉");
  return botAdd("b",`👉 Đã mở trang **[${x[2]}](#/${x[1]})**.`)}

// ---- tìm tài sản khi không có câu trả lời nào khác (giống tìm bài viết liên quan của website)
async function tlTimDuPhong(text,n){if(!tlToken()||n.split(" ").length>5||n.length<3)return false;
  try{const dm=await tlDanhMuc().catch(()=>null);const dv=tlTimDonVi(n,dm),q=tlBoDonVi(n,dv);if(!q&&!dv)return false;
    const r=await tlApi("taisan"+tlQs({q,donvi:dv?dv.id:"",co:6}));if(!r.tong)return false;
    botAdd("b",`Tôi tìm thấy **${tlSo(r.tong)}** tài sản khớp «${tlSach(text)}»:\n`+tlDs(r.ds,6)+(r.tong>6?`\n[Xem đủ ${tlSo(r.tong)} tài sản](#/ds${tlQs({q,donvi:dv?dv.id:""})})`:""));return true}
  catch(e){return false}}

// ---- tìm câu trả lời trong kho kiến thức
function botKb(n){let best=null,score=0;
  for(const it of BOT.kb.items||[]){if(it.quyen&&!tlQuyen(it.quyen))continue;let s=0;for(const k of it.k||[]){const kn=botN(k);if(!kn)continue;if((" "+n+" ").includes(" "+kn+" ")||(kn.length>5&&n.includes(kn)))s+=1+kn.split(" ").length*0.7}
   if(s>score){score=s;best=it}}
  return score>=1.7?best:null}

async function botAi(){if(BOT.ai===false||!tlToken())return null;
  try{const r=await fetch("api/troly/hoi",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tlToken()},body:JSON.stringify({messages:BOT.hist.slice(-10)})});
   if(r.status===404||r.status===501){BOT.ai=false;return null}
   const j=await r.json().catch(()=>null);if(!r.ok||!j?.reply){if(j?.mode==="off")BOT.ai=false;return null}
   BOT.ai=true;return j.reply}catch(e){return null}}
async function botAnswer(text){const n=botN(text);
  if(BOT.state?.form)return tlNhanBuoc(text);
  if(BOT.state?.riddle){const r=botRiddleAnswer(n,text);if(r)return r}
  if(BOT.state?.hong){const r=await tlBaoHongBuoc(text);if(r)return r}
  if(BOT.state?.kh){const r=tlKhauHaoBuoc(n);if(r)return r}
  if(BOT.state?.tim){BOT.state=null;if(n.split(" ").length<=6&&!/\?$/.test(text.trim())){const ma=tlMa(text);return ma?tlXemMa(ma):tlTim(botN(text),text.trim())}}
  {const fun=botFun(n);if(fun)return fun}
  {const me=botSelf(n);if(me){if(me[1]==="shy"){botGesture("nod",900,me[2]);botFace("shy",2200)}else botGesture(me[1],1800,me[2]);return botAdd("b",me[0],me[3]?{chips:me[3]}:{})}}
  if(/^(xin chao|chao|hello|hi|alo|chao ban|chao em|co ai khong)\b/.test(n)&&n.length<25){const t=tlTen();return botAdd("b",`Xin chào${t?" anh/chị **"+esc(t)+"**":" anh/chị"}! Tôi là **Trợ lý ảo Hawasuco**. Anh/chị cần hỗ trợ gì về tài sản ạ?`,{chips:BOT_CHIPS})}
  if((/^(cam on|cam om|thank|thanks|tks|ok cam on|cam on nhieu|cam on ban)/.test(n)||/\b(cam on|cam om|thank you)\b/.test(n)&&n.split(" ").length<=7))return botAdd("b","Rất vui được hỗ trợ anh/chị! Cần gì thêm cứ nhắn cho tôi nhé.");
  const how=TL_HOW.test(n);
  // việc cần làm theo từng bước
  if(/\b(bao (hong|hu|su co)|ghi (nhan )?hong|bao tai san hong|(may|thiet bi|tai san) (bi )?(hong|hu) roi)\b/.test(n)&&!how)return tlBaoHongBatDau(tlMa(text));
  if(/(de lai loi nhan|gui loi nhan|nhan (cho )?quan tri|gap quan tri|lien he quan tri|gop y|phan anh|bao loi phan mem|xin (them )?quyen|nguoi that|gap nhan vien)/.test(n)&&!/xem loi nhan/.test(n))return tlNhanBatDau();
  if(/\b(xem|doc|co) (cac )?loi nhan\b|loi nhan moi/.test(n))return tlXemNhan();
  {const mo=tlMoTrang(n);if(mo)return mo}
  // tính khấu hao
  if(/\b(khau hao|gia tri con lai)\b/.test(n)&&!/\b(so nam khau hao (cua loai|mac dinh)|sua|doi|cai dat)\b/.test(n)&&!(how&&!/\d/.test(n))){const ma=tlMa(text);
    if(ma)return tlKhauHaoTs(ma);if(/\d/.test(n)||/^(tinh|tinh giup|tinh gium)/.test(n)||/\btinh khau hao\b/.test(n))return tlKhauHaoY(n)}
  // số liệu tài sản (đọc trực tiếp từ máy chủ)
  if(!how){const ma=tlMa(text);
    if(ma&&!/\b(in tem|tem trang|ma tu cap|tien to)\b/.test(n))return tlXemMa(ma);
    const coDv=tlToken()?tlTimDonVi(n,TL_DM):null;
    if(/\b(tai san|thiet bi|may)? ?(dang )?(bi )?(hong|hu|hong hoc|hu hong|can sua)\b/.test(n)&&!/\b(bao|ghi)\b/.test(n))return tlLoc("hong",coDv);
    if(/\b(dang sua|dang bao (duong|tri))\b/.test(n))return tlLoc("dangsua",coDv);
    if(/\b((den|toi|sap den|qua) han bao (duong|tri)|lich bao (duong|tri)|can bao (duong|tri)|phai bao (duong|tri))\b/.test(n))return tlLoc("baotri",coDv);
    if(/\b(lau chua kiem tra|chua kiem tra|lau khong kiem tra|chua duoc kiem tra)\b/.test(n)&&!/\bkiem ke\b/.test(n))return tlLoc("lauchuakiem",coDv);
    if(/\b(chua co anh|chua chup anh|thieu anh|khong co anh)\b/.test(n))return tlLoc("chuaanh",coDv);
    if(/\bkiem ke\b/.test(n)&&/\b(tien do|nam nay|da kiem|chua kiem|ket qua|bao nhieu|den dau|xong chua|dot|tinh hinh|con lai|phan tram)\b/.test(n))return tlKiemKe();
    if(/\b(hoat dong (gan day|moi nhat|hom nay|moi)|vua (lam|cap nhat|ghi|sua) gi|ai vua|lich su thao tac|nhat ky (thao tac|moi)|co gi moi)\b/.test(n))return tlHoatDong();
    if(/\b(bao nhieu|so luong|tong so|may (cai|chiec|tai san|may))\b/.test(n)&&!/\b(tien|gia nuoc|khoi|tuoi|nam|ngay|lan)\b/.test(n)){if(tlToken()&&!TL_DM)await tlDanhMuc().catch(()=>null);return tlDem(n)}
    if(/\b(tong quan|thong ke|tinh hinh tai san|tong gia tri|tong nguyen gia|bao cao nhanh|so lieu tai san)\b/.test(n)){if(tlToken()&&!TL_DM)await tlDanhMuc().catch(()=>null);const dv=tlTimDonVi(n,TL_DM);return dv?tlDonVi(dv):tlTongQuan()}
    if(tlToken()&&/\b(tinh hinh|tai san cua|tai san o|co nhung (tai san|gi))\b/.test(n)){if(!TL_DM)await tlDanhMuc().catch(()=>null);const dv=tlTimDonVi(n,TL_DM);if(dv)return tlDonVi(dv)}
    if(/^tim tai san$|^tra cuu tai san$|^tim kiem$|^tim$/.test(n)){BOT.state={tim:true};return botAdd("b","Anh/chị cần tìm tài sản nào? Gõ **tên** (vd \"máy bơm\"), **mã trên tem** (vd MB-00012), hoặc **nơi đặt / đơn vị** (vd \"máy phát điện đội 2\").",{chips:[["Hủy","hủy"]]})}
    if((TL_TIM_RX.test(n)||TL_ODAU_RX.test(n))&&!/\b(bai viet|tin tuc|loi nhan|huong dan)\b/.test(n)){const tu=tlTuKhoa(n);if(tu.length>=2)return tlTim(tu,tlHienTu(text))}
  }
  botTyping(true);const ai=await botAi();botTyping(false);
  if(ai){const d=botAdd("b",ai);d.classList.add("bm-ai");return}
  const it=botKb(n);
  if(it){botAdd("b",it.a,it.chips?{chips:it.chips}:it.id==="y-kien"?{chips:[["✉️ Nhắn quản trị","để lại lời nhắn"]]}:{});return}
  botTyping(true);const thay=await tlTimDuPhong(text,n);botTyping(false);if(thay)return;
  botGesture("shake",900,"🙇");BOT.sorryN=(BOT.sorryN||0)+1;
  const sorry=["Xin lỗi anh/chị, nội dung này **tôi chưa được cập nhật tới** ạ 🙏","Xin lỗi anh/chị, **tôi chưa biết câu hỏi này** ạ 🙏"][BOT.sorryN%2];
  botAdd("b",sorry+"\nAnh/chị có thể hỏi lại theo cách khác, chọn một chủ đề bên dưới, hoặc **để lại lời nhắn** cho người quản trị phần mềm.",{chips:[["✉️ Nhắn quản trị","để lại lời nhắn"],...BOT_CHIPS.slice(2,7)]})}
async function botSend(text,label,fromChip){text=String(text||"").trim();if(!text||BOT.busy)return;if(text.length>500)text=text.slice(0,500);
  BOT.busy=true;BOT_TTS.stop();botAudioCtx();botAdd("u",label||text);
  if(/c[áả]m [ơo]n|thank|tks|\bcám\b/i.test(text)){botGesture("love",1800,"💙")}else if(/^(xin )?ch[àa]o|^hello|^hi\b/i.test(text)){botGesture("wave",1500,"👋")}else if(/haha|hihi|hehe|😂|😄/i.test(text)){botGesture("giggle",1300,"😆")}
  // Bấm nút chủ đề khi đang ghi lời nhắn / báo hỏng / tính khấu hao: dừng việc đang làm và trả lời chủ đề vừa chọn (trừ các nút của chính bước đó)
  if(fromChip&&BOT.state&&!/^(hủy|đồng ý|không|chịu)$/i.test(text)){const wasForm=!!BOT.state.form,wasHong=!!BOT.state.hong;BOT.state=null;
    if(wasForm&&!/lời nhắn/.test(text))botAdd("sys","(Đã dừng ghi lời nhắn. Gõ \"để lại lời nhắn\" nếu anh/chị muốn gửi lại.)");else if(wasHong&&!/báo hỏng/.test(text))botAdd("sys","(Đã dừng báo hỏng, chưa ghi gì vào phần mềm.)")}
  try{botTyping(true);await new Promise(r=>setTimeout(r,700+Math.random()*400));botTyping(false);await botAnswer(text)}catch(e){botTyping(false);console.error(e);botGesture("shake",900,"😥");botAdd("b","Xin lỗi, tôi gặp sự cố khi xử lý câu hỏi này. Anh/chị vui lòng thử lại, hoặc **để lại lời nhắn** cho người quản trị phần mềm.")}finally{BOT.busy=false;if(!matchMedia("(pointer:coarse)").matches)document.getElementById("botIn").focus()}}
function botToggle(force){const p=document.getElementById("botPanel"),b=document.getElementById("botBtn");BOT.open=force??!BOT.open;p.hidden=!BOT.open;b.setAttribute("aria-expanded",BOT.open);b.classList.toggle("on",BOT.open);if(BOT.open)botPlacePanel();
  if(BOT.open)botGesture("jump",900,"👋");else botGesture("bye",1500);
  if(BOT.open){if(!BOT.greeted){BOT.greeted=true;const t=tlTen(),nghe=!BOT_APP&&!!(window.SpeechRecognition||window.webkitSpeechRecognition)&&(window.isSecureContext||location.hostname==="localhost");
      botAdd("sys",`Xin chào${t?" anh/chị **"+esc(t)+"**":""}! Tôi là **Trợ lý ảo Hawasuco**, trả lời tự động 24/7 về tài sản: tìm tài sản, tổng quan, tài sản hỏng, đến hạn bảo dưỡng, kiểm kê, khấu hao, cách quét / in tem QR, điều chuyển, thanh lý…\n${tlToken()?"":"(Anh/chị **đăng nhập** để tôi tra cứu được số liệu tài sản.)\n"}Anh/chị chọn chủ đề, nhập câu hỏi bên dưới${nghe||BOT_VOICE_APP.nghe?", hoặc bấm **micro 🎤** để nói.":""}${nghe?"\nBật nút **tai 👂** (góc trên) thì chỉ cần nói **\"Xin chào\"** là hỏi được, không cần bấm":""}.`,{chips:BOT_CHIPS});
      if(!BOT.wakeOpen)BOT_TTS.auto("Xin chào! Tôi là Trợ lý ảo Ha oa su cô, trả lời tự động 24/7. Anh chị cần hỗ trợ gì về tài sản ạ?");
      if(tlQuyen(3))tlApi("troly/loinhan").then(r=>{if(r&&r.chuaDoc)botAdd("sys",`✉️ Có **${r.chuaDoc}** lời nhắn mới gửi quản trị qua trợ lý ảo.`,{chips:[["Xem lời nhắn","xem lời nhắn"]]})}).catch(()=>{})}
    if(!matchMedia("(pointer:coarse)").matches)setTimeout(()=>document.getElementById("botIn").focus(),50)}}

(function botInit(){const logo="logo.png";const w=document.createElement("div");w.id="bot";w.innerHTML=`
 <button id="botBtn" class="bot-btn mascot" type="button" aria-controls="botPanel" aria-expanded="false" title="Trợ lý ảo Hawasuco – bấm để hỏi đáp">
  <span class="bm-say" id="botSay" aria-hidden="true">Xin chào! 👋</span><span class="bm-emo" id="botEmo" aria-hidden="true"></span>
  <svg class="bm-bot bm-photo" viewBox="45 20 270 330" aria-hidden="true">
   <defs><filter id="bmGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="bmGlow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <linearGradient id="bmMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset="1" stop-color="#8e9aa6"/></linearGradient></defs>
   <ellipse class="bm-shadow" cx="182" cy="334" rx="78" ry="10" fill="rgba(10,40,80,.22)"/>
   <g class="bm-body">
    <image class="bm-pleg bm-pleg-l" href="troly-robot-chan-trai.png" x="0" y="0" width="360" height="360"/>
    <image class="bm-pleg bm-pleg-r" href="troly-robot-chan-phai.png" x="0" y="0" width="360" height="360"/>
    <image href="troly-robot-than.png" x="0" y="0" width="360" height="360"/>
    <clipPath id="bmChestLogo"><circle cx="184" cy="228" r="12.2"/></clipPath>
    <circle cx="184" cy="228" r="15.5" fill="#3ee0ff" opacity=".45" filter="url(#bmGlow2)"/>
    <circle cx="184" cy="228" r="14" fill="#fff" stroke="#3ee0ff" stroke-width="2.2"/>
    <image href="${logo}" x="171.8" y="215.8" width="24.4" height="24.4" clip-path="url(#bmChestLogo)"/>
    <g class="bm-book">
     <path d="M104 230 Q143 222 182 229 Q221 222 260 230 L262 299 Q222 291 182 298 Q142 291 102 299z" fill="#135f99" stroke="#0b3d66" stroke-width="2"/>
     <path d="M182 236 Q148 228 114 234 L113 291 Q148 285 182 293z" fill="#fffdf6" stroke="#cfc6b0" stroke-width="1.4"/>
     <path d="M182 236 Q216 228 250 234 L251 291 Q216 285 182 293z" fill="#fffaf0" stroke="#cfc6b0" stroke-width="1.4"/>
     <g stroke="#9fb6c9" stroke-width="2.4" stroke-linecap="round" opacity=".8"><path d="M124 245h44M124 254h48M124 263h40M124 272h46M124 281h30"/><path d="M194 245h44M194 254h40M194 263h46M194 272h36"/></g>
     <circle cx="226" cy="280" r="6" fill="#3ee0ff" opacity=".55"/>
     <path d="M182 236V293" stroke="#b8ac90" stroke-width="2"/>
     <g class="bm-flip bm-flip1"><path d="M182 236 Q216 228 250 234 L251 291 Q216 285 182 293z" fill="#fffef9" stroke="#cfc6b0" stroke-width="1.4"/><path d="M194 247h40M194 256h44M194 265h34" stroke="#c3d2de" stroke-width="2.4" stroke-linecap="round"/></g>
     <g class="bm-flip bm-flip2"><path d="M182 236 Q216 228 250 234 L251 291 Q216 285 182 293z" fill="#fffef9" stroke="#cfc6b0" stroke-width="1.4"/><path d="M194 247h40M194 256h44M194 265h34" stroke="#c3d2de" stroke-width="2.4" stroke-linecap="round"/></g>
     <ellipse cx="103" cy="266" rx="11" ry="15" fill="#2a323b"/><ellipse cx="100" cy="260" rx="3" ry="5" fill="#fff" opacity=".25"/>
     <ellipse cx="261" cy="266" rx="11" ry="15" fill="#2a323b"/><ellipse cx="264" cy="260" rx="3" ry="5" fill="#fff" opacity=".2"/>
    </g>
    <g class="bm-look"><g class="bm-head">
     <image href="troly-robot-head.png" x="0" y="0" width="360" height="194"/>
     <g class="bm-cheeks"><ellipse cx="112" cy="168" rx="10" ry="4.6" fill="#ff9bb3" opacity=".5"/><ellipse cx="250" cy="164" rx="10" ry="4.6" fill="#ff9bb3" opacity=".5"/></g>
     <path class="bm-brow bm-brow-l" d="M0 0" /><path class="bm-brow bm-brow-r" d="M0 0"/>
     <g class="bm-gaze"><g class="bm-eyes">
      <g class="bm-e e-norm"></g><g class="bm-e e-wow"></g>
      <g class="bm-e e-read"><circle cx="135" cy="128" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="135" cy="128" r="28.5" fill="#0b1216"/><circle cx="135" cy="128" r="21" fill="none" stroke="#3ee0ff" stroke-width="5" filter="url(#bmGlow)"/><circle cx="136" cy="136" r="11" fill="#06121a"/><circle cx="139" cy="132" r="3.6" fill="#fff"/><path d="M108.3 118 A28.5 28.5 0 0 1 161.7 118 Q135 127 108.3 118z" fill="#dfe4e9"/><path d="M110 118.6 Q135 126.4 160 118.6" stroke="#3ee0ff" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="229" cy="124" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="229" cy="124" r="28.5" fill="#0b1216"/><circle cx="229" cy="124" r="21" fill="none" stroke="#3ee0ff" stroke-width="5" filter="url(#bmGlow)"/><circle cx="230" cy="132" r="11" fill="#06121a"/><circle cx="233" cy="128" r="3.6" fill="#fff"/><path d="M202.3 114 A28.5 28.5 0 0 1 255.7 114 Q229 123 202.3 114z" fill="#dfe4e9"/><path d="M204 114.6 Q229 122.4 254 114.6" stroke="#3ee0ff" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <g class="bm-e e-happy"><circle cx="135" cy="128" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="135" cy="128" r="28.5" fill="#0b1216"/><path d="M122 133 Q135 115 148 133" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#bmGlow)"/><circle cx="229" cy="124" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="229" cy="124" r="28.5" fill="#0b1216"/><path d="M216 129 Q229 111 242 129" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#bmGlow)"/></g>
      <g class="bm-e e-closed"><circle cx="135" cy="128" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="135" cy="128" r="28.5" fill="#0b1216"/><path d="M122 128 Q135 134 148 128" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#bmGlow)"/><circle cx="229" cy="124" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="229" cy="124" r="28.5" fill="#0b1216"/><path d="M216 124 Q229 130 242 124" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#bmGlow)"/></g>
      <g class="bm-e e-wink"><circle cx="229" cy="124" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="229" cy="124" r="28.5" fill="#0b1216"/><path d="M216 129 Q229 111 242 129" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#bmGlow)"/></g>
      <g class="bm-e e-heart"><circle cx="135" cy="128" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="135" cy="128" r="28.5" fill="#0b1216"/><circle cx="229" cy="124" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="229" cy="124" r="28.5" fill="#0b1216"/><g fill="#ff5c8a" filter="url(#bmGlow)"><path transform="translate(135 130) scale(2.6)" d="M0 5l-5-5a3.1 3.1 0 0 1 5-3.6 3.1 3.1 0 0 1 5 3.6z"/><path transform="translate(229 126) scale(2.6)" d="M0 5l-5-5a3.1 3.1 0 0 1 5-3.6 3.1 3.1 0 0 1 5 3.6z"/></g></g>
      <g class="bm-e e-dizzy"><circle cx="135" cy="128" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="135" cy="128" r="28.5" fill="#0b1216"/><path d="M125 118l20 20M145 118l-20 20" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#bmGlow)"/><circle cx="229" cy="124" r="31" fill="#3ee0ff" opacity=".35" filter="url(#bmGlow2)"/><circle cx="229" cy="124" r="28.5" fill="#0b1216"/><path d="M219 114l20 20M239 114l-20 20" stroke="#3ee0ff" stroke-width="5" fill="none" stroke-linecap="round" filter="url(#bmGlow)"/></g>
     </g></g>
     <g class="bm-shades"><path d="M100 110 Q102 103 112 103 L160 101 Q170 101 170 111 L168 134 Q165 152 140 152 Q110 152 103 136z" fill="#0d0f14"/><path d="M194 107 Q194 97 204 97 L252 96 Q262 96 264 103 L262 131 Q255 147 226 148 Q201 148 197 130z" fill="#0d0f14"/><path d="M170 115 Q182 108 194 112" stroke="#0d0f14" stroke-width="6" fill="none"/><path d="M112 110 L136 109 L118 132z M206 104 L230 103 L212 126z" fill="#fff" opacity=".28"/><path d="M100 112 L90 116 M264 104 L274 106" stroke="#0d0f14" stroke-width="5" stroke-linecap="round"/></g>
     ${BOT_HEADSET}
     <g class="bm-nose"><rect x="176" y="146" width="12" height="8" rx="4" fill="url(#bmMetal)" stroke="#7d8996" stroke-width="1"/><ellipse cx="179.6" cy="148.2" rx="2.4" ry="1" fill="#fff" opacity=".95"/></g>
     <g class="bm-mouth" filter="url(#bmGlow)">
      <path class="bm-m m-smile" d="M166 165 Q182 180 198 164" stroke="#3ee0ff" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g class="bm-m m-open"><path d="M164 164 Q182 167 200 163 Q197 184 182 184 Q167 184 164 164z" fill="#0b1216" stroke="#3ee0ff" stroke-width="3" stroke-linejoin="round"/><ellipse cx="182" cy="178.5" rx="9" ry="3.6" fill="#ff7aa0" opacity=".9"/></g>
      <ellipse class="bm-m m-o" cx="182" cy="172" rx="6.5" ry="8" fill="#0b1216" stroke="#3ee0ff" stroke-width="3"/>
      <path class="bm-m m-sad" d="M168 178 Q182 166 196 177" stroke="#3ee0ff" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path class="bm-m m-flat" d="M170 172 L194 170" stroke="#3ee0ff" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g class="bm-m m-tongue"><path d="M166 165 Q182 179 198 164" stroke="#3ee0ff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M177 171 Q177 184 184 184 Q191 184 190 170z" fill="#ff7aa0"/></g>
      <g class="bm-m m-talk"><rect x="168" y="164" width="28" height="14" rx="7" fill="#0b1216" stroke="#3ee0ff" stroke-width="2.8"/><path d="M174 171h.01M179 168v6M184 167v8M189 169v4M193 171h.01" stroke="#3ee0ff" stroke-width="2.6" stroke-linecap="round"/></g>
     </g>
    </g></g>
    <image class="bm-parm bm-parm-l" href="troly-robot-tay-trai.png" x="0" y="0" width="360" height="360"/>
    <image class="bm-parm bm-parm-r" href="troly-robot-tay-phai.png" x="0" y="0" width="360" height="360"/>
   </g>
  </svg>
  <span class="bm-label">Hỏi đáp</span>
 </button>
 <section id="botPanel" class="bot-panel" hidden aria-label="Trợ lý ảo Hawasuco">
  <header><span class="bot-av" id="botAv">${botAvatar()}<i class="bot-on"></i></span><div><b>Trợ lý ảo Hawasuco</b><small id="botStat">Trả lời tự động 24/7</small></div><button type="button" id="botWake" class="bot-spk bot-wake" aria-pressed="false" title="Rảnh tay: bật để chỉ cần nói &quot;Xin chào&quot; là hỏi được" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9.5a4.5 4.5 0 0 1 9 0c0 2.6-2.4 3.4-2.9 5.6-.4 1.9-1.4 3.4-3.6 3.4A3 3 0 0 1 7.5 17" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M10.5 10a2 2 0 0 1 4 .2c0 1-.8 1.4-1.4 2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/><path class="ear-x" d="M4 4l16 16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button><button type="button" id="botSpk" class="bot-spk" aria-pressed="false" title="Bật đọc câu trả lời bằng giọng nói AI tiếng Việt"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path class="spk-w" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/><path class="spk-x" d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></button><button type="button" id="botX" aria-label="Đóng">×</button></header>
  <div id="botMsgs" class="bot-msgs" aria-live="polite"></div>
  <form id="botF" class="bot-f"><input id="botIn" maxlength="500" autocomplete="off" placeholder="Nhập câu hỏi…" aria-label="Câu hỏi"><button type="button" id="botMic" class="bot-mic" aria-label="Nói câu hỏi bằng giọng nói" title="Bấm để nói (tiếng Việt)" hidden><svg viewBox="0 0 24 24"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15z" fill="currentColor"/><path d="M18.5 11.5a6.5 6.5 0 0 1-13 0M12 18v3.2M8.5 21.2h7" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg></button><button aria-label="Gửi"><svg viewBox="0 0 24 24"><path d="M3 20l18-8L3 4v6l12 2-12 2z" fill="currentColor"/></svg></button></form>
  <p class="bot-note">Trợ lý ảo có thể trả lời chưa chính xác. Số liệu chính thức xem trên các trang của phần mềm.</p>
 </section>`;document.body.appendChild(w);
 document.getElementById("botBtn").onclick=()=>{if(BOT.noClick){BOT.noClick=false;return}botToggle()};document.getElementById("botX").onclick=()=>{BOT_TTS.stop();botToggle(false)};
 document.getElementById("botF").onsubmit=e=>{e.preventDefault();const i=document.getElementById("botIn");const t=i.value;i.value="";botSend(t)};
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&BOT.open)botToggle(false)});
 // Kho kiến thức: troly-kien-thuc.json (máy chủ dùng bản trong thư mục dữ liệu …\tro-ly-ao\kien-thuc.json nếu quản trị đã sửa)
 const nap=async()=>{try{const r=await fetch("troly-kien-thuc.json",{cache:"no-cache"});if(r.ok){const j=await r.json();if(Array.isArray(j.items)&&j.items.length)BOT.kb=j}}catch(e){}};
 setTimeout(nap,300);
 addEventListener("troly-caidat",()=>{BOT.ai=null});
 fetch("api/ping",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(j&&j.congTy)BOT.congTy=j.congTy;BOT.giongDoc=!!(j&&j.troLy&&j.troLy.giongDoc);if(j&&j.troLy&&j.troLy.ai===false&&BOT.ai===null)BOT.ai=false}).catch(()=>{});
 // đang quét QR: tạm ẩn linh vật (khung camera chiếm màn hình); trong app Android: thêm lớp để chỉnh bố cục
 const quet=()=>w.classList.toggle("an-quet",/^#\/quet/.test(location.hash));quet();addEventListener("hashchange",quet);
 if(BOT_APP)document.documentElement.classList.add("trong-app")})();
// ---- Rê chuột vào liên kết tài sản trong khung chat: hiện thẻ xem nhanh (ảnh, tình trạng, đơn vị) bên cạnh – như xem trước hóa đơn của website
(function botTsPreview(){
  const canHover=matchMedia("(hover:hover) and (pointer:fine)").matches;
  let box=null,cur=0,tShow=0,tHide=0;const cache={},anh={};
  const idCua=a=>{const m=a&&a.matches&&a.matches('#botMsgs a[href^="#/ts/"]')?/^#\/ts\/(\d+)/.exec(a.getAttribute("href")):null;return m?+m[1]:0};
  function build(){box=document.createElement("div");box.id="tsPrev";box.hidden=true;box.setAttribute("role","dialog");box.setAttribute("aria-label","Xem nhanh tài sản");document.body.appendChild(box);
    box.addEventListener("mouseenter",()=>clearTimeout(tHide));box.addEventListener("mouseleave",()=>{tHide=setTimeout(hide,400)})}
  function place(a){const p=document.getElementById("botPanel");if(!p)return;const r=p.getBoundingClientRect(),ra=a.getBoundingClientRect(),w=300;
    let left=r.right+12;if(left+w>innerWidth-8)left=r.left-w-12;if(left<8)left=Math.max(8,Math.min(innerWidth-w-8,ra.left));
    box.style.left=left+"px";box.style.top=Math.max(8,Math.min(innerHeight-box.offsetHeight-8,ra.top-40))+"px"}
  function the(d,src){const tt=TL_TT[d.tinhTrang]||d.tinhTrang||"",mau={tot:"#0ca30c",theodoi:"#d99a0e",hong:"#d03b3b",dangsua:"#ec835a",mat:"#d03b3b"}[d.tinhTrang]||"#8a8f98";
    return `<div class="tsp-h"><span>${esc(d.ma)} · ${esc(d.ten)}</span></div>`+(src?`<img class="tsp-anh" alt="Ảnh tài sản" src="${src}">`:d.soAnh?'<div class="tsp-khong">Đang tải ảnh…</div>':'<div class="tsp-khong">Chưa có ảnh</div>')+
      `<div class="tsp-b"><b>${esc(d.tenLoai||"")}</b><span>${esc(d.tenDonVi||"Chưa giao đơn vị")}${d.viTri?" – "+esc(d.viTri):""}</span><span><i class="tsp-tt" style="background:${mau}">${esc(tt)}</i></span>`+
      `<span>Kiểm tra lần cuối: ${d.kiemTraCuoi?esc(tlNgay(d.kiemTraCuoi)):"chưa có"}</span>${d.hanBaoTri?`<span>Hạn bảo dưỡng: ${esc(tlNgay(d.hanBaoTri))}</span>`:""}${d.nguyenGia?`<span>Nguyên giá: ${esc(tlTien(d.nguyenGia))}</span>`:""}</div>`}
  async function show(a,id){if(!box)build();cur=id;box.innerHTML='<div class="tsp-h"><span>Xem nhanh tài sản</span></div><div class="tsp-ld">Đang tải…</div>';box.hidden=false;place(a);
    try{const d=cache[id]||(cache[id]=await tlApi("taisan/"+id));if(cur!==id)return;box.innerHTML=the(d,anh[id]);place(a);
      if(d.anhChinh&&!anh[id]){const r=await fetch("api/anh/"+id+"/"+encodeURIComponent(d.anhChinh)+"?nho=1",{headers:{"Authorization":"Bearer "+tlToken()}});
        if(r.ok){anh[id]=URL.createObjectURL(await r.blob());if(cur===id&&!box.hidden){box.innerHTML=the(d,anh[id]);place(a)}}}}
    catch(e){if(cur===id)box.innerHTML='<div class="tsp-h"><span>Xem nhanh tài sản</span></div><div class="tsp-ld">'+esc(e.message.replace(/\*\*/g,""))+"</div>"}}
  function hide(){cur=0;if(box)box.hidden=true}
  if(canHover){
    document.addEventListener("mouseover",e=>{const a=e.target.closest&&e.target.closest("a"),id=idCua(a);if(!id)return;clearTimeout(tHide);clearTimeout(tShow);tShow=setTimeout(()=>show(a,id),350)});
    document.addEventListener("mouseout",e=>{const a=e.target.closest&&e.target.closest("a");if(!idCua(a))return;clearTimeout(tShow);tHide=setTimeout(hide,500)});
  }
  document.addEventListener("keydown",e=>{if(e.key==="Escape")hide()});
  document.addEventListener("click",e=>{if(e.target.closest&&(e.target.closest("#botX")||e.target.closest('#botMsgs a[href^="#/"]')))hide()});
  addEventListener("hashchange",hide);
})();


// ---- Linh vật trợ lý ảo: câu chào kèm động tác, nhìn theo chuột, ngủ gật khi lâu không ai dùng
(function botMascotLife(){
  const msgs=[["Xin chào! 👋","wave"],["Cần tìm tài sản nào ạ?","nod","🔎"],["Hỏi em tài sản hỏng nhé!","cheer","🔧"],["Kiểm kê tới đâu rồi ta?","jump","📋"],["Em trực 24/7 nè!","dance","✨"],["Bấm vào em để hỏi nha!","love","💙"],["Xem em xoay nè! 🌀","spin"],["Nhớ dán tem QR nha!","giggle","🏷️"],["Nói với em cũng được nè 🎤","wink"],["Uống đủ nước chưa ạ? 🥤","shy"]];
  const still=matchMedia("(prefers-reduced-motion: reduce)").matches;let i=0,last=Date.now(),sleeping=false;
  const btn=()=>document.getElementById("botBtn");
  const say=(t,ms=4500)=>{const el=document.getElementById("botSay");if(!el)return;el.textContent=t;el.classList.add("show");clearTimeout(say.t);say.t=setTimeout(()=>el.classList.remove("show"),ms)};
  const tick=()=>{const b=btn();if(!b||sleeping||document.hidden)return;
    if(b.classList.contains("on")){document.getElementById("botSay")?.classList.remove("show");return}
    const [t,g,emo]=msgs[i++%msgs.length];say(t);if(g==="wink"||g==="shy"){botGesture("nod",900);botFace(g,2200);if(emo)botEmote(emo)}else if(g==="spin"){botGesture("spin",950);setTimeout(()=>botFace("dizzy",1300),950)}else botGesture(g,1800,emo)};
  setTimeout(tick,2500);setInterval(tick,12000);
  // ngủ gật sau 60 giây không thao tác; có thao tác thì thức dậy
  const wake=()=>{last=Date.now();if(!sleeping)return;sleeping=false;botState("sleep",false);document.getElementById("botEmo")?.classList.remove("loop");botGesture("jump",900,"😃");say("A, anh/chị đây rồi!",3000)};
  ["pointermove","keydown","scroll","touchstart"].forEach(ev=>addEventListener(ev,wake,{passive:true}));
  setInterval(()=>{const b=btn();if(!still&&b&&!sleeping&&!BOT.open&&!BOT.busy&&Date.now()-last>60000){sleeping=true;document.getElementById("botSay")?.classList.remove("show");botState("sleep",true);botEmote("💤",true)}},5000);
  // đầu nghiêng nhẹ theo con trỏ chuột
  if(!still&&matchMedia("(hover:hover) and (pointer:fine)").matches){let raf=0,mx=0,my=0;
    addEventListener("pointermove",e=>{mx=e.clientX;my=e.clientY;if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const b=btn(),lk=b&&b.querySelector(".bm-look");if(!lk)return;
      const r=b.getBoundingClientRect(),dx=mx-(r.left+r.width/2),dy=my-(r.top+r.height*.35);
      const rot=Math.tanh(dx/350)*9,up=Math.max(-3,Math.min(2,dy/120));lk.style.transform=`translateY(${up.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`})},{passive:true})}
  // rê chuột vào thì vẫy tay chào
  setTimeout(()=>{const b=btn();if(!b)return;let ht=0;
    b.addEventListener("mouseenter",()=>{if(!b.classList.contains("on")&&!b.dataset.g)botGesture("wave",1400);botFace("wink",1200);clearTimeout(ht);ht=setTimeout(()=>{botGesture("giggle",1300,"😆");say("Hihi, nhột quá!",2200)},2600)});
    b.addEventListener("mouseleave",()=>clearTimeout(ht))},500);
  // chớp mắt tự nhiên
  (function blink(){setTimeout(()=>{const b=btn();if(b&&!still){b.classList.add("blink");setTimeout(()=>b.classList.remove("blink"),130);if(Math.random()<.25)setTimeout(()=>{b.classList.add("blink");setTimeout(()=>b.classList.remove("blink"),130)},260)}blink()},2200+Math.random()*3200)})();
  // mắt nhìn theo con trỏ; không có chuột thì thỉnh thoảng đảo mắt nhìn quanh
  const gaze=(x,y)=>{const g=btn()?.querySelector(".bm-gaze");if(g)g.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`};
  let lastMove=0;
  addEventListener("pointermove",e=>{if(still)return;lastMove=Date.now();const b=btn();if(!b)return;const r=b.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height*.3);
    gaze(Math.max(-3,Math.min(3,dx/90)),Math.max(-2.5,Math.min(2.5,dy/110)))},{passive:true});
  setInterval(()=>{if(still||Date.now()-lastMove<4000)return;const k=Math.random();gaze(k<.3?-2.5:k<.6?2.5:0,Math.random()<.3?-2:0)},3500);
})();

// ---- Nhập câu hỏi bằng giọng nói (Chrome, Edge, Safari; cần HTTPS). Trong app Android: nhận dạng giọng nói tiếng Việt của Android
//      (cầu nối batNghe / dungNghe, app gọi lại window.ungDungNghe({tam|xong|loi|het})) – chạy cả khi máy chủ chưa có HTTPS.
(function botVoice(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const init=()=>{const mic=document.getElementById("botMic"),inp=document.getElementById("botIn");if(!mic||!inp)return setTimeout(init,300);
    const app=BOT_VOICE_APP.nghe,web=!app&&!BOT_APP&&!!SR&&(window.isSecureContext||location.hostname==="localhost");   // WebView của app có webkitSpeechRecognition nhưng không dùng được: luôn dùng của Android
    if(!web&&!app)return;   // trình duyệt không nhận dạng được giọng nói (hoặc chưa có HTTPS)
    mic.hidden=false;let rec=null,on=false,finalTxt="",keep="";
    window.botMicStart=()=>{if(!on&&!BOT.busy)mic.onclick()};window.botMicOn=()=>on;
    const stop=()=>{if(app){try{BOT_APP.dungNghe()}catch(e){}return}try{rec&&rec.stop()}catch(e){}};
    const setOn=v=>{if(on&&!v)botGesture("nod",900);on=v;botState("listen",v);if(v)botEmote("🎤");mic.classList.toggle("on",v);mic.setAttribute("aria-label",v?"Đang nghe – bấm để dừng":"Nói câu hỏi bằng giọng nói");inp.placeholder=v?"Đang nghe… Anh/chị nói câu hỏi":"Nhập câu hỏi…"};
    const show=(fin,interim)=>{inp.value=((keep?keep+" ":"")+fin+interim).replace(/\s+/g," ").trim()};
    const done=()=>{const txt=inp.value.trim();setOn(false);if(finalTxt.trim()&&txt){inp.value="";BOT_TTS.fromMic();botSend(txt)}};   // nói xong tự gửi câu hỏi
    const LOI={"not-allowed":app?"App chưa được phép dùng micro. Anh/chị vào Cài đặt điện thoại → Ứng dụng → Quản lý tài sản → Quyền → cho phép Micrô, rồi thử lại.":"Trình duyệt chưa cho phép dùng micro. Anh/chị bấm biểu tượng ổ khóa trên thanh địa chỉ → cho phép Micro, rồi thử lại.","service-not-allowed":"Trình duyệt chưa cho phép dùng micro.","no-speech":"Tôi chưa nghe thấy gì. Anh/chị bấm micro và nói lại nhé.","audio-capture":"Không tìm thấy micro trên thiết bị.","network":"Nhận dạng giọng nói cần kết nối Internet. Anh/chị vui lòng thử lại.","khong-ho-tro":"Điện thoại này chưa có dịch vụ nhận dạng giọng nói (cần ứng dụng Google). Anh/chị gõ câu hỏi giúp tôi nhé."};
    if(app)window.ungDungNghe=o=>{if(!o||!on)return;
      if(o.loi){setOn(false);const m=LOI[o.loi];if(m)botAdd("sys",m);return}
      if(o.tam!=null)show(finalTxt,String(o.tam));
      if(o.xong!=null){finalTxt=String(o.xong);show(finalTxt,"");done();return}
      if(o.het)done()};
    mic.onclick=()=>{if(on){stop();return}BOT_TTS.stop();if(typeof BOT_WAKE!=="undefined")BOT_WAKE.pause();finalTxt="";keep=inp.value.trim();
      if(app){setOn(true);try{BOT_APP.batNghe()}catch(e){setOn(false)}return}
      rec=new SR();rec.lang="vi-VN";rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=1;
      rec.onresult=e=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)finalTxt+=t;else interim+=t}show(finalTxt,interim)};
      rec.onerror=e=>{setOn(false);const m=LOI[e.error];if(m)botAdd("sys",m)};
      rec.onend=done;
      try{rec.start();setOn(true);inp.focus()}catch(e){setOn(false)}};
    document.getElementById("botX")?.addEventListener("click",stop)};
  init()})();


// ---- Kéo thả trợ lý ảo đến chỗ khác (chuột hoặc ngón tay); nhớ vị trí trên máy; bấm đúp để về chỗ cũ
const BOT_POS_KEY="qlts_bot_pos";
function botPlacePanel(){const b=document.getElementById("botBtn"),p=document.getElementById("botPanel");if(!b||!p)return;
  const custom=b.classList.contains("moved");b.classList.toggle("flip",custom&&b.getBoundingClientRect().left+48>innerWidth/2);
  if(!custom||innerWidth<=600){p.style.cssText="";return}
  const r=b.getBoundingClientRect(),W=Math.min(370,innerWidth-24),gap=10,clamp=(v,a,z)=>Math.max(a,Math.min(z,v));
  let left,top,h;
  if(r.top-gap>=360){h=Math.min(560,r.top-gap-12);top=r.top-gap-h;left=clamp(r.left,12,innerWidth-W-12)}   // phía trên linh vật
  else if(innerHeight-r.bottom-gap>=360){top=r.bottom+gap;h=Math.min(560,innerHeight-top-12);left=clamp(r.left,12,innerWidth-W-12)}   // phía dưới
  else{h=Math.min(560,innerHeight-24);top=clamp(r.top+r.height-h,12,innerHeight-h-12);left=innerWidth-r.right-gap>=W+12?r.right+gap:Math.max(12,r.left-gap-W)}   // bên cạnh
  Object.assign(p.style,{left:left+"px",top:top+"px",bottom:"auto",right:"auto",width:W+"px",height:h+"px"})}
(function botDrag(){
  const init=()=>{const b=document.getElementById("botBtn");if(!b)return setTimeout(init,200);
    const clampPos=(x,y)=>{const r=b.getBoundingClientRect();return[Math.max(0,Math.min(innerWidth-r.width,x)),Math.max(0,Math.min(innerHeight-r.height,y))]};
    const setPos=(x,y)=>{[x,y]=clampPos(x,y);Object.assign(b.style,{left:x+"px",top:y+"px",bottom:"auto",right:"auto"});b.classList.add("moved")};
    const save=()=>{const r=b.getBoundingClientRect();try{localStorage.setItem(BOT_POS_KEY,JSON.stringify({x:(r.left+r.width/2)/innerWidth,y:(r.top+r.height/2)/innerHeight}))}catch(e){}};
    const restore=()=>{let v=null;try{v=JSON.parse(localStorage.getItem(BOT_POS_KEY)||"null")}catch(e){}
      if(!v||typeof v.x!=="number"){return}const r=b.getBoundingClientRect();setPos(v.x*innerWidth-r.width/2,v.y*innerHeight-r.height/2)};
    const reset=()=>{b.style.left=b.style.top=b.style.bottom=b.style.right="";b.classList.remove("moved","flip");try{localStorage.removeItem(BOT_POS_KEY)}catch(e){}botPlacePanel()};
    let st=null;b.draggable=false;b.addEventListener("dragstart",e=>e.preventDefault());
    b.addEventListener("pointerdown",e=>{if(e.button!==0)return;const r=b.getBoundingClientRect();st={id:e.pointerId,sx:e.clientX,sy:e.clientY,ox:e.clientX-r.left,oy:e.clientY-r.top,drag:false};if(e.pointerType==="mouse")e.preventDefault();try{b.setPointerCapture(e.pointerId)}catch(x){}});
    addEventListener("pointermove",e=>{if(!st||e.pointerId!==st.id)return;
      if(!st.drag){if(Math.hypot(e.clientX-st.sx,e.clientY-st.sy)<7)return;st.drag=true;try{b.setPointerCapture(e.pointerId)}catch(x){}b.classList.add("dragging");botState("drag",true);botEmote("😲");document.getElementById("botSay")?.classList.remove("show")}
      e.preventDefault();setPos(e.clientX-st.ox,e.clientY-st.oy);if(BOT.open)botPlacePanel()});
    const end=e=>{if(!st||e.pointerId!==st.id)return;const was=st.drag;st=null;if(!was)return;
      BOT.noClick=true;setTimeout(()=>BOT.noClick=false,350);b.classList.remove("dragging");botState("drag",false);botGesture("jump",800,"😄");save();botPlacePanel()};
    addEventListener("pointerup",end);addEventListener("pointercancel",end);
    b.addEventListener("dblclick",e=>{if(b.classList.contains("moved")){e.preventDefault();reset();botGesture("nod",900,"🏠")}});
    addEventListener("resize",()=>{if(b.classList.contains("moved"))restore();botPlacePanel()});
    restore();b.title="Trợ lý ảo Hawasuco – bấm để hỏi đáp, giữ và kéo để di chuyển (bấm đúp để về chỗ cũ)"};
  init()})();


// ---- Đọc câu trả lời bằng giọng nói AI tiếng Việt – cùng bộ đọc với website và phần mềm Nhân sự - Chấm công (qlns.capnuochaugiang.vn):
//      mô hình Piper vi_VN-vais1000-medium chạy ngay trong trình duyệt (ONNX Runtime Web) + eSpeak NG phiên âm, không gửi văn bản ra ngoài.
//      Tệp đặt ở thư mục giong-doc\ cạnh QuanLyTaiSan.exe (TAI-GIONG-AI.bat tải từ máy chủ QLNS). Chưa có tệp: dùng giọng tiếng Việt
//      của trình duyệt; trong app Android: giọng đọc tiếng Việt của Android (cầu nối docChu).
const BOT_TTS=(function(){
  const KEY="qlts_bot_doc",mobile=matchMedia("(pointer:coarse)").matches;
  let on=true;try{on=sessionStorage.getItem(KEY)!=="0"}catch(e){}
  let mode=null,ready=null,queue=[],micUntil=0,aiShown=false;
  const hasWeb=()=>"speechSynthesis" in window&&typeof SpeechSynthesisUtterance==="function";
  const viVoice=()=>hasWeb()?speechSynthesis.getVoices().filter(v=>/^vi([-_]|$)/i.test(v.lang)).sort((a,b)=>(/natural|neural|online/i.test(b.name))-(/natural|neural|online/i.test(a.name)))[0]||null:null;
  if(hasWeb())try{speechSynthesis.getVoices();speechSynthesis.addEventListener("voiceschanged",()=>{})}catch(e){}
  const aiOk=()=>!!(window.App&&App.GiongAI&&App.GiongAI.coThe());
  const load=src=>new Promise((ok,no)=>{const sc=document.createElement("script");sc.src=src;sc.onload=ok;sc.onerror=()=>no(new Error(src));document.head.appendChild(sc)});
  function stat(t){const s=document.getElementById("botStat");if(!s||s.classList.contains("busy"))return;s.textContent=t||"Trả lời tự động 24/7"}
  function prepare(){
    if(ready)return ready;
    ready=(async()=>{
      // máy tính: ưu tiên giọng AI; điện thoại có sẵn giọng tiếng Việt thì dùng giọng máy cho nhẹ (giọng AI cần tải ~63 MB lần đầu)
      if(!(mobile&&(viVoice()||BOT_VOICE_APP.doc))){
        try{if(BOT.giongDoc===undefined)await new Promise(r=>setTimeout(r,600));const r=BOT.giongDoc===false?{ok:false}:await fetch("giong-doc/giongai.js",{method:"HEAD",cache:"no-cache"});
          if(r.ok){window.App=window.App||{};for(const f of["giongdoc-vi.js","giongdoc.js","giongai-ort.js","giongai.js"])await load("giong-doc/"+f);
            if(aiOk()){mode="ai";App.GiongAI.theoDoi(t=>{if(t.trangThai==="dangtai")stat("Đang tải giọng đọc AI… "+t.tienDo+"%");else if(t.trangThai==="san"&&!aiShown){aiShown=true;stat("")}else if(t.trangThai==="loi"){stat("");mode=BOT_VOICE_APP.doc?"app":hasWeb()?"web":null}});return}}}catch(e){}
      }
      mode=BOT_VOICE_APP.doc?"app":hasWeb()?"web":null})();
    return ready}
  function setOn(v,quiet){on=v;try{sessionStorage.setItem(KEY,v?"1":"0")}catch(e){}const b=document.getElementById("botSpk");if(b){b.classList.toggle("on",v);b.setAttribute("aria-pressed",v);b.title=v?"Đang bật đọc câu trả lời – bấm để tắt":"Bật đọc câu trả lời bằng giọng nói AI tiếng Việt"}
    if(quiet)return;
    if(v)prepare().then(()=>{if(!mode){botAdd("sys","Trình duyệt này chưa đọc được tiếng Việt. Anh/chị vẫn xem câu trả lời bằng chữ nhé.");setOn(false)}else if(mode==="ai"&&App.GiongAI.trangThai().trangThai!=="san")App.GiongAI.tai().catch(()=>{})});else stop()}
  // chữ để đọc: bỏ định dạng, đọc số tiền, số điện thoại, ngày tháng, chữ viết tắt cho dễ nghe
  const DIGITS=x=>x.split("").join(" ");
  const ABBR=[["CTN-CTĐT","của Công ty"],["QR","kiu a"],["GPS","gi pi ét"],["Excel","ếch xeo"],["Android","an đờ roi"],["IIS","ai ai ét"],["AI","ây ai"],["HTTPS","hát tê tê pê ét"],["Hotline","đường dây nóng"],["hotline","đường dây nóng"],["online","trực tuyến"],["website","trang web"],["Website","Trang web"],["app","ứng dụng"],["Zalo","Da lô"],["Mobile Banking","ngân hàng di động"],["Internet Banking","ngân hàng trực tuyến"],["HAWASUCO","Ha oa su cô"],["Hawasuco","Ha oa su cô"],["BVMT","bảo vệ môi trường"],["IDKH","I Đê Ka Hát"],["CSKH","chăm sóc khách hàng"],["UBND","Ủy ban nhân dân"],["NĐ-CP","Nghị định Chính phủ"],["QĐ","quyết định"],["HĐ","hợp đồng"],["TB-SCT","thông báo của Sở Công Thương"],["SCT","Sở Công Thương"],["VAT","thuế giá trị gia tăng"],["HCSN","hành chính sự nghiệp"],["SH","sinh hoạt"],["KD","kinh doanh"],["SX","sản xuất"],["OTP","ô tê pê"],["PDF","pê đê ép"],["SCADA","sờ ca đa"],["HDPE","hát đê pê e"],["uPVC","u pê vê xê"],["TP","thành phố"],["KV","khu vực"]];
  function text(md){
    let t=String(md||"").replace(/([Aa]nh)\/chị/g,"$1 chị").replace(/(\d+)\/(\d+)\s*tài sản/g,"$1 trên $2 tài sản").replace(/[▓░]+/g,"").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/\*\*|!!|__|`/g,"").replace(/^\s*[-•]\s+/gm,"").replace(/\n+/g,". ");
    t=t.replace(/24\/7/g,"24 trên 7").replace(/\b1900\s?(\d{4})\b/g,(_,b)=>DIGITS("1900")+", "+DIGITS(b))
      .replace(/\b(0\d{3,4})[.\s](\d{3})[.\s]?(\d{3,4})\b/g,(_,a,b,c)=>DIGITS(a)+", "+DIGITS(b)+", "+DIGITS(c)).replace(/\b(0\d{3,4})\.(\d{7})\b/g,(_,a,b)=>DIGITS(a)+", "+DIGITS(b));
    t=t.replace(/(\d+)\/QĐ-CTN-CTĐT/g,"số $1 của Công ty").replace(/\b\d{6,}\b/g,DIGITS);
    t=t.replace(/(\d{1,3})((?:\.\d{3})+)(?!\d)/g,(_,a,b)=>a+b.replace(/\./g,""))
      .replace(/(\d{1,4})\/(\d{4})\/([\p{L}\-]+)/gu,"$1, năm $2, $3").replace(/(\d{1,4})\/([\p{Lu}][\p{L}\-]*)/gu,"$1, $2")
      .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g,"ngày $1 tháng $2 năm $3").replace(/kỳ (\d{1,2})\/(\d{4})/g,"kỳ tháng $1 năm $2").replace(/(\d{1,2})\/(\d{4})/g,"tháng $1 năm $2")
      .replace(/đồng\/m³/g,"đồng một mét khối").replace(/đ\/m³/g,"đồng một mét khối").replace(/(\d)\s?m(?![\p{L}³²])/gu,"$1 mét").replace(/m³/g," mét khối").replace(/(\d) ?đ(?![\p{L}])/gu,"$1 đồng").replace(/(\d),(\d)/g,"$1 phẩy $2").replace(/(\d)\s?%/g,"$1 phần trăm")
      .replace(/Ø\s?/g,"phi ").replace(/(\d)\s?–\s?(\d)/g,"$1 đến $2").replace(/(\d)\s?-\s?(\d)/g,"$1 đến $2").replace(/\p{Extended_Pictographic}|️/gu,"")
      .replace(/→/g,", sang ").replace(/[–·•]/g,", ").replace(/×/g," nhân ").replace(/=/g," bằng ").replace(/[“”"*_()]/g," ");
    ABBR.forEach(([a,b])=>{t=t.replace(new RegExp("(^|[^\\p{L}\\p{N}])"+a+"(?=[^\\p{L}]|$)","gu"),"$1"+b+" ")});
    t=t.replace(/([\p{L}\d])-(?=\p{L})/gu,"$1 ").replace(/(ngày|tháng|năm) \1 /g,"$1 ").replace(/(\s*\.\s*){2,}/g,". ").replace(/:\s*\./g,":").replace(/\s+/g," ").replace(/\s+([.,:;?!])/g,"$1").replace(/,\s*,/g,",").trim();
    if(t.length>650){const c=t.slice(0,650),k=c.lastIndexOf(". ");t=(k>250?c.slice(0,k+1):c)+" Mời anh chị xem chi tiết trên màn hình."}
    return t}
  function speaking(v){BOT.speaking=v;if(v&&typeof BOT_WAKE!=="undefined")BOT_WAKE.pause();botState("talk",v);const b=document.getElementById("botSpk");if(b)b.classList.toggle("talking",v)}
  let idle=[],cur=null;
  function next(){cur=null;clearTimeout(guard);speaking(false);const n=queue.shift();if(n)return play(n);const f=idle;idle=[];f.forEach(x=>{try{x()}catch(e){}})}
  let guard=0;
  function play(t){
    speaking(true);clearTimeout(guard);const my=t;guard=setTimeout(()=>{if(BOT.speaking&&cur===my){cur=null;stop()}},t.length*110+8000);cur=t;
    if(mode==="ai"){App.GiongAI.noi(t,{toc:1,xong:next,loi:()=>{if(BOT_VOICE_APP.doc||hasWeb()){mode=BOT_VOICE_APP.doc?"app":"web";play(t)}else next()}});return}
    if(mode==="app"){window.ungDungDocXong=()=>{if(cur===my)next()};try{BOT_APP.docChu(t)}catch(e){next()}return}
    if(mode==="web"){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang="vi-VN";const v=viVoice();if(v)u.voice=v;u.rate=1;u.onend=u.onerror=next;speechSynthesis.speak(u)}catch(e){next()}return}
    speaking(false)}
  function say(md,now){const t=text(md);if(!t)return;
    prepare().then(()=>{if(!mode){if(now)botAdd("sys","Trình duyệt này chưa đọc được tiếng Việt.");return}if(now){stop();play(t)}else if(BOT.speaking)queue.push(t);else play(t)})}
  function stop(){queue=[];cur=null;clearTimeout(guard);const f=idle;idle=[];if(mode==="ai"&&window.App&&App.GiongAI)App.GiongAI.dung();if(mode==="app")try{BOT_APP.dungDoc()}catch(e){}if(hasWeb())try{speechSynthesis.cancel()}catch(e){}if(BOT.speaking)speaking(false);f.forEach(x=>{try{x()}catch(e){}})}
  function init(){const b=document.getElementById("botSpk");if(!b)return setTimeout(init,300);
    if(!hasWeb()&&!BOT_VOICE_APP.doc&&!(window.WebAssembly&&window.Worker)){b.hidden=true;return}
    b.onclick=()=>setOn(!on);setOn(on,true)}   // chỉ nạp bộ đọc khi thật sự cần đọc (không làm chậm trang)
  init();
  // đọc ngay một câu rồi gọi cb khi đọc xong (không đọc được thì gọi cb luôn)
  function sayThen(md,cb){const t=text(md);prepare().then(()=>{if(!mode||!t)return cb&&cb(false);stop();if(cb)idle.push(()=>cb(true));play(t)})}
  return{say,stop,sayThen,isOn:()=>on,auto:md=>{if(on||Date.now()<micUntil)say(md)},fromMic:()=>{micUntil=Date.now()+20000},text}
})();


// ---- Rảnh tay: nói "Xin chào" để bắt đầu hỏi đáp bằng giọng nói (nhận dạng giọng nói của trình duyệt, cần HTTPS + cho phép micro).
//      Chỉ nghe khi khách tự bật (nút tai ở đầu khung chat); trình duyệt nhớ lựa chọn và tự nghe lại ở lần sau nếu đã cho phép micro.
const BOT_WAKE=(function(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition,KEY="qlts_bot_wake";
  let want=false,rec=null,running=false,lastErr=0,fails=0;try{want=localStorage.getItem(KEY)==="1"}catch(e){}
  // câu kích hoạt "Xin chào" (kèm hoặc không kèm "Hawasuco", "trợ lý", "bạn", "em"…); vẫn nhận "Chào Hawasuco"
  const WAKE=/\b(xin|sin|sinh|xinh) ?chao\b(\s+(hawa\s*su\s*co|ha\s*oa\s*su\s*co|hoa\s*su\s*co|hawasuco|tro ly( ao)?|ban|em|anh|chi|robot))?|\bchao\s*(h|w|o|u)[a-z\s]{0,8}?(su|xu|si|sy)\s*(co|ko|cu|coc|kho)\b/;
  function heard(raw){const n=botN(raw);const m=WAKE.exec(n);if(!m)return null;return{rest:n.slice(m.index+m[0].length).trim(),raw}}
  function label(v){const b=document.getElementById("botBtn"),l=b&&b.querySelector(".bm-label");if(b)b.classList.toggle("wake",v);if(l)l.textContent=v?"Nói: Xin chào":"Hỏi đáp"}
  function ui(){const b=document.getElementById("botWake");if(!b)return;b.classList.toggle("on",want);b.setAttribute("aria-pressed",want);
    b.title=want?"Đang bật rảnh tay – chỉ cần nói \"Xin chào\" (bấm để tắt)":"Rảnh tay: bật để chỉ cần nói \"Xin chào\" là hỏi được";label(want&&running)}
  // bong bóng nhỏ trên robot: chữ vừa nghe được (khách biết trợ lý đang nghe, nói lại cho rõ nếu sai)
  let hintT=0;function hint(tx){const el=document.getElementById("botSay"),b=document.getElementById("botBtn");if(!el||!b||b.classList.contains("on"))return;
    el.textContent="👂 "+String(tx).trim().slice(-40);el.classList.add("show");clearTimeout(hintT);hintT=setTimeout(()=>el.classList.remove("show"),1800)}
  function stopRec(){if(rec){const r=rec;rec=null;r.onend=r.onresult=r.onerror=null;try{r.abort()}catch(e){}}running=false;label(false)}
  function start(){
    if(rec||!want)return;
    rec=new SR();rec.lang="vi-VN";rec.continuous=true;rec.interimResults=true;
    // nghe thấy câu kích hoạt: chờ khách nói hết (kết quả cuối) – hoặc im lặng 1,4 giây – rồi mới trả lời
    let pend=null,tm=0;
    rec.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const tx=e.results[i][0].transcript;hint(tx);const h=heard(tx);if(!h)continue;
      clearTimeout(tm);if(e.results[i].isFinal){wake(h,true);return}pend=h;tm=setTimeout(()=>{if(pend)wake(pend,false)},1400)}};
    rec.onerror=e=>{lastErr=Date.now();if(e.error==="not-allowed"||e.error==="service-not-allowed"){set(false);botAdd("sys","Trình duyệt chưa cho phép dùng micro nên chưa bật được chế độ rảnh tay. Anh/chị bấm biểu tượng ổ khóa trên thanh địa chỉ → cho phép Micro, rồi bật lại.")}else{fails++;if((e.error==="network"||e.error==="audio-capture")&&!BOT.wakeErr){BOT.wakeErr=1;botAdd("sys",e.error==="network"?"Chế độ rảnh tay cần kết nối Internet để nhận dạng giọng nói. Trợ lý sẽ tự thử lại.":"Không tìm thấy micro trên thiết bị nên chưa nghe được \"Xin chào\".")}}};
    rec.onend=()=>{rec=null;running=false;label(false)};
    try{rec.start();running=true;fails=0;label(true)}catch(e){rec=null;running=false}}
  function wake(h,isFinal){
    if(!rec&&!running)return;stopRec();BOT.wakeOpen=true;
    if(!BOT.open)botToggle(true);BOT.wakeOpen=false;
    botGesture("jump",900,"👂");
    if(h.rest&&h.rest.length>3){BOT_TTS.fromMic();botSend(h.raw.replace(/^.*?(chào|chao)(\s+(ha\s*wa\s*su\s*cô|hawasuco|ha\s*oa\s*su\s*cô|hoa\s*su\s*cô|trợ lý( ảo)?|bạn|em|anh|chị|robot))?(?=[\s,.!?]|$)[\s,.!?]*/i,"").trim()||h.rest);return}
    botAdd("b","Dạ, **Hawasuco** nghe đây ạ! Anh/chị cứ nói câu hỏi 🎤",{silent:true});
    BOT_TTS.sayThen("Dạ, Ha oa su cô nghe đây ạ! Anh chị cứ hỏi.",()=>setTimeout(()=>window.botMicStart&&window.botMicStart(),250))}
  function set(v){want=v;try{localStorage.setItem(KEY,v?"1":"0")}catch(e){}if(!v)stopRec();ui();
    if(v&&!BOT.wakeTold){BOT.wakeTold=true;botAdd("sys","Đã bật **rảnh tay**: khi cần hỏi, anh/chị chỉ cần nói **\"Xin chào\"** rồi nói câu hỏi. Bấm lại nút tai để tắt.")}}
  // tự nghe lại khi rảnh (không đang hỏi, không đang đọc, không bật micro hỏi, trang đang hiện)
  function tick(){if(!want||rec)return;if(BOT.busy||BOT.speaking||(window.botMicOn&&window.botMicOn())||document.hidden)return;
    if(Date.now()-lastErr<Math.min(30000,1500*Math.pow(2,fails)))return;start()}
  function init(){const b=document.getElementById("botWake");if(!b)return setTimeout(init,300);
    if(!SR||BOT_APP||!window.isSecureContext&&location.hostname!=="localhost")return;   // trong app Android: không có chế độ rảnh tay
    b.hidden=false;b.onclick=()=>{set(!want);if(want)start()};ui();
    setInterval(tick,1000);document.addEventListener("visibilitychange",()=>{if(document.hidden)stopRec()})}
  init();
  return{heard,set,pause:()=>stopRec(),isOn:()=>want,running:()=>running}
})();
