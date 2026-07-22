export default async function handler(req, res) {
    // 1. POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { symptom } = req.body;
    if (!symptom) {
        return res.status(400).json({ error: 'Symptom is required' });
    }

    // 2. Vercel 환경변수에서 Gemini API Key 가져오기
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key is missing in environment variables' });
    }

    // DB에 존재하는 고정 10대 진료과
    const myAvailableDepts = ["내과", "이비인후과", "정형외과", "소아청소년과", "안과", "피부과", "외과", "치과", "산부인과", "신경외과"];

    try {
        // 3. 최신 Gemini 3.5 Flash 모델 API 호출 (URL 모델명 수정됨)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `환자 증상: ${symptom}` }]
                }],
                systemInstruction: {
                    parts: [{ 
                        text: `당신은 병원 진료과 분류 전문가 시스템입니다. 
환자의 증상을 분석하여 아래 제공된 [현재 내 병원 데이터 원장 목록]에 기재된 진료과 중에서만 '가장 정확한 1개'를 매칭해야 합니다.

[현재 내 병원 데이터 원장 목록]
${JSON.stringify(myAvailableDepts)}

출력은 반드시 다른 군더더기 설명 없이 아래의 JSON 포맷으로만 답변하세요:
{
  "department": "목록에서 선택한 정확한 진료과 명칭",
  "disease": "의심 질환명",
  "tip": "환자를 위한 간단한 한줄 조언"
}` 
                    }]
                },
                // Gemini에게 반드시 JSON 형태로 응답하도록 강제
                generationConfig: {
                    responseMimeType: "application/json",
                }
            })
        });

        const data = await response.json();

        // 4. 오류 처리 (할당량 초과, 키 오류 등)
        if (!response.ok) {
            console.error("Gemini API Error:", data);
            return res.status(response.status).json({ error: 'Gemini API call failed' });
        }

        // 5. Gemini 응답에서 JSON 텍스트 추출 및 파싱
        const textOutput = data.candidates[0].content.parts[0].text;
        const result = JSON.parse(textOutput);

        // 6. 프론트엔드로 결과 반환
        return res.status(200).json(result);

    } catch (error) {
        console.error("Server Function Error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}