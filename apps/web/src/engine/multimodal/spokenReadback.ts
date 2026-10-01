/**
 * MM-Ω Wave W2: Spoken Readback & Interactive Clarification Engine
 *
 * Implements the voice-first confirmation loop:
 * "Speak → Hear what SPE understood → Confirm or clarify → Receive actionable record"
 *
 * INVARIANTS:
 * - RAW_AUDIO_EGRESS = 0
 * - Runs 100% locally via browser Web Speech Synthesis or offline audio catalogs.
 * - Supports all 20 Global Languages.
 * - Detects critical field ambiguities (currency, relative dates, debtor/creditor)
 *   and generates precise spoken clarification questions.
 */

import type { PromiseLedger, PromiseCommitment } from "./outcomes/types";
import { GLOBAL_CURRENCIES } from "./outcomes/globalLanguages";

export interface ClarificationQuestion {
  id: string;
  field: "currency" | "deadline" | "amount" | "parties" | "condition";
  questionText: string;
  spokenPrompt: string;
  options?: string[];
  resolved: boolean;
  resolvedValue?: string;
}

export interface SpokenReadbackResult {
  readbackId: string;
  language: string;
  readbackText: string;
  status: "READY_FOR_CONFIRMATION" | "NEEDS_CLARIFICATION" | "CONFIRMED";
  clarificationQuestions: ClarificationQuestion[];
  canSynthesizeLocally: boolean;
  audioPromptScript: string;
  timestamp: string;
}

export interface ReadbackTemplate {
  intro: (action: string, deadline?: string, amount?: string) => string;
  currencyClarification: string;
  deadlineClarification: (dayOrTime: string) => string;
  partyClarification: string;
  confirmedAck: string;
}

/**
 * 20 Global Language Spoken Readback Templates
 */
export const READBACK_TEMPLATES: Record<string, ReadbackTemplate> = {
  en: {
    intro: (action, deadline, amount) => {
      let msg = `I heard: ${action}`;
      if (deadline) msg += ` promised by ${deadline}`;
      if (amount) msg += `, price ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Which currency was agreed upon?",
    deadlineClarification: (day) => `Which ${day} is the deadline?`,
    partyClarification: "Who is paying whom?",
    confirmedAck: "Promise confirmed and recorded in your ledger.",
  },
  hi: {
    intro: (action, deadline, amount) => {
      let msg = `मैंने सुना: ${action}`;
      if (deadline) msg += `, तारीख ${deadline} तक`;
      if (amount) msg += `, राशि ${amount}`;
      return msg + "।";
    },
    currencyClarification: "कौन सी मुद्रा तय हुई है?",
    deadlineClarification: (day) => `कौन से ${day} तक का वादा है?`,
    partyClarification: "भुगतान कौन किसको करेगा?",
    confirmedAck: "वादा पक्का हो गया और आपके लेज़र में दर्ज कर लिया गया है।",
  },
  te: {
    intro: (action, deadline, amount) => {
      let msg = `నేను విన్నాను: ${action}`;
      if (deadline) msg += `, గడువు ${deadline} నాటికి`;
      if (amount) msg += `, మొత్తం ${amount}`;
      return msg + ".";
    },
    currencyClarification: "ఏ కరెన్సీలో చెల్లింపు జరగాలి?",
    deadlineClarification: (day) => `ఏ ${day} నాటికి పూర్తి చేయాలి?`,
    partyClarification: "ఎవరు ఎవరికి చెల్లించాలి?",
    confirmedAck: "వాగ్దానం నిర్ధారించబడింది మరియు మీ లెడ్జర్‌లో నమోదు చేయబడింది.",
  },
  es: {
    intro: (action, deadline, amount) => {
      let msg = `Escuché: ${action}`;
      if (deadline) msg += ` prometido para ${deadline}`;
      if (amount) msg += `, precio ${amount}`;
      return msg + ".";
    },
    currencyClarification: "¿Cuál es la moneda acordada?",
    deadlineClarification: (day) => `¿Para qué ${day} es la fecha límite?`,
    partyClarification: "¿Quién paga a quién?",
    confirmedAck: "Promesa confirmada y guardada en su registro.",
  },
  ar: {
    intro: (action, deadline, amount) => {
      let msg = `سمعت: ${action}`;
      if (deadline) msg += ` موعده بحلول ${deadline}`;
      if (amount) msg += `، بمبلغ ${amount}`;
      return msg + ".";
    },
    currencyClarification: "ما هي العملة المتفق عليها؟",
    deadlineClarification: (day) => `أي ${day} هو الموعد النهائي؟`,
    partyClarification: "من سيدفع لمن؟",
    confirmedAck: "تم تأكيد الوعد وحفظه في سجلك.",
  },
  zh: {
    intro: (action, deadline, amount) => {
      let msg = `我听到：${action}`;
      if (deadline) msg += `，承诺于 ${deadline} 前完成`;
      if (amount) msg += `，金额 ${amount}`;
      return msg + "。";
    },
    currencyClarification: "约定的货币是什么？",
    deadlineClarification: (day) => `具体是哪个 ${day}？`,
    partyClarification: "付款方和收款方是谁？",
    confirmedAck: "承诺已确认并记录在您的账本中。",
  },
  fr: {
    intro: (action, deadline, amount) => {
      let msg = `J'ai compris : ${action}`;
      if (deadline) msg += ` promis pour ${deadline}`;
      if (amount) msg += `, montant ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Quelle est la devise convenue ?",
    deadlineClarification: (day) => `De quel ${day} s'agit-il ?`,
    partyClarification: "Qui paie qui ?",
    confirmedAck: "Promesse confirmée et enregistrée dans votre carnet.",
  },
  pt: {
    intro: (action, deadline, amount) => {
      let msg = `Entendi: ${action}`;
      if (deadline) msg += ` prometido até ${deadline}`;
      if (amount) msg += `, valor ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Qual é a moeda acordada?",
    deadlineClarification: (day) => `Qual ${day} é o prazo?`,
    partyClarification: "Quem paga para quem?",
    confirmedAck: "Promessa confirmada e registrada no seu livro.",
  },
  bn: {
    intro: (action, deadline, amount) => {
      let msg = `আমি শুনেছি: ${action}`;
      if (deadline) msg += `, ${deadline} এর মধ্যে`;
      if (amount) msg += `, মূল্য ${amount}`;
      return msg + "।";
    },
    currencyClarification: "কোন মুদ্রায় চুক্তি হয়েছে?",
    deadlineClarification: (day) => `কোন ${day} এর মধ্যে কাজ হবে?`,
    partyClarification: "কে কাকে টাকা দেবে?",
    confirmedAck: "প্রতিশ্রুতি নিশ্চিত হয়েছে এবং আপনার লেজারে জমা হয়েছে।",
  },
  ru: {
    intro: (action, deadline, amount) => {
      let msg = `Я услышал: ${action}`;
      if (deadline) msg += `, обещано к ${deadline}`;
      if (amount) msg += `, сумма ${amount}`;
      return msg + ".";
    },
    currencyClarification: "В какой валюте договоренность?",
    deadlineClarification: (day) => `К какой именно ${day}?`,
    partyClarification: "Кто кому платит?",
    confirmedAck: "Обещание подтверждено и зафиксировано в реестре.",
  },
  ur: {
    intro: (action, deadline, amount) => {
      let msg = `میں نے سنا: ${action}`;
      if (deadline) msg += `، وعدہ ${deadline} تک`;
      if (amount) msg += `، رقم ${amount}`;
      return msg + "۔";
    },
    currencyClarification: "کس کرنسی میں معاہدہ ہوا ہے؟",
    deadlineClarification: (day) => `کون سے ${day} تک کی ڈیڈ لائن ہے؟`,
    partyClarification: "کون کس کو ادائیگی کرے گا؟",
    confirmedAck: "وعدہ تصدیق ہو گیا اور آپ کے لیجر میں درج کر لیا گیا۔",
  },
  id: {
    intro: (action, deadline, amount) => {
      let msg = `Saya mendengar: ${action}`;
      if (deadline) msg += ` dijanjikan pada ${deadline}`;
      if (amount) msg += `, harga ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Mata uang apa yang disepakati?",
    deadlineClarification: (day) => `Hari ${day} yang mana batas waktunya?`,
    partyClarification: "Siapa yang membayar siapa?",
    confirmedAck: "Janji dikonfirmasi dan dicatat di buku Anda.",
  },
  de: {
    intro: (action, deadline, amount) => {
      let msg = `Ich habe verstanden: ${action}`;
      if (deadline) msg += ` versprochen bis ${deadline}`;
      if (amount) msg += `, Betrag ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Welche Währung wurde vereinbart?",
    deadlineClarification: (day) => `Bis zu welchem ${day}?`,
    partyClarification: "Wer bezahlt wen?",
    confirmedAck: "Versprechen bestätigt und in Ihrem Buch festgehalten.",
  },
  ja: {
    intro: (action, deadline, amount) => {
      let msg = `了解しました：${action}`;
      if (deadline) msg += `、期限は ${deadline} まで`;
      if (amount) msg += `、金額は ${amount}`;
      return msg + "。";
    },
    currencyClarification: "合意された通貨は何ですか？",
    deadlineClarification: (day) => `具体的にどの${day}ですか？`,
    partyClarification: "どちらが誰に支払いますか？",
    confirmedAck: "約束が確認され、台帳に記録されました。",
  },
  mr: {
    intro: (action, deadline, amount) => {
      let msg = `मी ऐकले: ${action}`;
      if (deadline) msg += `, ${deadline} पर्यंत`;
      if (amount) msg += `, रक्कम ${amount}`;
      return msg + "।";
    },
    currencyClarification: "कोणत्या चलनामध्ये ठरले आहे?",
    deadlineClarification: (day) => `कोणत्या ${day} पर्यंत मुदत आहे?`,
    partyClarification: "कोणी कोणाला पैसे द्यायचे आहेत?",
    confirmedAck: "वचन निश्चित झाले आणि आपल्या नोंदवहीत नोंदवले गेले.",
  },
  ta: {
    intro: (action, deadline, amount) => {
      let msg = `நான் கேட்டது: ${action}`;
      if (deadline) msg += `, ${deadline}க்குள் முடிப்பதாக வாக்கு`;
      if (amount) msg += `, தொகை ${amount}`;
      return msg + ".";
    },
    currencyClarification: "எந்த நாணயத்தில் பேசப்பட்டது?",
    deadlineClarification: (day) => `எந்த ${day}க்குள் முடிக்க வேண்டும்?`,
    partyClarification: "யார் யாருக்கு பணம் கொடுக்க வேண்டும்?",
    confirmedAck: "வாக்குறுதி உறுதி செய்யப்பட்டு உங்கள் லெட்ஜரில் பதிவு செய்யப்பட்டது.",
  },
  tr: {
    intro: (action, deadline, amount) => {
      let msg = `Duyduğum: ${action}`;
      if (deadline) msg += `, ${deadline} tarihine kadar söz verildi`;
      if (amount) msg += `, tutar ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Hangi para birimi kararlaştırıldı?",
    deadlineClarification: (day) => `Hangi ${day} son gün?`,
    partyClarification: "Kim kime ödeme yapacak?",
    confirmedAck: "Söz onaylandı ve defterinize kaydedildi.",
  },
  vi: {
    intro: (action, deadline, amount) => {
      let msg = `Tôi đã nghe: ${action}`;
      if (deadline) msg += `, hứa trước ${deadline}`;
      if (amount) msg += `, số tiền ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Loại tiền tệ nào đã được thỏa thuận?",
    deadlineClarification: (day) => `Hạn chót là ${day} nào?`,
    partyClarification: "Ai trả tiền cho ai?",
    confirmedAck: "Lời hứa đã được xác nhận và ghi vào sổ.",
  },
  ko: {
    intro: (action, deadline, amount) => {
      let msg = `확인된 내용: ${action}`;
      if (deadline) msg += `, 마감일 ${deadline}`;
      if (amount) msg += `, 금액 ${amount}`;
      return msg + ".";
    },
    currencyClarification: "어떤 통화로 합의되었습니까?",
    deadlineClarification: (day) => `정확히 어느 ${day}입니까?`,
    partyClarification: "누가 누구에게 지급합니까?",
    confirmedAck: "약속이 확인되어 장부에 기록되었습니다.",
  },
  it: {
    intro: (action, deadline, amount) => {
      let msg = `Ho capito: ${action}`;
      if (deadline) msg += ` promesso entro ${deadline}`;
      if (amount) msg += `, importo ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Qual è la valuta concordata?",
    deadlineClarification: (day) => `Entro quale ${day}?`,
    partyClarification: "Chi paga chi?",
    confirmedAck: "Promessa confermata e salvata nel registro.",
  },
  gu: {
    intro: (action, deadline, amount) => {
      let msg = `મેં સાંભળ્યું: ${action}`;
      if (deadline) msg += `, ${deadline} સુધીમાં`;
      if (amount) msg += `, રકમ ${amount}`;
      return msg + "।";
    },
    currencyClarification: "કયા ચલણમાં ચુકવણી કરવાની છે?",
    deadlineClarification: (day) => `કયા ${day} સુધીમાં પૂર્ણ કરવાનું છે?`,
    partyClarification: "કોણે કોને ચૂકવણી કરવાની છે?",
    confirmedAck: "વચન કન્ફર્મ થયું અને તમારા લેજરમાં સુરક્ષિત રાખવામાં આવ્યું.",
  },
  kn: {
    intro: (action, deadline, amount) => {
      let msg = `ನಾನು ಕೇಳಿದ್ದು: ${action}`;
      if (deadline) msg += `, ${deadline} ಒಳಗೆ`;
      if (amount) msg += `, ಮೊತ್ತ ${amount}`;
      return msg + ".";
    },
    currencyClarification: "ಯಾವ ಕರೆನ್ಸಿಯಲ್ಲಿ ಪಾವತಿಸಬೇಕು?",
    deadlineClarification: (day) => `ಯಾವ ${day} ಒಳಗೆ ಮುಗಿಸಬೇಕು?`,
    partyClarification: "ಯಾರು ಯಾರಿಗೆ ಹಣ ನೀಡಬೇಕು?",
    confirmedAck: "ಭರವಸೆ ಖಚಿತಪಡಿಸಲಾಗಿದೆ ಮತ್ತು ಲೆಡ್ಜರ್‌ನಲ್ಲಿ ದಾಖಲಿಸಲಾಗಿದೆ.",
  },
  ml: {
    intro: (action, deadline, amount) => {
      let msg = `ഞാൻ കേട്ടത്: ${action}`;
      if (deadline) msg += `, ${deadline} നുള്ളിൽ`;
      if (amount) msg += `, തുക ${amount}`;
      return msg + ".";
    },
    currencyClarification: "ഏത് കറൻസിയിലാണ് നൽകേണ്ടത്?",
    deadlineClarification: (day) => `ഏത് ${day} ന് മുമ്പ് പൂർത്തിയാക്കണം?`,
    partyClarification: "ആരാണ് ആർക്കാണ് നൽകേണ്ടത്?",
    confirmedAck: "വാഗ്ദാനം സ്ഥിരീകരിച്ചു, നിങ്ങളുടെ രജിസ്റ്ററിൽ രേഖപ്പെടുത്തി.",
  },
  pa: {
    intro: (action, deadline, amount) => {
      let msg = `ਮੈਂ ਸੁਣਿਆ: ${action}`;
      if (deadline) msg += `, ${deadline} ਤੱਕ`;
      if (amount) msg += `, ਰਕਮ ${amount}`;
      return msg + "।";
    },
    currencyClarification: "ਕਿਹੜੀ ਕਰੰਸੀ ਵਿੱਚ ਭੁਗਤਾਨ ਹੋਵੇਗਾ?",
    deadlineClarification: (day) => `ਕਿਹੜੇ ${day} ਤੱਕ ਪੂਰਾ ਕਰਨਾ ਹੈ?`,
    partyClarification: "ਕਿਸਨੇ ਕਿਸਨੂੰ ਪੈਸੇ ਦੇਣੇ ਹਨ?",
    confirmedAck: "ਵਾਅਦਾ ਪੱਕਾ ਹੋ ਗਿਆ ਅਤੇ ਤੁਹਾਡੇ ਵਹੀ-ਖਾਤੇ ਵਿੱਚ ਦਰਜ ਹੋ ਗਿਆ।",
  },
  fa: {
    intro: (action, deadline, amount) => {
      let msg = `شنیدم: ${action}`;
      if (deadline) msg += `، تا تاریخ ${deadline}`;
      if (amount) msg += `، مبلغ ${amount}`;
      return msg + ".";
    },
    currencyClarification: "ارز مورد توافق چیست؟",
    deadlineClarification: (day) => `کدام ${day} مهلت نهایی است؟`,
    partyClarification: "چه کسی به چه کسی پرداخت می‌کند؟",
    confirmedAck: "تعهد تایید شد و در دفتر ثبت شما قرار گرفت.",
  },
  sw: {
    intro: (action, deadline, amount) => {
      let msg = `Nilisikia: ${action}`;
      if (deadline) msg += ` kabla ya ${deadline}`;
      if (amount) msg += `, kiasi ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Ni sarafu gani iliyokubaliwa?",
    deadlineClarification: (day) => `Ni ${day} gani ya mwisho wa makataa?`,
    partyClarification: "Nani anamlipa nani?",
    confirmedAck: "Ahadi imethibitishwa na kurekodiwa kwenye leja yako.",
  },
  th: {
    intro: (action, deadline, amount) => {
      let msg = `ฉันได้ยินว่า: ${action}`;
      if (deadline) msg += ` ภายใน ${deadline}`;
      if (amount) msg += ` จำนวน ${amount}`;
      return msg;
    },
    currencyClarification: "ตกลงกันด้วยสกุลเงินใด?",
    deadlineClarification: (day) => `เส้นตายคือวัน${day}ใด?`,
    partyClarification: "ใครจ่ายเงินให้ใคร?",
    confirmedAck: "คำมั่นสัญญาได้รับการยืนยันและบันทึกลงในสมุดบัญชีแล้ว",
  },
  pl: {
    intro: (action, deadline, amount) => {
      let msg = `Usłyszałem: ${action}`;
      if (deadline) msg += ` do ${deadline}`;
      if (amount) msg += `, kwota ${amount}`;
      return msg + ".";
    },
    currencyClarification: "W jakiej walucie uzgodniono płatność?",
    deadlineClarification: (day) => `Do którego ${day} jest termin?`,
    partyClarification: "Kto komu płaci?",
    confirmedAck: "Obietnica potwierdzona i zapisana w Twojej księdze.",
  },
  uk: {
    intro: (action, deadline, amount) => {
      let msg = `Я почув: ${action}`;
      if (deadline) msg += `, обіцяно до ${deadline}`;
      if (amount) msg += `, сума ${amount}`;
      return msg + ".";
    },
    currencyClarification: "У якій валюті домовленість?",
    deadlineClarification: (day) => `До якої саме ${day}?`,
    partyClarification: "Хто кому сплачує?",
    confirmedAck: "Обіцянку підтверджено та внесено до реєстру.",
  },
  nl: {
    intro: (action, deadline, amount) => {
      let msg = `Ik hoorde: ${action}`;
      if (deadline) msg += ` beloofd voor ${deadline}`;
      if (amount) msg += `, bedrag ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Welke valuta is overeengekomen?",
    deadlineClarification: (day) => `Voor welke ${day} is de deadline?`,
    partyClarification: "Wie betaalt aan wie?",
    confirmedAck: "Belofte bevestigd en vastgelegd in uw register.",
  },
  fil: {
    intro: (action, deadline, amount) => {
      let msg = `Narinig ko: ${action}`;
      if (deadline) msg += `, ipinangako bago ang ${deadline}`;
      if (amount) msg += `, halagang ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Anong pera ang napagkasunduan?",
    deadlineClarification: (day) => `Aling ${day} ang takdang oras?`,
    partyClarification: "Sino ang magbabayad kanino?",
    confirmedAck: "Kumpirmado ang pangako at naitala sa iyong ledger.",
  },
  ha: {
    intro: (action, deadline, amount) => {
      let msg = `Na ji: ${action}`;
      if (deadline) msg += `, an yi alkawari kafin ${deadline}`;
      if (amount) msg += `, adadin ${amount}`;
      return msg + ".";
    },
    currencyClarification: "Wace kudin aka amince da ita?",
    deadlineClarification: (day) => `Wace ${day} ce ranar karshe?`,
    partyClarification: "Wa zai biya wa?",
    confirmedAck: "An tabbatar da alkawari kuma an rubuta a littafinku.",
  },
};

/**
 * SpokenReadbackEngine
 */
export class SpokenReadbackEngine {
  /**
   * Generates a spoken readback response and identifies necessary clarification questions.
   */
  generatePromiseReadback(
    ledger: PromiseLedger,
    targetLanguage: string = "en",
  ): SpokenReadbackResult {
    const langRaw = targetLanguage.toLowerCase().trim();
    const langCode = langRaw;
    const template =
      READBACK_TEMPLATES[langRaw] ||
      READBACK_TEMPLATES[langRaw.substring(0, 2)] ||
      READBACK_TEMPLATES.en;
    const questions: ClarificationQuestion[] = [];

    // Analyze first commitment for primary oral readback
    const primaryCommitment: PromiseCommitment | undefined = ledger.commitments?.[0];
    const action = primaryCommitment
      ? primaryCommitment.obligation
      : (ledger.summaryText || "an oral agreement");

    const deadline = primaryCommitment?.deadlineText;
    const amountNum = primaryCommitment?.monetaryAmount?.value;
    const currency = primaryCommitment?.monetaryAmount?.currency;
    const amountStr = amountNum !== undefined ? `${amountNum}` : undefined;

    // Check for Ambiguity 1: Amount present but currency missing or generic
    const quote = primaryCommitment?.quoteSnippet || ledger.summaryText || "";
    if (
      amountNum !== undefined &&
      (!currency ||
        currency === "UNSPECIFIED" ||
        (currency === "USD" && !quote.includes("$") && !quote.toLowerCase().includes("dollar")))
    ) {
      questions.push({
        id: "clarify-currency",
        field: "currency",
        questionText: template.currencyClarification,
        spokenPrompt: template.currencyClarification,
        options: ["USD ($)", "INR (₹)", "EUR (€)", "GBP (£)", "AED"],
        resolved: false,
      });
    }

    // Check for Ambiguity 2: Relative weekday deadline (e.g. "by Friday", "this friday", "next monday") without specific calendar date
    if (
      deadline &&
      (/\b(friday|monday|tuesday|wednesday|thursday|saturday|sunday|tomorrow|weekend)\b/i.test(
        deadline.trim(),
      ) ||
        (primaryCommitment?.needsClarification &&
          primaryCommitment?.clarificationPrompt?.toLowerCase().includes("deadline")))
    ) {
      const dayMatch = deadline.match(/\b(friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b/i);
      const dayName = dayMatch ? dayMatch[1] : deadline.trim();
      questions.push({
        id: "clarify-deadline",
        field: "deadline",
        questionText: template.deadlineClarification(dayName),
        spokenPrompt: template.deadlineClarification(dayName),
        options: [`This upcoming ${dayName}`, `Next week's ${dayName}`],
        resolved: false,
      });
    }

    // Check for Ambiguity 3: Parties missing or generic
    if (!ledger.parties || ledger.parties.length < 2) {
      questions.push({
        id: "clarify-parties",
        field: "parties",
        questionText: template.partyClarification,
        spokenPrompt: template.partyClarification,
        resolved: false,
      });
    }

    const introMsg = template.intro(action, deadline, amountStr);
    let fullScript = introMsg;

    if (questions.length > 0) {
      const qPrompts = questions.map((q) => q.spokenPrompt).join(" ");
      fullScript += ` ${qPrompts}`;
    } else {
      fullScript += " Please confirm if this is correct.";
    }

    const status = questions.length > 0 ? "NEEDS_CLARIFICATION" : "READY_FOR_CONFIRMATION";

    return {
      readbackId: `readback-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      language: langCode,
      readbackText: fullScript,
      status,
      clarificationQuestions: questions,
      canSynthesizeLocally: this.canSynthesizeLocally(),
      audioPromptScript: fullScript,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Resolves an interactive clarification question and reconciles the promise ledger.
   */
  resolveClarification(
    readbackResult: SpokenReadbackResult,
    questionId: string,
    resolvedAnswer: string,
    originalLedger: PromiseLedger,
  ): {
    updatedResult: SpokenReadbackResult;
    updatedLedger: PromiseLedger;
  } {
    const updatedQuestions = readbackResult.clarificationQuestions.map((q) => {
      if (q.id === questionId) {
        return {
          ...q,
          resolved: true,
          resolvedValue: resolvedAnswer,
        };
      }
      return q;
    });

    const targetQuestion = readbackResult.clarificationQuestions?.find((q) => q.id === questionId);
    if (!targetQuestion) {
      return { updatedResult: readbackResult, updatedLedger: originalLedger };
    }

    let resolvedCurr = resolvedAnswer.trim();
    const currMatch = resolvedAnswer.match(/\b([A-Z]{3})\b/);
    if (currMatch) {
      resolvedCurr = currMatch[1];
    } else {
      const lowerAns = resolvedAnswer.toLowerCase().trim();
      for (const [code, info] of Object.entries(GLOBAL_CURRENCIES)) {
        if (
          info.symbol.toLowerCase() === lowerAns ||
          code.toLowerCase() === lowerAns ||
          info.terms.some((t) => lowerAns.includes(t.toLowerCase()))
        ) {
          resolvedCurr = code;
          break;
        }
      }
    }

    let updatedParties = [...(originalLedger.parties || [])];
    if (targetQuestion.field === "parties") {
      const parts = resolvedAnswer
        .split(/(?:,|\band\b|\bto\b|\bpaying\b)/i)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      if (parts.length >= 2) {
        updatedParties = [
          { id: "party-1", name: parts[0], role: "promisor" },
          { id: "party-2", name: parts[1], role: "promisee" },
        ];
      } else if (parts.length === 1) {
        if (updatedParties.length > 0) {
          updatedParties[0] = { ...updatedParties[0], name: parts[0] };
        } else {
          updatedParties = [{ id: "party-1", name: parts[0], role: "promisor" }];
        }
      }
    }

    // Deep clone ledger commitments for mutation across all matching commitments
    const updatedCommitments: PromiseCommitment[] = (originalLedger.commitments || []).map((c) => {
      const updated = { ...c };

      if (targetQuestion.field === "currency") {
        if (updated.monetaryAmount) {
          updated.monetaryAmount = {
            ...updated.monetaryAmount,
            currency: resolvedCurr,
          };
        }
        updated.needsClarification = false;
        updated.clarificationPrompt = undefined;
      } else if (targetQuestion.field === "deadline") {
        updated.deadlineText = resolvedAnswer.trim();
        updated.needsClarification = false;
        updated.clarificationPrompt = undefined;
      } else if (targetQuestion.field === "condition") {
        updated.condition = resolvedAnswer.trim();
      } else if (targetQuestion.field === "parties") {
        if (updatedParties.length >= 2) {
          updated.promisor = updatedParties[0].name;
          updated.promisee = updatedParties[1].name;
        }
        updated.needsClarification = false;
        updated.clarificationPrompt = undefined;
      }
      return updated;
    });

    const updatedLedger: PromiseLedger = {
      ...originalLedger,
      parties: updatedParties,
      commitments: updatedCommitments,
    };

    const allResolved = updatedQuestions.every((q) => q.resolved);
    const langRaw = readbackResult.language.toLowerCase().trim();
    const template =
      READBACK_TEMPLATES[langRaw] ||
      READBACK_TEMPLATES[langRaw.substring(0, 2)] ||
      READBACK_TEMPLATES.en;

    let updatedReadbackText = "";
    const primaryCommitment = updatedCommitments[0];
    const action = primaryCommitment?.obligation || updatedLedger.summaryText || "";
    const deadline = primaryCommitment?.deadlineText;
    const amountStr = primaryCommitment?.monetaryAmount ? String(primaryCommitment.monetaryAmount.value) : undefined;

    if (allResolved) {
      updatedReadbackText = `${template.confirmedAck} ${template.intro(action, deadline, amountStr)}`;
    } else {
      const remainingUnresolved = updatedQuestions.filter((q) => !q.resolved);
      updatedReadbackText = `${template.intro(action, deadline, amountStr)} ${remainingUnresolved.map((q) => q.spokenPrompt).join(" ")}`;
    }

    const updatedResult: SpokenReadbackResult = {
      ...readbackResult,
      status: allResolved ? "CONFIRMED" : "NEEDS_CLARIFICATION",
      clarificationQuestions: updatedQuestions,
      readbackText: updatedReadbackText,
      audioPromptScript: updatedReadbackText,
      timestamp: new Date().toISOString(),
    };

    return { updatedResult, updatedLedger };
  }

  /**
   * Check if local browser speech synthesis is supported.
   * Never contacts external servers.
   */
  canSynthesizeLocally(): boolean {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      return true;
    }
    return false;
  }

  /**
   * Speak prompt locally in the user's browser without sending any audio off-device.
   */
  async speakLocally(text: string, language: string = "en"): Promise<boolean> {
    if (!this.canSynthesizeLocally()) {
      return false;
    }

    return new Promise((resolve) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onend = () => resolve(true);
        utterance.onerror = () => resolve(false);

        window.speechSynthesis.cancel(); // cancel any pending audio
        window.speechSynthesis.speak(utterance);
      } catch {
        resolve(false);
      }
    });
  }
}

export const globalSpokenReadbackEngine = new SpokenReadbackEngine();
