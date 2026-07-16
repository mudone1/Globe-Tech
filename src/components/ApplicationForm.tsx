"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { recordVisit, submitApplication } from "@/app/apply/[token]/actions";
import type { SubmitApplicationInput } from "@/app/apply/[token]/actions";
import styles from "@/components/ChatApplicationForm.module.css";

/* ============================================================
   DATA
   ============================================================ */

const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

const NIGERIA_LGAS_BY_STATE: Record<string, string[]> = {
  Abia: ["Aba North", "Aba South", "Arochukwu", "Bende", "Ikwuano", "Isiala Ngwa North", "Isiala Ngwa South", "Isuikwuato", "Obi Ngwa", "Ohafia", "Osisioma", "Ugwunagbo", "Ukwa East", "Ukwa West", "Umuahia North", "Umuahia South", "Umu Nneochi"],
  Adamawa: ["Demsa", "Fufure", "Ganye", "Gayuk", "Gombi", "Grie", "Hong", "Jada", "Lamurde", "Madagali", "Maiha", "Mayo Belwa", "Michika", "Mubi North", "Mubi South", "Numan", "Shelleng", "Song", "Toungo", "Yola North", "Yola South"],
  "Akwa Ibom": ["Abak", "Eastern Obolo", "Eket", "Esit Eket", "Essien Udim", "Etim Ekpo", "Etinan", "Ibeno", "Ibesikpo Asutan", "Ibiono Ibom", "Ika", "Ikono", "Ikot Abasi", "Ikot Ekpene", "Ini", "Itu", "Mbo", "Mkpat Enin", "Nsit Atai", "Nsit Ibom", "Nsit Ubium", "Obot Akara", "Okobo", "Onna", "Oron", "Oruk Anam", "Udung Uko", "Ukanafun", "Uruan", "Urue-Offong/Oruko", "Uyo"],
  Anambra: ["Aguata", "Anambra East", "Anambra West", "Anaocha", "Awka North", "Awka South", "Ayamelum", "Dunukofia", "Ekwusigo", "Idemili North", "Idemili South", "Ihiala", "Njikoka", "Nnewi North", "Nnewi South", "Ogbaru", "Onitsha North", "Onitsha South", "Orumba North", "Orumba South", "Oyi"],
  Bauchi: ["Alkaleri", "Bauchi", "Bogoro", "Damban", "Darazo", "Dass", "Gamawa", "Ganjuwa", "Giade", "Itas/Gadau", "Jama'are", "Katagum", "Kirfi", "Misau", "Ningi", "Shira", "Tafawa Balewa", "Toro", "Warji", "Zaki"],
  Bayelsa: ["Brass", "Ekeremor", "Kolokuma/Opokuma", "Nembe", "Ogbia", "Sagbama", "Southern Ijaw", "Yenagoa"],
  Benue: ["Ado", "Agatu", "Apa", "Buruku", "Gboko", "Guma", "Gwer East", "Gwer West", "Katsina-Ala", "Konshisha", "Kwande", "Logo", "Makurdi", "Obi", "Ogbadibo", "Ohimini", "Oju", "Okpokwu", "Otukpo", "Tarka", "Ukum", "Ushongo", "Vandeikya"],
  Borno: ["Abadam", "Askira/Uba", "Bama", "Bayo", "Biu", "Chibok", "Damboa", "Dikwa", "Gubio", "Guzamala", "Gwoza", "Hawul", "Jere", "Kaga", "Kala/Balge", "Konduga", "Kukawa", "Kwaya Kusar", "Mafa", "Magumeri", "Maiduguri", "Marte", "Mobbar", "Monguno", "Ngala", "Nganzai", "Shani"],
  "Cross River": ["Abi", "Akamkpa", "Akpabuyo", "Bakassi", "Bekwarra", "Biase", "Boki", "Calabar Municipal", "Calabar South", "Etung", "Ikom", "Obanliku", "Obubra", "Obudu", "Odukpani", "Ogoja", "Yakuur", "Yala"],
  Delta: ["Aniocha North", "Aniocha South", "Bomadi", "Burutu", "Ethiope East", "Ethiope West", "Ika North East", "Ika South", "Isoko North", "Isoko South", "Ndokwa East", "Ndokwa West", "Okpe", "Oshimili North", "Oshimili South", "Patani", "Sapele", "Udu", "Ughelli North", "Ughelli South", "Ukwuani", "Uvwie", "Warri North", "Warri South", "Warri South West"],
  Ebonyi: ["Abakaliki", "Afikpo North", "Afikpo South", "Ebonyi", "Ezza North", "Ezza South", "Ikwo", "Ishielu", "Ivo", "Izzi", "Ohaozara", "Ohaukwu", "Onicha"],
  Edo: ["Akoko-Edo", "Egor", "Esan Central", "Esan North-East", "Esan South-East", "Esan West", "Etsako Central", "Etsako East", "Etsako West", "Igueben", "Ikpoba Okha", "Orhionmwon", "Oredo", "Ovia North-East", "Ovia South-West", "Owan East", "Owan West", "Uhunmwonde"],
  Ekiti: ["Ado Ekiti", "Efon", "Ekiti East", "Ekiti South-West", "Ekiti West", "Emure", "Gbonyin", "Ido Osi", "Ijero", "Ikere", "Ikole", "Ilejemeje", "Irepodun/Ifelodun", "Ise/Orun", "Moba", "Oye"],
  Enugu: ["Aninri", "Awgu", "Enugu East", "Enugu North", "Enugu South", "Ezeagu", "Igbo Etiti", "Igbo Eze North", "Igbo Eze South", "Isi Uzo", "Nkanu East", "Nkanu West", "Nsukka", "Oji River", "Udenu", "Udi", "Uzo Uwani"],
  "FCT - Abuja": ["Abaji", "Abuja Municipal", "Bwari", "Gwagwalada", "Kuje", "Kwali"],
  Gombe: ["Akko", "Balanga", "Billiri", "Dukku", "Funakaye", "Gombe", "Kaltungo", "Kwami", "Nafada", "Shongom", "Yamaltu/Deba"],
  Imo: ["Aboh Mbaise", "Ahiazu Mbaise", "Ehime Mbano", "Ezinihitte", "Ideato North", "Ideato South", "Ihitte/Uboma", "Ikeduru", "Isiala Mbano", "Isu", "Mbaitoli", "Ngor Okpala", "Njaba", "Nkwerre", "Nwangele", "Obowo", "Oguta", "Ohaji/Egbema", "Okigwe", "Orlu", "Orsu", "Oru East", "Oru West", "Owerri Municipal", "Owerri North", "Owerri West", "Unuimo"],
  Jigawa: ["Auyo", "Babura", "Biriniwa", "Birnin Kudu", "Buji", "Dutse", "Gagarawa", "Garki", "Gumel", "Guri", "Gwaram", "Gwiwa", "Hadejia", "Jahun", "Kafin Hausa", "Kaugama", "Kazaure", "Kiri Kasama", "Kiyawa", "Maigatari", "Malam Madori", "Miga", "Ringim", "Roni", "Sule Tankarkar", "Taura", "Yankwashi"],
  Kaduna: ["Birnin Gwari", "Chikun", "Giwa", "Igabi", "Ikara", "Jaba", "Jema'a", "Kachia", "Kaduna North", "Kaduna South", "Kagarko", "Kajuru", "Kaura", "Kauru", "Kubau", "Kudan", "Lere", "Makarfi", "Sabon Gari", "Sanga", "Soba", "Zangon Kataf", "Zaria"],
  Kano: ["Ajingi", "Albasu", "Bagwai", "Bebeji", "Bichi", "Bunkure", "Dala", "Dambatta", "Dawakin Kudu", "Dawakin Tofa", "Doguwa", "Fagge", "Gabasawa", "Garko", "Garun Mallam", "Gaya", "Gezawa", "Gwale", "Gwarzo", "Kabo", "Kano Municipal", "Karaye", "Kibiya", "Kiru", "Kumbotso", "Kunchi", "Kura", "Madobi", "Makoda", "Minjibir", "Nasarawa", "Rano", "Rimin Gado", "Rogo", "Shanono", "Sumaila", "Takai", "Tarauni", "Tofa", "Tsanyawa", "Tudun Wada", "Ungogo", "Warawa", "Wudil"],
  Katsina: ["Bakori", "Batagarawa", "Batsari", "Baure", "Bindawa", "Charanchi", "Dan Musa", "Dandume", "Danja", "Daura", "Dutsi", "Dutsin-Ma", "Faskari", "Funtua", "Ingawa", "Jibia", "Kafur", "Kaita", "Kankara", "Kankia", "Katsina", "Kurfi", "Kusada", "Mai'Adua", "Malumfashi", "Mani", "Mashi", "Matazu", "Musawa", "Rimi", "Sabuwa", "Safana", "Sandamu", "Zango"],
  Kebbi: ["Aleiro", "Arewa Dandi", "Argungu", "Augie", "Bagudo", "Birnin Kebbi", "Bunza", "Dandi", "Fakai", "Gwandu", "Jega", "Kalgo", "Koko/Besse", "Maiyama", "Ngaski", "Sakaba", "Shanga", "Suru", "Wasagu/Danko", "Yauri", "Zuru"],
  Kogi: ["Adavi", "Ajaokuta", "Ankpa", "Bassa", "Dekina", "Ibaji", "Idah", "Igalamela Odolu", "Ijumu", "Kabba/Bunu", "Kogi", "Lokoja", "Mopa Muro", "Ofu", "Ogori/Magongo", "Okehi", "Okene", "Olamaboro", "Omala", "Yagba East", "Yagba West"],
  Kwara: ["Asa", "Baruten", "Edu", "Ekiti", "Ifelodun", "Ilorin East", "Ilorin South", "Ilorin West", "Irepodun", "Isin", "Kaiama", "Moro", "Offa", "Oke Ero", "Oyun", "Pategi"],
  Lagos: ["Agege", "Ajeromi-Ifelodun", "Alimosho", "Amuwo-Odofin", "Apapa", "Badagry", "Epe", "Eti Osa", "Ibeju-Lekki", "Ifako-Ijaiye", "Ikeja", "Ikorodu", "Kosofe", "Lagos Island", "Lagos Mainland", "Mushin", "Ojo", "Oshodi-Isolo", "Shomolu", "Surulere"],
  Nasarawa: ["Akwanga", "Awe", "Doma", "Karu", "Keana", "Keffi", "Kokona", "Lafia", "Nasarawa", "Nasarawa Egon", "Obi", "Toto", "Wamba"],
  Niger: ["Agaie", "Agwara", "Bida", "Borgu", "Bosso", "Chanchaga", "Edati", "Gbako", "Gurara", "Katcha", "Kontagora", "Lapai", "Lavun", "Magama", "Mariga", "Mashegu", "Mokwa", "Moya", "Paikoro", "Rafi", "Rijau", "Shiroro", "Suleja", "Tafa", "Wushishi"],
  Ogun: ["Abeokuta North", "Abeokuta South", "Ado-Odo/Ota", "Ewekoro", "Ifo", "Ijebu East", "Ijebu North", "Ijebu North East", "Ijebu Ode", "Ikenne", "Imeko Afon", "Ipokia", "Obafemi Owode", "Odeda", "Odogbolu", "Ogun Waterside", "Remo North", "Shagamu", "Yewa North", "Yewa South"],
  Ondo: ["Akoko North-East", "Akoko North-West", "Akoko South-East", "Akoko South-West", "Akure North", "Akure South", "Ese Odo", "Idanre", "Ifedore", "Ilaje", "Ile Oluji/Okeigbo", "Irele", "Odigbo", "Okitipupa", "Ondo East", "Ondo West", "Ose", "Owo"],
  Osun: ["Aiyedaade", "Aiyedire", "Atakunmosa East", "Atakunmosa West", "Boluwaduro", "Boripe", "Ede North", "Ede South", "Egbedore", "Ejigbo", "Ife Central", "Ife East", "Ife North", "Ife South", "Ifedayo", "Ifelodun", "Ila", "Ilesa East", "Ilesa West", "Irepodun", "Irewole", "Isokan", "Iwo", "Obokun", "Odo Otin", "Ola Oluwa", "Olorunda", "Oriade", "Orolu", "Osogbo"],
  Oyo: ["Afijio", "Akinyele", "Atiba", "Atisbo", "Egbeda", "Ibadan North", "Ibadan North-East", "Ibadan North-West", "Ibadan South-East", "Ibadan South-West", "Ibarapa Central", "Ibarapa East", "Ibarapa North", "Ido", "Irepo", "Iseyin", "Itesiwaju", "Iwajowa", "Kajola", "Lagelu", "Ogbomosho North", "Ogbomosho South", "Ogo Oluwa", "Olorunsogo", "Oluyole", "Ona Ara", "Orelope", "Ori Ire", "Oyo East", "Oyo West", "Saki East", "Saki West", "Surulere"],
  Plateau: ["Barkin Ladi", "Bassa", "Bokkos", "Jos East", "Jos North", "Jos South", "Kanam", "Kanke", "Langtang North", "Langtang South", "Mangu", "Mikang", "Pankshin", "Qua'an Pan", "Riyom", "Shendam", "Wase"],
  Rivers: ["Abua/Odual", "Ahoada East", "Ahoada West", "Akuku-Toru", "Andoni", "Asari-Toru", "Bonny", "Degema", "Eleme", "Emuoha", "Etche", "Gokana", "Ikwerre", "Khana", "Obio/Akpor", "Ogba/Egbema/Ndoni", "Ogu/Bolo", "Okrika", "Omuma", "Opobo/Nkoro", "Oyigbo", "Port Harcourt", "Tai"],
  Sokoto: ["Binji", "Bodinga", "Dange Shuni", "Gada", "Goronyo", "Gudu", "Gwadabawa", "Illela", "Isa", "Kebbe", "Kware", "Rabah", "Sabon Birni", "Shagari", "Silame", "Sokoto North", "Sokoto South", "Tambuwal", "Tangaza", "Tureta", "Wamako", "Wurno", "Yabo"],
  Taraba: ["Ardo Kola", "Bali", "Donga", "Gashaka", "Gassol", "Ibi", "Jalingo", "Karim Lamido", "Kumi", "Lau", "Sardauna", "Takum", "Ussa", "Wukari", "Yorro", "Zing"],
  Yobe: ["Bade", "Bursari", "Damaturu", "Fika", "Fune", "Geidam", "Gujba", "Gulani", "Jakusko", "Karasuwa", "Machina", "Nangere", "Nguru", "Potiskum", "Tarmuwa", "Yunusari", "Yusufari"],
  Zamfara: ["Anka", "Bakura", "Birnin Magaji/Kiyaw", "Bukkuyum", "Bungudu", "Gummi", "Gusau", "Kaura Namoda", "Maradun", "Maru", "Shinkafi", "Talata Mafara", "Tsafe", "Zurmi"],
};

const LGA_OTHER = "My LGA isn't listed";

const INDUSTRIES = [
  "Agriculture & Agribusiness", "Technology & Software", "Education", "Healthcare",
  "FinTech", "Manufacturing", "Retail & E-commerce", "Fashion & Beauty",
  "Food & Hospitality", "Logistics & Transportation", "Real Estate",
  "Creative Industry", "Professional Services", "Renewable Energy", "Other",
];

const SUPPORT_CATEGORIES = [
  "Startup Capital Support",
  "Scaling Capital Support",
  "Expansion Capital Support",
];

const CURRENT_STATUS_OPTIONS = [
  "Full-time entrepreneur",
  "Part-time entrepreneur",
  "Student entrepreneur",
  "Employee running a business",
  "Aspiring entrepreneur (business yet to start)",
];

const BUSINESS_STAGE_OPTIONS = [
  "Idea Stage (Business concept only, not yet launched)",
  "Pre-launch Stage (Preparing to start)",
  "Early Stage (0–2 years in operation)",
  "Growth Stage (2–5 years in operation)",
  "Established Stage (5+ years in operation)",
];

const OPERATING_DURATION_OPTIONS = [
  "Yet to start operations",
  "Less than 6 months",
  "6 months – 1 year",
  "2–3 years",
  "3–4 years",
  "5 years and above",
];

const REGISTRATION_STATUS_OPTIONS = [
  "Yes, my CAC certificate is available",
  "Yes, I have paid for registration and awaiting completion",
  "No, but I intend to register",
  "No",
];

const OPERATING_LOCATION_OPTIONS = ["Online only", "Physical location only", "Both online and physical location"];

const EMPLOYEE_COUNT_OPTIONS = ["Just me", "2–5 people", "6–10 people", "11–25 people", "More than 25 people"];

const AVG_MONTHLY_REVENUE_OPTIONS = [
  "Less than ₦50,000",
  "₦50,000 – ₦250,000",
  "₦250,000 – ₦1 Million",
  "₦1 Million – ₦5 Million",
  "Above ₦5 Million",
];

const CUSTOMER_CHANNEL_OPTIONS = [
  "Social Media", "Referrals", "Website", "Online Marketplace",
  "Physical Location", "Advertising", "Partnerships", "Other",
];

const FUNDING_USE_OPTIONS = [
  "Equipment purchase", "Inventory/stock", "Marketing and customer acquisition",
  "Technology development", "Hiring staff", "Business registration",
  "Expansion to new locations", "Product development", "Working capital", "Other",
];

const JOBS_TO_CREATE_OPTIONS = ["1–5 jobs", "6–20 jobs", "21–50 jobs", "More than 50 jobs"];

const IMPROVEMENT_AREA_OPTIONS = [
  "Business Strategy", "Marketing & Sales", "Financial Management", "Branding",
  "Digital Transformation", "Customer Acquisition", "Operations Management",
  "Leadership", "Fundraising",
];

const HOW_HEARD_OPTIONS = [
  "Social Media", "Friend/Referral", "Partner Organization", "Email", "Website", "Event", "Other",
];

const MIN_AGE_YEARS = 15;

function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function maxDobForMinAge(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
  return d.toISOString().slice(0, 10);
}

function fname(a: FormState): string {
  return a.applicantName.trim().split(/\s+/)[0] || "there";
}

/* ============================================================
   FORM SHAPE
   ============================================================ */

type FormState = Omit<SubmitApplicationInput, "token" | "honeypot">;
type FieldValue = string | number | string[] | boolean;

const initialState: FormState = {
  applicantName: "",
  gender: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  stateOfResidence: "",
  lga: "",
  linkedin: "",
  businessSocialHandle: "",

  currentStatus: "",
  hasPriorBusiness: "",
  priorBusinessDescription: "",

  businessName: "",
  businessDescription: "",
  industry: "",
  supportCategory: "",

  businessStage: "",
  operatingDuration: "",
  dateEstablished: "",
  registrationStatus: "",
  cacNumber: "",
  operatingLocation: "",
  employeeCount: "",

  hasRevenue: "",
  avgMonthlyRevenue: "",
  revenueLast12Months: "",
  mainCustomers: "",
  customerAcquisitionChannels: [],

  grantAmountRequested: 0,
  fundingUse: [],
  fundingGrowthExplanation: "",
  biggestChallenge: "",

  whyStartBusiness: "",
  problemSolved: "",
  desiredImpact: "",
  fiveYearVision: "",
  jobsToCreate: "",

  whyApplying: "",
  whySelected: "",
  whatMakesDifferent: "",
  appliedBefore: "",
  receivedFundingBefore: "",
  priorFundingDetails: "",

  willingAcademy: "",
  willingMentorship: "",
  improvementAreas: [],

  howHeard: "",
  entrepreneurNetwork: "",

  declarationAgreed: false,
};

/* ============================================================
   QUESTIONS — one at a time, in order
   ============================================================ */

type QType = "text" | "email" | "tel" | "date" | "number" | "textarea" | "select" | "quickreply" | "multiselect" | "lga" | "checkbox";

interface Question {
  id: keyof FormState;
  type: QType;
  label: string; // static label, used in the summary review
  question: (a: FormState) => string;
  placeholder?: string;
  options?: string[];
  required?: boolean | ((a: FormState) => boolean);
  showIf?: (a: FormState) => boolean;
  eyebrow?: string;
  twoCol?: boolean;
  checkboxText?: string;
}

const QUESTIONS: Question[] = [
  { id: "applicantName", type: "text", label: "Full name", eyebrow: "Personal Information", placeholder: "Full name",
    question: () => "Let's start simple — what's your full name?" },
  { id: "gender", type: "quickreply", label: "Gender", twoCol: true, options: ["Male", "Female"],
    question: (a) => `Hi ${fname(a)}! Hope you're doing well today. What's your gender?` },
  { id: "dateOfBirth", type: "date", label: "Date of birth",
    question: () => "And your date of birth?" },
  { id: "phone", type: "tel", label: "Phone number", placeholder: "08012345678",
    question: () => "What's the best phone number to reach you on?" },
  { id: "email", type: "email", label: "Email address", placeholder: "you@example.com",
    question: () => "And your email address?" },
  { id: "stateOfResidence", type: "select", label: "State of residence", options: NIGERIA_STATES,
    question: () => "Which state do you currently live in?" },
  { id: "lga", type: "lga", label: "Local Government Area",
    question: () => "Nice — and which Local Government Area?" },
  { id: "linkedin", type: "text", label: "LinkedIn profile", required: false, placeholder: "linkedin.com/in/…",
    question: () => "Got a LinkedIn profile? Drop the link — or skip this one." },
  { id: "businessSocialHandle", type: "text", label: "Business social handle", required: false, placeholder: "@yourbusiness",
    question: () => "And a social handle for your business, if you have one?" },

  { id: "currentStatus", type: "quickreply", label: "Current status", eyebrow: "Entrepreneur Profile", options: CURRENT_STATUS_OPTIONS,
    question: (a) => `Thanks, ${fname(a)}. What best describes your current status?` },
  { id: "hasPriorBusiness", type: "quickreply", label: "Prior business experience", twoCol: true, options: ["Yes", "No"],
    question: () => "Have you previously started or managed a business before?" },
  { id: "priorBusinessDescription", type: "textarea", label: "Prior business description",
    showIf: (a) => a.hasPriorBusiness === "Yes",
    question: () => "Nice — tell me a bit about that previous business." },

  { id: "businessName", type: "text", label: "Business name", eyebrow: "Business Information", required: true,
    question: () => "Let's talk about your business — what's your business name again?" },
  { id: "businessDescription", type: "textarea", label: "Business description", placeholder: "What products/services do you provide?",
    question: (a) => `${a.businessName.trim() || "Nice name"} — what does it actually do?` },
  { id: "industry", type: "select", label: "Industry", options: INDUSTRIES,
    question: () => "What industry does it operate in?" },
  { id: "supportCategory", type: "quickreply", label: "Support category", options: SUPPORT_CATEGORIES,
    question: () => "What category of support are you applying for?" },

  { id: "businessStage", type: "quickreply", label: "Business stage", eyebrow: "Business Stage & Operations", options: BUSINESS_STAGE_OPTIONS,
    question: () => "Good — now let's talk about where things stand. What stage is your business at?" },
  { id: "operatingDuration", type: "quickreply", label: "Operating duration", options: OPERATING_DURATION_OPTIONS,
    question: () => "How long has it been operating?" },
  { id: "dateEstablished", type: "date", label: "Date established",
    question: () => "When was it established or launched?" },
  { id: "registrationStatus", type: "quickreply", label: "Registration status", options: REGISTRATION_STATUS_OPTIONS,
    question: () => "Is your business currently registered with the CAC?" },
  { id: "cacNumber", type: "text", label: "CAC registration number", required: (a) => a.registrationStatus === "Yes, my CAC certificate is available",
    question: (a) => (a.registrationStatus === "Yes, my CAC certificate is available"
      ? "Great — what's your CAC registration number?"
      : "Have a CAC registration number yet? Add it here, or skip for now.") },
  { id: "operatingLocation", type: "quickreply", label: "Operating location", options: OPERATING_LOCATION_OPTIONS,
    question: () => "Where does your business currently operate?" },
  { id: "employeeCount", type: "quickreply", label: "Employee count", options: EMPLOYEE_COUNT_OPTIONS,
    question: () => "How many people currently work in the business?" },

  { id: "hasRevenue", type: "quickreply", label: "Generating revenue", twoCol: true, eyebrow: "Revenue & Business Performance", options: ["Yes", "No"],
    question: () => "Has your business started generating revenue?" },
  { id: "avgMonthlyRevenue", type: "quickreply", label: "Average monthly revenue", options: AVG_MONTHLY_REVENUE_OPTIONS,
    showIf: (a) => a.hasRevenue === "Yes",
    question: () => "What's your average monthly revenue?" },
  { id: "revenueLast12Months", type: "text", label: "Revenue (last 12 months)",
    question: () => "Thanks for being upfront about that. What was your revenue over the last 12 months?" },
  { id: "mainCustomers", type: "textarea", label: "Main customers",
    question: () => "Who are your main customers?" },
  { id: "customerAcquisitionChannels", type: "multiselect", label: "Customer acquisition channels", options: CUSTOMER_CHANNEL_OPTIONS,
    question: () => "How do customers currently find your business? Pick all that apply." },

  { id: "grantAmountRequested", type: "number", label: "Grant amount requested", eyebrow: "Funding Need & Business Needs", placeholder: "e.g. 500000",
    question: () => "Now the part that matters most — how much funding are you requesting (in ₦)?" },
  { id: "fundingUse", type: "multiselect", label: "Funding use", options: FUNDING_USE_OPTIONS,
    question: (a) => (a.grantAmountRequested > 0
      ? `₦${a.grantAmountRequested.toLocaleString()} — got it. What will you use it for? Pick all that apply.`
      : "What will you use the funding for? Pick all that apply.") },
  { id: "fundingGrowthExplanation", type: "textarea", label: "How funding helps growth",
    question: () => "Explain specifically how this funding will help your business grow." },
  { id: "biggestChallenge", type: "textarea", label: "Biggest challenge",
    question: () => "What's the biggest challenge currently affecting your business growth?" },

  { id: "whyStartBusiness", type: "textarea", label: "Why you started the business", eyebrow: "Entrepreneur Vision & Impact",
    question: (a) => `Why did you start ${a.businessName.trim() || "this business"}?` },
  { id: "problemSolved", type: "textarea", label: "Problem solved",
    question: () => "Thanks for sharing that. What problem does your business solve?" },
  { id: "desiredImpact", type: "textarea", label: "Desired impact",
    question: () => "What impact do you hope to create through your business?" },
  { id: "fiveYearVision", type: "textarea", label: "Five-year vision",
    question: (a) => `Where do you see ${a.businessName.trim() || "your business"} in the next 5 years?` },
  { id: "jobsToCreate", type: "quickreply", label: "Jobs to create", options: JOBS_TO_CREATE_OPTIONS,
    question: () => "How many jobs do you hope to create through your business?" },

  { id: "whyApplying", type: "textarea", label: "Why applying", eyebrow: "Grant Application Questions",
    question: () => "Great vision. Why are you applying for the Globe Tech SME Grant & Business Support Program?" },
  { id: "whySelected", type: "textarea", label: "Why you should be selected",
    question: () => "Why should your business be selected for this grant opportunity?" },
  { id: "whatMakesDifferent", type: "textarea", label: "What makes the business different",
    question: () => "What makes your business different from others in your industry?" },
  { id: "appliedBefore", type: "quickreply", label: "Applied for a grant before", twoCol: true, options: ["Yes", "No"],
    question: () => "Have you applied for a grant opportunity before?" },
  { id: "receivedFundingBefore", type: "quickreply", label: "Received funding before", twoCol: true, options: ["Yes", "No"],
    showIf: (a) => a.appliedBefore === "Yes",
    question: () => "Okay, tell me more — did you receive funding?" },
  { id: "priorFundingDetails", type: "textarea", label: "Prior funding details", required: false,
    showIf: (a) => a.appliedBefore === "Yes",
    question: () => "Feel free to share a few details about that." },

  { id: "willingAcademy", type: "quickreply", label: "Willing — Business Training", twoCol: true, eyebrow: "Business Training Commitment", options: ["Yes", "No"],
    question: () => "Are you willing to participate in the Globe Tech Business Training if required?" },
  { id: "willingMentorship", type: "quickreply", label: "Willing — mentorship", twoCol: true, options: ["Yes", "No"],
    question: () => "Are you willing to commit time to mentorship sessions, assignments, and business improvement activities?" },
  { id: "improvementAreas", type: "multiselect", label: "Improvement areas", options: IMPROVEMENT_AREA_OPTIONS,
    question: () => "What areas of business development would you like to improve? Pick all that apply." },

  { id: "howHeard", type: "quickreply", label: "How you heard about the program", eyebrow: "Referral Information", options: HOW_HEARD_OPTIONS,
    question: () => "Just a couple more questions. How did you hear about the Globe Tech SME Grant & Business Support Program?" },
  { id: "entrepreneurNetwork", type: "textarea", label: "Entrepreneur network", required: false,
    question: (a) => `Almost there, ${fname(a)} — do you belong to any entrepreneur/community/business network? Optional.` },

  { id: "declarationAgreed", type: "checkbox", label: "Declaration", eyebrow: "Final Declaration",
    question: () => "Last step before you send it in — please read this and confirm.",
    checkboxText:
      "I confirm that the information provided in this application is accurate and complete. I understand that submission of this application does not guarantee funding and that selected applicants may undergo further evaluation." },
];

function resolveRequired(q: Question, form: FormState): boolean {
  if (typeof q.required === "function") return q.required(form);
  return q.required ?? true;
}

function validateAnswer(q: Question, value: FieldValue, form: FormState): string | null {
  const required = resolveRequired(q, form);

  if (q.type === "multiselect") {
    if (required && (value as string[]).length === 0) return "Select at least one option.";
    return null;
  }
  if (q.type === "checkbox") {
    if (required && !value) return "Please check the box to confirm before continuing.";
    return null;
  }
  if (q.type === "number") {
    const n = Number(value);
    if (required && (!n || n <= 0)) return "Enter an amount greater than zero.";
    return null;
  }

  const str = typeof value === "string" ? value.trim() : "";
  if (required && !str) return "This one's needed before we move on.";
  if (!str) return null;

  if (q.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return "That email doesn't look quite right — mind checking it?";
  }
  if (q.type === "tel" && str.length !== 11) {
    return "Enter exactly 11 digits.";
  }
  if (q.id === "dateOfBirth" && ageFromDob(str) < MIN_AGE_YEARS) {
    return `You must be at least ${MIN_AGE_YEARS} years old to apply.`;
  }
  return null;
}

function summaryDisplay(q: Question, form: FormState): string {
  const v = form[q.id] as FieldValue;
  if (q.type === "multiselect") return (v as string[]).length ? (v as string[]).join(", ") : "—";
  if (q.type === "checkbox") return v ? "Agreed ✓" : "—";
  if (q.type === "number") return v ? `₦${Number(v).toLocaleString()}` : "—";
  const s = typeof v === "string" ? v.trim() : "";
  return s || "—";
}

/* ============================================================
   TRANSCRIPT TYPES
   ============================================================ */

interface TranscriptItem {
  who: "bot" | "user";
  text: string;
  eyebrow?: string;
}

type Stage = "welcome" | "questions" | "summary" | "done";

interface SavedDraft {
  form: FormState;
  transcript: TranscriptItem[];
  qIndex: number;
  stage: Stage;
  collapseIndex: number | null;
  savedAt: number;
}

interface Props {
  token: string;
  referralResolved: boolean;
}

export default function ApplicationForm({ token }: Props) {
  const [stage, setStage] = useState<Stage>("welcome");
  const [form, setForm] = useState<FormState>(initialState);
  const [visible, setVisible] = useState<Question[]>(() => QUESTIONS.filter((q) => !q.showIf));
  const [qIndex, setQIndex] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [typing, setTyping] = useState(false);
  const [lgaOtherMode, setLgaOtherMode] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [collapseIndex, setCollapseIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<SavedDraft | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const transcriptLenRef = useRef(0);
  const draftKey = `gt_grant_draft_${token}`;

  useEffect(() => {
    recordVisit(token).catch(() => {
      /* non-fatal — the token in the URL still works at submit time */
    });
    try {
      window.localStorage.setItem("gt_ref_token", token);
    } catch {
      /* localStorage may be unavailable (private browsing); cookie fallback still applies */
    }
  }, [token]);

  // Look for a saved draft on this device so the applicant can pick up where they left off.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed: SavedDraft = JSON.parse(raw);
        if (parsed && parsed.transcript?.length > 0 && parsed.stage !== "done") {
          setDraft(parsed);
        }
      }
    } catch {
      /* corrupt or unavailable storage — just start fresh */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave progress to this device on every change, so a reload never loses answers.
  useEffect(() => {
    if (stage === "welcome" && transcript.length === 0) return;
    try {
      if (stage === "done") {
        window.localStorage.removeItem(draftKey);
      } else {
        const payload: SavedDraft = { form, transcript, qIndex, stage, collapseIndex, savedAt: Date.now() };
        window.localStorage.setItem(draftKey, JSON.stringify(payload));
      }
    } catch {
      /* localStorage may be unavailable — the session still works, it just won't resume after reload */
    }
  }, [form, transcript, qIndex, stage, collapseIndex, draftKey]);

  useEffect(() => {
    transcriptLenRef.current = transcript.length;
  }, [transcript]);

  useEffect(() => {
    // The thread grows the whole page rather than scrolling internally, so scrollIntoView
    // on a bottom anchor (which finds the real scrolling ancestor) is what actually works —
    // fires as soon as a message is sent so the next question drops in already in view.
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [transcript, typing, qIndex, stage, expanded]);

  function askQuestion(idx: number, nextForm: FormState, nextVisible: Question[]) {
    const q = nextVisible[idx];
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      // Starting a new section collapses everything before it, keeping the thread tidy —
      // the applicant can still expand it via the "Load previous conversation" pill.
      if (q.eyebrow && transcriptLenRef.current > 0) {
        setCollapseIndex(transcriptLenRef.current);
        setExpanded(false);
      }
      setTranscript((t) => [...t, { who: "bot", text: q.question(nextForm) + (resolveRequired(q, nextForm) ? "" : " (optional)"), eyebrow: q.eyebrow }]);
    }, 480 + Math.random() * 320);
  }

  function start() {
    const firstVisible = QUESTIONS.filter((q) => !q.showIf);
    setVisible(firstVisible);
    setStage("questions");
    setQIndex(0);
    askQuestion(0, form, firstVisible);
  }

  function resume() {
    if (!draft) return;
    setForm(draft.form);
    setTranscript(draft.transcript);
    setQIndex(draft.qIndex);
    setCollapseIndex(draft.collapseIndex);
    setExpanded(false);
    setVisible(QUESTIONS.filter((q) => !q.showIf || q.showIf(draft.form)));
    setStage(draft.stage);
    setDraft(null);
  }

  function startFresh() {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setDraft(null);
    start();
  }

  function submitAnswer(value: FieldValue, display: string) {
    const q = visible[qIndex];
    const nextForm: FormState = { ...form, [q.id]: value } as FormState;
    setForm(nextForm);
    setTranscript((t) => [...t, { who: "user", text: display }]);
    setLgaOtherMode(false);

    const nextVisible = QUESTIONS.filter((qq) => !qq.showIf || qq.showIf(nextForm));
    const nextIndex = qIndex + 1;
    setVisible(nextVisible);
    setQIndex(nextIndex);

    if (nextIndex >= nextVisible.length) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setStage("summary");
        setTranscript((t) => [
          ...t,
          {
            who: "bot",
            text: `That's everything, ${fname(nextForm)}. Take a look below, then send it in when you're ready.`,
          },
        ]);
      }, 480 + Math.random() * 320);
    } else {
      askQuestion(nextIndex, nextForm, nextVisible);
    }
  }

  function goBack() {
    setExpanded(true);
    if (stage === "summary") {
      setTranscript((t) => t.slice(0, -1));
      setStage("questions");
      return;
    }
    if (stage === "questions") {
      if (qIndex === 0) {
        setStage("welcome");
        setTranscript([]);
        setQIndex(0);
        setCollapseIndex(null);
        return;
      }
      setTranscript((t) => t.slice(0, -2));
      setQIndex((i) => i - 1);
    }
  }

  async function finalSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitApplication({ token, ...form, honeypot });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? "Something went wrong. Please try again.");
      return;
    }
    setReferralCode(result.firstBankReferralCode ?? null);
    setStage("done");
  }

  async function copyCode() {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard API can fail silently; code is visible on screen either way */
    }
  }

  const progressPct =
    stage === "welcome"
      ? 0
      : stage === "questions"
        ? 5 + (qIndex / Math.max(visible.length, 1)) * 89
        : stage === "summary"
          ? 96
          : 100;

  const headerLabel = stage === "welcome" ? "Let's get you set up" : "SME Grant Application";

  return (
    <div className={styles.page}>
      <div className={styles.app}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={goBack} disabled={stage === "welcome" || stage === "done" || submitting} title="Back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className={styles.mark}>
            <Image src="/logo.png" alt="Globe-Tech" width={34} height={34} className={styles.markImg} priority />
          </div>
          <div className={styles.headText}>
            <div className={styles.org}>Globe-Tech · SME Grant Program</div>
            <div className={styles.roleLabel}>{headerLabel}</div>
          </div>
        </header>
        <div style={{ padding: "0 20px" }}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className={styles.thread} ref={threadRef}>
          {stage === "welcome" && (
            <div className={styles.welcomeHero}>
              {draft ? (
                <h1>Welcome back, {fname(draft.form)} — we can continue from where you stopped.</h1>
              ) : (
                <>
                  <h1>Hi — I&rsquo;m here to walk you through your SME Grant application.</h1>
                  <p>
                    No long form, no blank boxes staring back at you. Just a few questions, one at
                    a time, like we&rsquo;re actually talking. Take your time.
                  </p>
                </>
              )}
            </div>
          )}

          {stage !== "welcome" && collapseIndex !== null && !expanded && collapseIndex > 0 && (
            <button className={styles.loadPrev} onClick={() => setExpanded(true)}>
              ↑ Load previous conversation ({collapseIndex} message{collapseIndex === 1 ? "" : "s"})
            </button>
          )}

          {stage !== "welcome" &&
            (expanded || collapseIndex === null ? transcript : transcript.slice(collapseIndex)).map((item, i) => (
              <div key={i} className={`${styles.row} ${item.who === "bot" ? styles.rowBot : styles.rowUser}`}>
                {item.who === "bot" && <div className={styles.avatar}>GT</div>}
                <div className={`${styles.bubble} ${item.who === "bot" ? styles.botBubble : styles.userBubble}`}>
                  {item.who === "bot" && item.eyebrow && <span className={styles.eyebrow}>{item.eyebrow}</span>}
                  {item.text}
                </div>
                {item.who === "user" && (
                  <div className={`${styles.avatar} ${styles.userAvatar}`}>
                    {(fname(form) || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}

          {typing && (
            <div className={`${styles.row} ${styles.rowBot}`}>
              <div className={styles.avatar}>GT</div>
              <div className={`${styles.bubble} ${styles.botBubble} ${styles.typingBubble}`}>
                <div className={styles.dot} />
                <div className={styles.dot} />
                <div className={styles.dot} />
              </div>
            </div>
          )}

          {stage === "summary" && !typing && (
            <div className={`${styles.row} ${styles.rowBot}`}>
              <div className={styles.avatar}>GT</div>
              <div className={styles.summaryCard}>
                <span className={styles.roleTag}>SME Grant Application</span>
                {QUESTIONS.filter((q) => !q.showIf || q.showIf(form)).map((q) => (
                  <div key={q.id} className={styles.sumRow}>
                    <div className={styles.sumK}>{q.label}</div>
                    <div className={styles.sumV}>{summaryDisplay(q, form)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stage === "done" && (
            <div className={styles.doneScreen}>
              <div className={styles.doneBadge}>✓</div>
              <h2>You&rsquo;re in, {fname(form)}.</h2>
              <p>
                Check your email for the next step. Phase 2 is opening your FirstBank account —
                enter the code below in the <strong>Referral</strong> field on FirstBank&rsquo;s
                account-opening form. We&rsquo;ve also emailed this code to <strong>{form.email}</strong>.
              </p>
              <div className={styles.codeBlock}>
                <p className={styles.label}>Your referral code</p>
                <p className={styles.code}>{referralCode}</p>
              </div>
              <div className={styles.rowActions} style={{ maxWidth: 320, margin: "20px auto 0" }}>
                <button className={`${styles.btn} ${styles.btnGhost}`} style={{ flex: 1 }} onClick={copyCode}>
                  {copied ? "Copied ✓" : "Copy code"}
                </button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className={styles.composer}>
          {stage === "welcome" && (
            <div className={styles.composerInner}>
              <div className={styles.rowActions}>
                {draft ? (
                  <>
                    <button className={`${styles.btn} ${styles.btnGhost}`} onClick={startFresh}>
                      Start over
                    </button>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={resume}>
                      Continue →
                    </button>
                  </>
                ) : (
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={start}>
                    Let&rsquo;s go →
                  </button>
                )}
              </div>
            </div>
          )}

          {stage === "questions" && !typing && visible[qIndex] && (
            <Composer
              key={qIndex}
              q={visible[qIndex]}
              form={form}
              onAnswer={submitAnswer}
              lgaOtherMode={lgaOtherMode}
              setLgaOtherMode={setLgaOtherMode}
            />
          )}

          {stage === "summary" && !typing && (
            <div className={styles.composerInner}>
              {submitError && <p className={styles.errorText} style={{ marginBottom: 10 }}>{submitError}</p>}
              <div className={styles.rowActions}>
                <button
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() => {
                    setExpanded(true);
                    setCollapseIndex(null);
                    setQIndex(0);
                    setVisible(QUESTIONS.filter((q) => !q.showIf || q.showIf(form)));
                    setStage("questions");
                    askQuestion(0, form, QUESTIONS.filter((q) => !q.showIf || q.showIf(form)));
                  }}
                  disabled={submitting}
                >
                  ← Edit answers
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={finalSubmit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit application →"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Honeypot — visually hidden, never in the tab order, present throughout */}
        <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   COMPOSER — renders the input for the current question
   ============================================================ */

function Composer({
  q,
  form,
  onAnswer,
  lgaOtherMode,
  setLgaOtherMode,
}: {
  q: Question;
  form: FormState;
  onAnswer: (value: FieldValue, display: string) => void;
  lgaOtherMode: boolean;
  setLgaOtherMode: (v: boolean) => void;
}) {
  const required = resolveRequired(q, form);
  const initial: FieldValue =
    q.type === "multiselect" ? [] : q.type === "number" ? 0 : q.type === "checkbox" ? false : "";
  const [value, setValue] = useState<FieldValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function attempt(v: FieldValue, display: string) {
    const err = validateAnswer(q, v, form);
    if (err) {
      setError(err);
      return;
    }
    onAnswer(v, display);
  }

  function handleContinue() {
    if (q.type === "lga") {
      const finalVal = lgaOtherMode ? (value as string) : (value as string);
      attempt(finalVal, finalVal || "—");
      return;
    }
    attempt(value, typeof value === "string" ? value : String(value));
  }

  function skip() {
    onAnswer(q.type === "multiselect" ? [] : "", "—");
  }

  // Quick-reply: chips that auto-advance on click
  if (q.type === "quickreply") {
    const twoColClass = q.twoCol ? styles.chipHalf : "";
    return (
      <div className={styles.composerInner}>
        <div className={styles.quickReplies}>
          {(q.options ?? []).map((o) => (
            <button key={o} className={`${styles.chip} ${twoColClass}`} onClick={() => attempt(o, o)}>
              {o}
            </button>
          ))}
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }

  // Multiselect: toggle chips + explicit Continue
  if (q.type === "multiselect") {
    const arr = value as string[];
    function toggle(o: string) {
      setValue((prev) => {
        const p = prev as string[];
        return p.includes(o) ? p.filter((x) => x !== o) : [...p, o];
      });
    }
    return (
      <div className={styles.composerInner}>
        <div className={styles.quickReplies}>
          {(q.options ?? []).map((o) => (
            <button
              key={o}
              className={`${styles.chip} ${arr.includes(o) ? styles.chipActive : ""}`}
              onClick={() => toggle(o)}
            >
              {arr.includes(o) ? "✓ " : ""}
              {o}
            </button>
          ))}
        </div>
        <div className={styles.rowActions}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => attempt(arr, arr.join(", ") || "—")}>
            Continue →
          </button>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }

  // Checkbox declaration
  if (q.type === "checkbox") {
    return (
      <div className={styles.composerInner}>
        <label className={styles.checkline}>
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => setValue(e.target.checked)}
          />
          <span>{q.checkboxText}</span>
        </label>
        <div className={styles.rowActions}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => attempt(value, value ? "✓ Agreed" : "")}>
            I agree, continue →
          </button>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }

  // LGA — dependent dropdown with manual fallback
  if (q.type === "lga") {
    const lgaOptions = NIGERIA_LGAS_BY_STATE[form.stateOfResidence] ?? [];
    return (
      <div className={styles.composerInner}>
        <select
          ref={inputRef}
          className={styles.fieldSelect}
          value={lgaOtherMode ? LGA_OTHER : (value as string)}
          onChange={(e) => {
            if (e.target.value === LGA_OTHER) {
              setLgaOtherMode(true);
              setValue("");
            } else {
              setLgaOtherMode(false);
              setValue(e.target.value);
            }
          }}
        >
          <option value="" disabled>
            Select your LGA
          </option>
          {lgaOptions.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
          <option value={LGA_OTHER}>{LGA_OTHER}</option>
        </select>
        {lgaOtherMode && (
          <input
            className={styles.field}
            style={{ marginTop: 10 }}
            placeholder="Type your LGA"
            value={value as string}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <div className={styles.rowActions}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleContinue}>
            Continue →
          </button>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }

  // Select dropdown
  if (q.type === "select") {
    return (
      <div className={styles.composerInner}>
        <select
          ref={inputRef}
          className={styles.fieldSelect}
          value={value as string}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="" disabled>
            Choose one…
          </option>
          {(q.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <div className={styles.rowActions}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleContinue}>
            Continue →
          </button>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }

  // Text-like: text / email / tel / date / number / textarea
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && q.type !== "textarea") {
      e.preventDefault();
      handleContinue();
    }
  }

  return (
    <div className={styles.composerInner}>
      {!required && <div className={styles.hint}><b>Optional</b> — you can leave this blank and continue.</div>}

      {q.type === "textarea" ? (
        <textarea
          ref={inputRef}
          className={styles.field}
          placeholder={q.placeholder}
          value={value as string}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <input
          ref={inputRef}
          className={styles.field}
          type={q.type === "number" ? "number" : q.type === "date" ? "date" : q.type === "tel" ? "tel" : q.type}
          inputMode={q.type === "tel" ? "numeric" : undefined}
          placeholder={q.placeholder}
          max={q.id === "dateOfBirth" ? maxDobForMinAge() : undefined}
          min={q.type === "number" ? 0 : undefined}
          value={q.type === "number" && value === 0 ? "" : (value as string | number)}
          onChange={(e) => {
            if (q.type === "tel") setValue(e.target.value.replace(/\D/g, "").slice(0, 11));
            else if (q.type === "number") setValue(Number(e.target.value) || 0);
            else setValue(e.target.value);
          }}
          onKeyDown={handleKeyDown}
        />
      )}

      <div className={styles.rowActions}>
        {!required && (
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={skip}>
            Skip
          </button>
        )}
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleContinue}>
          Continue →
        </button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
