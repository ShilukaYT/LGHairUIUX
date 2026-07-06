import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Zalo, ThreadType, LoginQRCallbackEventType } from "zca-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3847);
const API_KEY = (process.env.ZALO_BRIDGE_API_KEY || "").trim();
const CRED_PATH = process.env.ZALO_BRIDGE_CREDENTIALS || path.join(__dirname, "credentials.json");

const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** @type {import('zca-js').API | null} */
let apiInstance = null;
let loginError = null;
/** @type {Promise<import('zca-js').API> | null} */
let loginPromise = null;

/* ── QR Login State ── */
let qrStatus = "idle"; // "idle" | "generating" | "waiting_scan" | "scanned" | "logged_in" | "expired" | "error"
let currentQrDataUrl = null;
let qrError = null;
let isQrLoginRunning = false;

function toQrDataUrl(image) {
    if (typeof image !== "string" || !image.trim()) return "";
    const t = image.trim();
    if (t.startsWith("data:image")) return t;
    return `data:image/png;base64,${t}`;
}

function startQrLoginFlow() {
    if (isQrLoginRunning) return;
    isQrLoginRunning = true;
    qrStatus = "generating";
    currentQrDataUrl = null;
    qrError = null;

    try {
        const qrPath = path.join(__dirname, "zalo-qr.png");
        const zalo = new Zalo();

        console.log("\n📱 [ZaloBridge] Đang tạo mã QR đăng nhập mới...");

        zalo.loginQR(
        { qrPath, userAgent, language: "vi" },
        (event) => {
            switch (event.type) {
                case LoginQRCallbackEventType.QRCodeGenerated: {
                    const raw = event.data?.image;
                    if (raw) {
                        currentQrDataUrl = toQrDataUrl(raw);
                        qrStatus = "waiting_scan";
                        console.log("📱 [ZaloBridge] Đã tạo mã QR! Quét trên giao diện web.");
                    } else {
                        qrStatus = "error";
                        qrError = "Không tạo được ảnh QR.";
                    }
                    break;
                }
                case LoginQRCallbackEventType.QRCodeScanned:
                    qrStatus = "scanned";
                    console.log("📱 [ZaloBridge] Đã quét QR! Vui lòng xác nhận trên điện thoại.");
                    break;
                case LoginQRCallbackEventType.QRCodeExpired:
                    qrStatus = "expired";
                    isQrLoginRunning = false;
                    console.log("📱 [ZaloBridge] Mã QR đã hết hạn.");
                    break;
                case LoginQRCallbackEventType.QRCodeDeclined:
                    qrStatus = "error";
                    qrError = "Đăng nhập bị từ chối trên điện thoại.";
                    isQrLoginRunning = false;
                    console.log("📱 [ZaloBridge] Đăng nhập bị từ chối.");
                    break;
                default:
                    break;
            }
        },
    ).then((api) => {
        const ctx = api.getContext();
        const credentials = {
            cookie: ctx.cookie.toJSON()?.cookies ?? [],
            imei: ctx.imei,
            userAgent: ctx.userAgent,
        };
        fs.writeFileSync(CRED_PATH, JSON.stringify(credentials, null, 2), "utf8");
        apiInstance = api;
        loginError = null;
        qrStatus = "logged_in";
        currentQrDataUrl = null;
        isQrLoginRunning = false;
        console.log("🎉 [ZaloBridge] Đăng nhập Zalo thành công! Đã lưu credentials.json.");
    }).catch((e) => {
        qrStatus = "error";
        qrError = e?.message || String(e);
        isQrLoginRunning = false;
        console.error("❌ [ZaloBridge] Lỗi đăng nhập QR:", qrError);
    });
    } catch (e) {
        qrStatus = "error";
        qrError = e?.message || String(e);
        isQrLoginRunning = false;
        console.error("❌ [ZaloBridge] Lỗi khởi tạo Zalo:", qrError);
    }
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
            try {
                const s = Buffer.concat(chunks).toString("utf8");
                resolve(s ? JSON.parse(s) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on("error", reject);
    });
}

function normalizePhone(phone) {
    if (phone == null || phone === "") return "";
    const d = String(phone).replace(/\D/g, "");
    if (!d) return "";
    if (d.startsWith("84")) return d;
    if (d.startsWith("0") && d.length >= 10) return "84" + d.slice(1);
    if (d.length === 9) return "84" + d;
    return d;
}

function checkAuth(req) {
    if (!API_KEY) return true;
    const h = req.headers.authorization;
    if (!h || !h.startsWith("Bearer ")) return false;
    return h.slice(7).trim() === API_KEY;
}

async function ensureApi() {
    if (apiInstance) return apiInstance;
    if (loginError && !loginPromise) throw new Error(loginError);
    if (!loginPromise) {
        loginPromise = (async () => {
            if (!fs.existsSync(CRED_PATH)) {
                throw new Error("Chưa có credentials.json. Vui lòng bấm tạo mã QR đăng nhập trên giao diện.");
            }
            const raw = JSON.parse(fs.readFileSync(CRED_PATH, "utf8"));
            const cookies = Array.isArray(raw.cookie) ? raw.cookie : [];
            if (cookies.length === 0 || !raw.imei || !raw.userAgent) {
                throw new Error("credentials.json không hợp lệ hoặc đã hết hạn.");
            }
            const zalo = new Zalo();
            const api = await zalo.login({
                cookie: raw.cookie,
                imei: String(raw.imei),
                userAgent: String(raw.userAgent),
            });
            apiInstance = api;
            loginError = null;
            return api;
        })().catch((e) => {
            loginError = e?.message || String(e);
            loginPromise = null;
            throw e;
        });
    }
    return loginPromise;
}

const server = http.createServer(async (req, res) => {
    // Enable universal CORS for frontend calls
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type, Authorization, X-Requested-With, Accept, Origin");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");

    if (!checkAuth(req)) {
        res.statusCode = 401;
        res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
        return;
    }

    const url = new URL(req.url || "/", "http://127.0.0.1");

    /* ── API: Health & Status ── */
    if (req.method === "GET" && url.pathname === "/health") {
        let credentialsFileExists = false;
        let credentialsValidShape = false;
        try {
            credentialsFileExists = fs.existsSync(CRED_PATH);
            if (credentialsFileExists) {
                const raw = JSON.parse(fs.readFileSync(CRED_PATH, "utf8"));
                const cookies = Array.isArray(raw.cookie) ? raw.cookie : [];
                credentialsValidShape = Boolean(
                    cookies.length > 0 && raw.imei && String(raw.imei).trim() && raw.userAgent && String(raw.userAgent).trim(),
                );
            }
        } catch {
            credentialsValidShape = false;
        }
        res.statusCode = 200;
        res.end(
            JSON.stringify({
                ok: true,
                loggedIn: !!apiInstance,
                lastLoginError: loginError,
                warmingUp: Boolean(loginPromise && !apiInstance),
                credentialsFileExists,
                credentialsValidShape,
                port: PORT,
            }),
        );
        return;
    }

    /* ── API: Web QR Login ── */
    if (req.method === "GET" && url.pathname === "/api/login-status") {
        res.statusCode = 200;
        res.end(JSON.stringify({
            ok: true,
            status: qrStatus,
            qrDataUrl: currentQrDataUrl,
            error: qrError,
            loggedIn: !!apiInstance,
        }));
        return;
    }

    if (req.method === "POST" && url.pathname === "/api/start-login") {
        try {
            startQrLoginFlow();
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true, status: qrStatus }));
        } catch (e) {
            console.error("❌ [ZaloBridge] Lỗi khi gọi startQrLoginFlow:", e);
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: e?.message || String(e) }));
        }
        return;
    }

    /* ── API: Check Phone Zalo ── */
    if (req.method === "POST" && (url.pathname === "/api/check-phone" || url.pathname === "/check-phone")) {
        try {
            const body = await readJsonBody(req);
            const rawPhone = String(body.phone || "").trim();
            const phone84 = normalizePhone(rawPhone);
            if (!phone84) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, exists: false, error: "Số điện thoại không hợp lệ" }));
                return;
            }
            const phone0 = phone84.startsWith("84") ? "0" + phone84.slice(2) : phone84;
            const phonePlus = "+" + phone84;

            // Tạo tập hợp 4 định dạng số điện thoại có thể có của Zalo
            const candidates = Array.from(new Set([phone0, phone84, phonePlus, rawPhone])).filter(Boolean);
            const api = await ensureApi();

            let user = null;
            let lastError = null;

            for (const p of candidates) {
                try {
                    const u = await api.findUser(p);
                    if (u && (u.uid || u.id || u.userId)) {
                        user = u;
                        break;
                    }
                } catch (err) {
                    lastError = err;
                }
            }

            if (user && (user.uid || user.id || user.userId)) {
                res.statusCode = 200;
                res.end(JSON.stringify({
                    ok: true,
                    exists: true,
                    user: {
                        uid: user.uid || user.id || user.userId,
                        displayName: user.displayName || user.zaloName || user.name || "Người dùng Zalo",
                        avatar: user.avatar || user.avatarUrl || null,
                        zaloName: user.zaloName || user.displayName || null
                    }
                }));
            } else {
                const message = lastError ? (lastError?.message || String(lastError)) : "";
                let errorMsg = "SĐT chưa đăng ký Zalo hoặc chủ tài khoản đã tắt Quyền riêng tư tìm kiếm qua SĐT";
                if (message.includes("-216") || message.includes("limit") || message.includes("rate") || message.includes("-300")) {
                    errorMsg = "Zalo tạm thời giới hạn tần suất rà soát (Rate Limit) hoặc SĐT chặn tìm kiếm";
                }
                res.statusCode = 200;
                res.end(JSON.stringify({ ok: true, exists: false, error: errorMsg }));
            }
        } catch (e) {
            const message = e?.message || String(e);
            let errorMsg = "SĐT chưa đăng ký Zalo hoặc chủ tài khoản tắt Quyền riêng tư tìm kiếm qua SĐT";
            if (message.includes("-216") || message.includes("limit") || message.includes("rate") || message.includes("-300")) {
                errorMsg = "Zalo tạm thời giới hạn tần suất rà soát (Rate Limit) hoặc SĐT chặn tìm kiếm";
            }
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true, exists: false, error: errorMsg }));
        }
        return;
    }

    /* ── API: Send Message ── */
    if (req.method !== "POST" || url.pathname !== "/send") {
        res.statusCode = 404;
        res.end(JSON.stringify({ ok: false, error: "Not found" }));
        return;
    }

    try {
        const body = await readJsonBody(req);
        const phone = normalizePhone(body.phone);
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const content = typeof body.content === "string" ? body.content : "";

        if (!phone) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: "Số điện thoại không hợp lệ" }));
            return;
        }

        const msg = title ? `${title}\n${content}` : content;
        if (!String(msg).trim()) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: "Thiếu nội dung" }));
            return;
        }

        const api = await ensureApi();
        const user = await api.findUser(phone);
        await api.sendMessage(msg, user.uid, ThreadType.User);

        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true }));
    } catch (e) {
        const message = e?.message || String(e);
        console.error("[MinhTamHair-ZaloPersonalBridge]", message);
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: message }));
    }
});

server.listen(PORT, () => {
    console.log(`🔌 [ZaloBridge] http://127.0.0.1:${PORT} (POST /send, GET /health, POST /api/start-login)`);
    if (fs.existsSync(CRED_PATH)) {
        console.log("🔌 [ZaloBridge] Đang tự động đăng nhập Zalo nền (warm-up)...");
        ensureApi().catch((e) => {
            console.error("🔌 [ZaloBridge] Lỗi đăng nhập nền:", e?.message || e);
        });
    } else {
        console.log("🔌 [ZaloBridge] Chưa có credentials. Bấm Tạo QR trên giao diện Gửi Thông Báo để đăng nhập.");
    }
});
