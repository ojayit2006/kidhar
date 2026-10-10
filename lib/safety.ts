import type { L } from "./i18n";

export type SafetyType = "fire" | "medical" | "accident" | "crime" | "other";

/** Curated, conservative first-response guidance. Deliberately static, never model-generated. */
export const SAFETY: Record<SafetyType, Record<L, string[]>> = {
  fire: {
    en: [
      "Get out now. Do not stop for belongings.",
      "Stay low under the smoke. Cover your nose and mouth with a wet cloth if you can.",
      "Feel doors with the back of your hand before opening. If hot, do not open.",
      "Do not use lifts. Use the stairs.",
      "Once you are out, stay out. Do not go back inside.",
      "Keep your phone free and stay in touch with the fire service (101) or 112.",
    ],
    hi: [
      "तुरंत बाहर निकलें। सामान के लिए न रुकें।",
      "धुएँ के नीचे झुककर चलें। हो सके तो गीला कपड़ा नाक और मुँह पर रखें।",
      "दरवाज़ा खोलने से पहले हाथ के पिछले हिस्से से छूकर देखें। गर्म हो तो न खोलें।",
      "लिफ्ट का उपयोग न करें, सीढ़ियों से उतरें।",
      "बाहर निकलने के बाद वापस अंदर न जाएँ।",
      "फ़ोन खाली रखें और दमकल (101) या 112 से संपर्क में रहें।",
    ],
    mr: [
      "ताबडतोब बाहेर पडा. सामानासाठी थांबू नका.",
      "धुराखाली खाली वाकून चाला. शक्य असल्यास ओला कपडा नाक-तोंडावर धरा.",
      "दार उघडण्यापूर्वी हाताच्या मागच्या बाजूने स्पर्श करून पहा. गरम असल्यास उघडू नका.",
      "लिफ्ट वापरू नका, जिन्याने उतरा.",
      "बाहेर आल्यावर परत आत जाऊ नका.",
      "फोन मोकळा ठेवा आणि अग्निशमन (101) किंवा 112 शी संपर्कात रहा.",
    ],
  },
  medical: {
    en: [
      "Check whether the person responds and is breathing normally.",
      "If they are unresponsive and not breathing normally: push hard and fast in the centre of the chest (about 100 to 120 times a minute) without stopping.",
      "If an AED (defibrillator) is nearby, send someone to get it.",
      "Do not give food or drink. Do not move them if you suspect a neck or back injury.",
      "Stay with them until help arrives.",
    ],
    hi: [
      "देखें कि व्यक्ति जवाब दे रहा है और सामान्य रूप से साँस ले रहा है।",
      "अगर वह बेहोश है और सामान्य साँस नहीं ले रहा: छाती के बीच में ज़ोर से और तेज़ी से दबाएँ (लगभग 100–120 प्रति मिनट), बिना रुके।",
      "पास में AED (डिफिब्रिलेटर) हो तो किसी से मँगवाएँ।",
      "कुछ खाने-पीने को न दें। गर्दन या पीठ में चोट का शक हो तो हिलाएँ नहीं।",
      "मदद आने तक साथ रहें।",
    ],
    mr: [
      "व्यक्ती प्रतिसाद देत आहे का आणि सामान्यपणे श्वास घेत आहे का ते पहा.",
      "बेशुद्ध असेल आणि सामान्य श्वास नसेल तर: छातीच्या मध्यभागी जोरात आणि वेगाने दाबा (सुमारे 100–120 प्रति मिनिट), न थांबता.",
      "जवळ AED (डिफिब्रिलेटर) असल्यास कोणाला तरी आणायला सांगा.",
      "खायला-प्यायला देऊ नका. मान किंवा पाठीला दुखापतीचा संशय असल्यास हलवू नका.",
      "मदत येईपर्यंत सोबत रहा.",
    ],
  },
  accident: {
    en: [
      "Make yourself safe from traffic first. Switch on hazard lights.",
      "Do not move injured people unless there is immediate danger such as fire.",
      "For heavy bleeding, press firmly on the wound with a clean cloth.",
      "Do not remove a motorcyclist's helmet.",
      "Stay and keep the operator updated.",
    ],
    hi: [
      "पहले ट्रैफ़िक से खुद को सुरक्षित करें। हैज़ार्ड लाइट चालू करें।",
      "घायल को तब तक न हिलाएँ जब तक तुरंत खतरा (जैसे आग) न हो।",
      "तेज़ खून बहने पर साफ़ कपड़े से घाव को कसकर दबाएँ।",
      "बाइक सवार का हेलमेट न उतारें।",
      "रुकें और ऑपरेटर को ताज़ा जानकारी देते रहें।",
    ],
    mr: [
      "आधी वाहतुकीपासून स्वतःला सुरक्षित करा. हॅझार्ड लाइट सुरू करा.",
      "तात्काळ धोका (उदा. आग) नसल्यास जखमीला हलवू नका.",
      "जोरात रक्तस्राव होत असेल तर स्वच्छ कापडाने जखम घट्ट दाबून धरा.",
      "दुचाकीस्वाराचे हेल्मेट काढू नका.",
      "थांबा आणि ऑपरेटरला ताजी माहिती देत रहा.",
    ],
  },
  crime: {
    en: [
      "Move to a safe place and lock the door if you can.",
      "Do not confront the person.",
      "Remember descriptions, vehicle numbers and the direction they went.",
      "Keep the phone line open. If it is not safe to speak, stay on the line quietly.",
    ],
    hi: [
      "किसी सुरक्षित जगह जाएँ और हो सके तो दरवाज़ा बंद कर लें।",
      "हमलावर का सामना न करें।",
      "हुलिया, गाड़ी का नंबर और दिशा याद रखें।",
      "फ़ोन चालू रखें। बोलना सुरक्षित न हो तो बिना बोले लाइन पर रहें।",
    ],
    mr: [
      "सुरक्षित ठिकाणी जा आणि शक्य असल्यास दार बंद करा.",
      "हल्लेखोराचा सामना करू नका.",
      "वर्णन, वाहन क्रमांक आणि दिशा लक्षात ठेवा.",
      "फोन चालू ठेवा. बोलणे सुरक्षित नसेल तर न बोलता लाइनवर रहा.",
    ],
  },
  other: {
    en: [
      "Stay in a safe place and move away from danger.",
      "Keep your phone on and answer the operator's questions.",
      "Keep landmarks that describe your location in mind.",
    ],
    hi: [
      "सुरक्षित जगह पर रहें और खतरे से दूर जाएँ।",
      "फ़ोन चालू रखें और ऑपरेटर के सवालों का जवाब दें।",
      "अपनी जगह बताने वाली निशानियाँ (लैंडमार्क) याद रखें।",
    ],
    mr: [
      "सुरक्षित ठिकाणी रहा आणि धोक्यापासून दूर जा.",
      "फोन चालू ठेवा आणि ऑपरेटरच्या प्रश्नांना उत्तर द्या.",
      "तुमचे स्थान सांगणाऱ्या खुणा (लँडमार्क) लक्षात ठेवा.",
    ],
  },
};

export const safetyType = (t?: string | null): SafetyType => (t === "fire" || t === "medical" || t === "accident" || t === "crime" ? t : "other");

export const HELPLINES: { number: string; label: Record<L, string> }[] = [
  { number: "112", label: { en: "Emergency (all services)", hi: "आपातकालीन (सभी सेवाएँ)", mr: "आणीबाणी (सर्व सेवा)" } },
  { number: "100", label: { en: "Police", hi: "पुलिस", mr: "पोलीस" } },
  { number: "101", label: { en: "Fire brigade", hi: "दमकल", mr: "अग्निशमन" } },
  { number: "108", label: { en: "Emergency ambulance (Maharashtra)", hi: "आपातकालीन एम्बुलेंस (महाराष्ट्र)", mr: "आपत्कालीन रुग्णवाहिका (महाराष्ट्र)" } },
  { number: "1916", label: { en: "BMC disaster control (Mumbai)", hi: "बीएमसी आपदा नियंत्रण (मुंबई)", mr: "बीएमसी आपत्ती नियंत्रण (मुंबई)" } },
  { number: "181", label: { en: "Women helpline", hi: "महिला हेल्पलाइन", mr: "महिला हेल्पलाइन" } },
  { number: "1098", label: { en: "Childline", hi: "चाइल्डलाइन", mr: "चाइल्डलाइन" } },
  { number: "1930", label: { en: "Cyber fraud", hi: "साइबर धोखाधड़ी", mr: "सायबर फसवणूक" } },
];
