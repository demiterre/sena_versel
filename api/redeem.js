// api/redeem.js

// 넷마블 방문자 쿠키를 가져오는 함수 (개선됨)
async function getGuestCookie() {
    try {
        const res = await fetch('https://coupon.netmarble.com/tskgb', {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        // 최신 Node.js의 getSetCookie 기능을 시도하거나, 헤더를 직접 파싱
        let rawCookies = [];
        if (typeof res.headers.getSetCookie === 'function') {
            rawCookies = res.headers.getSetCookie();
        } else {
            // 구버전 호환성
            const headerVal = res.headers.get('set-cookie');
            if (headerVal) rawCookies = [headerVal];
        }

        if (!rawCookies || rawCookies.length === 0) return "";
        
        // 쿠키 합치기
        return rawCookies.map(c => c.split(';')[0]).join('; ');
    } catch (e) {
        console.error("Cookie Error:", e);
        return "";
    }
}

export default async function handler(req, res) {
    // POST 요청만 허용
    if (req.method !== 'POST') return res.status(405).send("Method Not Allowed");

    const { uid, couponCode } = req.body;

    if (!uid || !couponCode) {
        return res.status(400).json({ success: false, message: "정보 부족" });
    }

    try {
        // 1. 방문자 쿠키 발급
        const guestCookie = await getGuestCookie();

        // 2. 넷마블 서버로 전송
        const params = new URLSearchParams();
        params.append('gameCode', 'tskgb'); // 세나 리버스 코드
        params.append('couponCode', couponCode);
        params.append('pid', uid);
        params.append('langCd', 'KO_KR');

        const netmarbleRes = await fetch('https://coupon.netmarble.com/api/coupon/reward', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://coupon.netmarble.com/tskgb',
                'Origin': 'https://coupon.netmarble.com',
                'Cookie': guestCookie, // 발급받은 쿠키 장착
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: params
        });

        // 3. 응답 분석 (HTML이 오면 차단된 것임)
        const contentType = netmarbleRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            // JSON이 아니면 넷마블이 차단 페이지를 보낸 것
            return res.status(200).json({ success: false, message: "⛔ 서버 차단됨 (WAF/HTML 응답)", coupon: couponCode });
        }

        const data = await netmarbleRes.json();
        
        let isSuccess = false;
        let message = "";

        // 성공 판정
        if (data.resultCode === 'SUCCESS' || data.resultCode === 'S001') {
            isSuccess = true;
            message = "✅ 지급 성공";
        } else if (data.errorCode === 24004 || String(data.errorCode) === '24004') {
            isSuccess = true;
            message = "⚠️ 이미 사용한 쿠폰";
        } else {
            // ★ 실패 시 넷마블이 보낸 '진짜 이유'를 출력
            const reason = data.resultMessage || data.message || data.errorMessage || "이유 불명";
            message = `❌ 실패 (${reason})`;
        }

        return res.status(200).json({ success: isSuccess, message, coupon: couponCode });

    } catch (error) {
        return res.status(500).json({ success: false, message: "통신 오류: " + error.message, coupon: couponCode });
    }
}