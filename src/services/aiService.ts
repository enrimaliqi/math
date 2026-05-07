import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type AIContext = "CAR" | "TANK" | "FARM" | "EXP" | "GENERAL";

interface AnalyzeParams {
  context: AIContext;
  currentValue: any;
  time: number;
}

export interface ChatMessagePart {
  role: 'user' | 'model';
  text: string;
}

export async function askAI(question: string, context: AIContext, history: ChatMessagePart[] = [], extraData?: any) {
  const systemInstruction = `
    Je një Profesor AI ekspert në Matematikë dhe Kalkulus (Gjuha: Shqip). 
    Detyra jote është të shpjegosh konceptet e Derivateve dhe Integraleve në mënyrë të thjeshtë por shkencërisht të saktë.
    
    KONTEKSTI AKTUAL: ${context}
    ${extraData ? `TË DHËNAT E SIMULIMIT NË KOHË REALE: ${JSON.stringify(extraData)}` : ""}
    
    Rregullat e Bisedës (MANDATORY):
    1. Përdor MARKDOWN të pasur: Përdor '###' për tituj, lista me pika, dhe tabela për të krahasuar konceptet.
    2. Përdor LaTeX kompleks: Shpjego konceptet me formula të plota.
       Shembuj: \frac{d}{dx}(x^n) = nx^{n-1}, \int_{a}^{b} v(t) dt = s(b) - s(a).
    3. Krijo "Diagrama" Tekstuale: Përdor tabela Markdown ose struktura me vija për të treguar rrjedhën e logjikës (p.sh. Pozicioni -> Shpejtësia -> Nxitimi).
    4. Shpjegime Vizuale: Përdor analogji vizuale si "pjerrësia e kurbës është si pjerresia e një mali".
    5. MOS u përgjigj me "Nuk jam i sigurt". Përdor njohuritë e tua universale të kalkulusit.
    6. Shpjegimet duhet të jenë të kuptueshme për një nxënës gjimnazi (Klasa XII) por shkencërisht të sakta.
    7. Referoju vlerave specifike nga simulimi (p.sh. "Në kohën t=${extraData?.time || 'aktuale'}...") për të bërë shpjegimin konkret.
    8. Përdor analogji: "Derivati është si shpejtësimatësi i makinës", "Integrali është si mbledhja e monedhave në arkë".
    9. PËR KONTEKSTIN 'FARM': Nëse përdoruesi pyet pse x = 10m është pika e sipërfaqes maksimale (ku A'(x) = 0), shpjego shkencërisht duke përdorur Derivatin e Dytë (A''(x) = -2, që tregon konkavitet poshtë dhe vërteton maksimumin) ose analizën e ndryshimit të shenjës së A'(x) rreth asaj pike.
    10. PËR KONTEKSTIN 'EXP': Shpjego rritjen eksponenciale dhe faktin që derivati i e^{kx} është k \cdot e^{kx}, që do të thotë se rritja është proporcionale me sasinë aktuale.
    11. Përgjigju gjithmonë në SHQIP dhe me edukatë "Ju" ose "Ti" (sipas stilit miqësor).
  `;

  // Convert history and current question to the format expected by the SDK
  const contents = [
    ...history.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    })),
    {
      role: 'user',
      parts: [{ text: question }]
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction,
      },
    });
    return response.text || "Më vjen keq, nuk munda të krijoja një përgjigje.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Ndodhi një gabim gjatë bisedës me AI. Provoni përsëri.";
  }
}

export async function analyzeState(params: AnalyzeParams) {
  const { context, currentValue, time } = params;
  
  let prompt = "";
  if (context === "CAR") {
    prompt = `Në kohën t = ${time.toFixed(1)}s, shpejtësia është ${currentValue.v.toFixed(1)} km/h dhe pozicioni është ${currentValue.s.toFixed(1)}m. Analizo shkurtimisht se çfarë po ndodh me makinën (p.sh. a po rritet shpejtësia, a po ndalon?).`;
  } else if (context === "TANK") {
    prompt = `Në kohën t = ${time.toFixed(1)}s, vëllimi i mbledhur është ${currentValue.volume.toFixed(1)}L. Analizo shkurtimisht se si po akumulohet vëllimi përmes integralit.`;
  } else if (context === "FARM") {
    prompt = `Me gjerësi x = ${currentValue.x.toFixed(1)}m, sipërfaqja është ${currentValue.area.toFixed(1)}m². Analizo nëse jemi në pikën maksimale (x=10m). Nëse po, shpjego PSE është maksimum duke përdorur derivatin e dytë ose analizën e shenjës së derivatit.`;
  } else if (context === "EXP") {
    prompt = `Popullsia aktuale është ${currentValue.population.toFixed(2)} me një rritje prej ${currentValue.rate.toFixed(2)}. Shpjego si lidhet rritja me derivatin në këtë moment.`;
  }

  return askAI(prompt, context, [], { time, currentValue });
}
