// api/redeem.js

// 넷마블 방문자 쿠키를 가져오는 함수
async function getGuestCookie() {
    try {
        const res = await fetch('https://coupon.netmarble.com/tskgb', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        // 쿠키 추출
        const raw = res.headers.get('set-cookie');
        if (!raw) return "";
        return raw.split(',').map(c => c.split(';')[0]).join('; ');
    } catch (e) {
        return "";
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send("Method Not Allowed");

    // 프론트에서 UID와 쿠폰코드 1개를 받습니다.
    const { uid, couponCode } = req.body;

    if (!uid || !couponCode) {
        return res.status(400).json({ success: false, message: "정보 부족" });
    }

    try {
        // 1. 방문자 쿠키 발급
        const guestCookie = await getGuestCookie();

        // 2. 넷마블 서버로 전송 (Node.js 18 Native Fetch 사용)
        const params = new URLSearchParams();
        params.append('gameCode', 'tskgb'); // 리버스 코드
        params.append('couponCode', couponCode);
        params.append('pid', uid);
        params.append('langCd', 'KO_KR');

        const netmarbleRes = await fetch('https://coupon.netmarble.com/api/coupon/reward', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://coupon.netmarble.com/tskgb',
                'Origin': 'https://coupon.netmarble.com',
                'Cookie': guestCookie,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: params
        });

        const data = await netmarbleRes.json();
        
        // 결과 정리
        let isSuccess = false;
        let message = "";

        if (data.resultCode === 'SUCCESS' || data.resultCode === 'S001') {
            isSuccess = true;
            message = "✅ 지급 성공";
        } else if (data.errorCode === 24004 || String(data.errorCode) === '24004') {
            isSuccess = true; // 중복도 성공 취급
            message = "⚠️ 이미 사용한 쿠폰";
        } else {
            message = `❌ ${data.resultMessage || data.message || "실패"}`;
        }

        return res.status(200).json({ success: isSuccess, message, coupon: couponCode });

    } catch (error) {
        return res.status(500).json({ success: false, message: "서버 통신 에러", coupon: couponCode });
    }
}