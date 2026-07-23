export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { symptom } = req.body;
    if (!symptom) {
        return res.status(400).json({ error: 'Symptom is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key is missing in environment variables' });
    }

    const myAvailableDepts = ["내과", "이비인후과", "정형외과", "소아청소년과", "안과", "피부과", "외과", "치과", "산부인과", "신경외과"];

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `환자 증상: ${symptom}` }] }],
                systemInstruction: {
                    parts: [{ 
                        text: `당신은 병원 진료과 분류 전문가 시스템입니다. 환자의 증상을 분석하여 아래 제공된 [현재 내 병원 데이터 원장 목록]에 기재된 진료과 중에서만 '가장 정확한 1개'를 매칭해야 합니다.\n\n[현재 내 병원 데이터 원장 목록]\n${JSON.stringify(myAvailableDepts)}\n\n출력은 반드시 다른 군더더기 설명 없이 아래의 JSON 포맷으로만 답변하세요:\n{\n  "department": "목록에서 선택한 정확한 진료과 명칭",\n  "disease": "의심 질환명",\n  "tip": "환자를 위한 간단한 한줄 조언"\n}` 
                    }]
                },
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error:", data);
            return res.status(response.status).json({ 
                error: `Gemini API call failed (${response.status})`,
                details: data.error?.message || '알 수 없는 Google API 오류'
            });
        }

        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textOutput) throw new Error("Gemini 응답 데이터가 비어있습니다.");

        const result = JSON.parse(textOutput);

        // 🌟 [서버 텍스트 로그 기록] 사용자의 입력과 AI 응답을 콘솔 로그로 남김
        console.log("================================================");
        console.log(`[진단 요청 일시] ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
        console.log(`[환자 작성 증상] ${symptom}`);
        console.log(`[AI 분석 결과] 의심질환: ${result.disease} | 추천과: ${result.department} | 조언: ${result.tip}`);
        console.log("================================================");

        return res.status(200).json(result);

    } catch (error) {
        console.error("Server Function Error:", error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}