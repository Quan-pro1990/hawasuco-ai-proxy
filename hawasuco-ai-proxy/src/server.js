require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PROXY_AUTH_TOKEN = process.env.PROXY_AUTH_TOKEN;
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

if (!ANTHROPIC_API_KEY) {
  console.error('Thiếu ANTHROPIC_API_KEY trong file .env — dừng server.');
  process.exit(1);
}
if (!PROXY_AUTH_TOKEN) {
  console.error('Thiếu PROXY_AUTH_TOKEN trong file .env — dừng server.');
  process.exit(1);
}

const app = express();

// Ảnh base64 có thể khá lớn (ảnh đồng hồ đã resize còn ~1024px), nới giới hạn body.
app.use(express.json({ limit: '10mb' }));

// Giới hạn số request để tránh bị lạm dụng nếu token bị lộ — chỉnh lại theo
// quy mô đội ngũ thực tế (vd 50 nhân viên, mỗi người đọc vài chục ảnh/ngày).
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều yêu cầu, thử lại sau ít phút.' }
});
app.use(limiter);

/** Xác thực token nội bộ — KHÔNG phải API key Anthropic thật, xem README. */
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token || token !== PROXY_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Endpoint app Android gọi tới — cùng path/format với Anthropic Messages API,
 * để app chỉ cần đổi baseUrl + auth header, không phải đổi logic build request
 * (xem ClaudeVisionClient.kt trong app, phần "proxyUrl").
 */
app.post('/v1/messages', requireAuth, async (req, res) => {
  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Lỗi gọi Anthropic API:', err);
    res.status(502).json({ error: 'Không gọi được AI service, thử lại sau.' });
  }
});

app.listen(PORT, () => {
  console.log(`Hawasuco AI proxy đang chạy ở cổng ${PORT}`);
});
