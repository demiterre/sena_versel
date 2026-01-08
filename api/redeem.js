// api/redeem.js
const axios = require('axios');

// ★★★ 서버에 저장할 쿠폰 리스트 ★★★
const SERVER_COUPON_LIST = [
    "BRANZEBRANSEL", "HALFGOODHALFEVIL", "LETSGO7K", "GRACEOFCHAOS",
    "100MILLIONHEARTS", "7S7E7V7E7N7", "POOKIFIVEKINDS", "GOLDENKINGPEPE",
    "77EVENT77", "HAPPYNEWYEAR2026", "KEYKEYKEY", "SENAHAJASENA",
    "SENA77MEMORY", "SENASTARCRYSTAL", "CHAOSESSENCE", "OBLIVION",
    "TARGETWISH", "DELLONSVSKRIS", "DANCINGPOOKI"
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 방문자 쿠키 자동 발급 함수
async function getGuestCookie() {
    try {
        const response = await axios.get('https://coupon.netmarble.com/tskgb', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const rawCookies = response.headers['set-cookie'];
        if (!rawCookies) return "";
        return rawCookies.map(c => c.split(';')[0]).join('; ');
    } catch (e) {
        return "";
    }
}

export default async function handler(req, res) {
    // POST 요청만 처리
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { uid } = req.body;
    if (!uid) {
        return res.status(400).json({ error: "회원번호(PID)를 입력해주세요." });
    }

    // 1. 방문자 쿠키 발급
    const guestCookie = await getGuestCookie();
    
    // 2. 헤더 설정
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://coupon.netmarble.com/tskgb',
        'Origin': 'https://coupon.netmarble.com',
        'Cookie': guestCookie, 
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };

    const netmarbleUrl = 'https://coupon.netmarble.com/api/coupon/reward';
    let results = [];

    // 3. 쿠폰 반복 입력
    for (const couponCode of SERVER_COUPON_LIST) {
        let isSuccess = false;
        let message = "";

        try {
            const params = new URLSearchParams();
            // ★ 중요: 리버스면 'tskgb', 키우기면 'skiagb'로 수정하세요
            params.append('gameCode', 'tskgb'); 
            params.append('couponCode', couponCode);
            params.append('pid', uid);
            params.append('langCd', 'KO_KR');

            const response = await axios.post(netmarbleUrl, params, {
                headers: headers,
                timeout: 3000 // 타임아웃 짧게
            });

            const data = response.data;

            if (data.resultCode === 'SUCCESS' || data.resultCode === 'S001') {
                isSuccess = true;
                message = "✅ 지급 성공";
            } else if (data.errorCode === 24004 || String(data.errorCode) === '24004') {
                isSuccess = true;
                message = "⚠️ 이미 사용한 쿠폰";
            } else {
                message = `❌ ${data.resultMessage || data.message || "실패"}`;
            }
        } catch (error) {
            if (error.response && error.response.data && (error.response.data.errorCode === 24004 || error.response.data.errorCode === '24004')) {
                isSuccess = true;
                message = "⚠️ 이미 사용한 쿠폰";
            } else {
                message = "❌ 통신 오류/차단";
            }
        }
        
        results.push({ coupon: couponCode, message: message });
        
        // Vercel 타임아웃 방지를 위해 딜레이 최소화 (0.1초)
        await sleep(100); 
    }

    res.status(200).json({ results });
}