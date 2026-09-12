/**
 * Scam library.
 *
 * Written for a beginner: what it looks like, what gives it away, what the
 * attacker actually wants, and what to do. All example text is fictional and
 * uses the reserved `.example` TLD.
 *
 * "What the attacker wants" matters most educationally — once you recognise the
 * goal, the surface story stops mattering.
 */

export interface ScamEntry {
  id: string;
  name: string;
  category: string;
  hook: string;
  looksLike: string;
  example: string;
  redFlags: string[];
  wants: string;
  whatToDo: string;
}

export const CATEGORIES = [
  "Banking",
  "Payments",
  "Jobs",
  "Delivery",
  "Investment",
  "Phishing",
  "OTP",
  "Impersonation",
] as const;

export const SCAM_LIBRARY: ScamEntry[] = [
  {
    id: "bank-kyc",
    name: "KYC and account-blocked warnings",
    category: "Banking",
    hook: "Your bank appears to be about to freeze your account today.",
    looksLike:
      "An SMS or email in your bank's name saying KYC is incomplete, your account will be blocked, or a transaction needs verifying — with a link to fix it immediately.",
    example: "URGENT: Your account will be blocked today. Complete KYC at https://bank-verify.example",
    redFlags: [
      "A deadline of hours rather than weeks",
      "A link sent to you instead of one you found yourself",
      "A domain carrying the bank's name but not owned by the bank",
      "Asks for full card details, password, or OTP on the page",
    ],
    wants: "Your login credentials and the OTP that follows, so they can sign in as you.",
    whatToDo:
      "Open the bank's own app or type the address yourself. If KYC is genuinely pending it will show there. Call the number on your card, never one from the message.",
  },
  {
    id: "upi-collect",
    name: "UPI collect requests and QR refunds",
    category: "Payments",
    hook: "Someone offers to send you money, then needs your PIN to do it.",
    looksLike:
      "A refund, prize or buyer payment where you are asked to approve a collect request, scan a QR code, or enter your UPI PIN 'to receive' the amount.",
    example: "Your refund of ₹5,000 is approved. Scan this QR and enter your UPI PIN to receive it.",
    redFlags: [
      "A PIN or QR scan required to receive money",
      "A refund you never requested",
      "Someone staying on the call while you do it",
      "Urgency about a payment expiring",
    ],
    wants: "Authorisation to debit your account. A PIN approves money going out, never coming in.",
    whatToDo:
      "Refuse. Receiving money in UPI needs nothing from you. Check your app's own history for real pending requests, then report and block the sender.",
  },
  {
    id: "job-fee",
    name: "Jobs that charge you to start",
    category: "Jobs",
    hook: "A well-paid role you never applied for, with a small fee to confirm it.",
    looksLike:
      "A WhatsApp or Telegram message announcing you have been selected for a work-from-home role, followed by a registration, training or security fee.",
    example: "You have been selected! Pay ₹1,999 registration fee to confirm your position today.",
    redFlags: [
      "Selected for something you never applied to",
      "Pay far above what the described work would earn",
      "Any fee required before you begin",
      "Contact from a personal number rather than a company domain",
    ],
    wants: "The fee itself, repeated across many victims — and often your ID documents too.",
    whatToDo:
      "Find the company yourself and apply through its official careers page. Legitimate employers deduct costs from salary; they never invoice candidates.",
  },
  {
    id: "delivery-fee",
    name: "Parcels held for a small fee",
    category: "Delivery",
    hook: "A tiny charge stands between you and your package.",
    looksLike:
      "An SMS claiming a parcel is held at customs or failed delivery, asking for a small fee or an address confirmation through a link.",
    example: "Your parcel is on hold. Pay ₹47 customs duty within 24 hours: https://courier-fee.example",
    redFlags: [
      "An amount small enough that you would not question it",
      "A parcel you may not even be expecting",
      "A short deadline before 'return to sender'",
      "A domain that is not the courier's real one",
    ],
    wants: "Your full card details. The fee is bait; the card is the prize.",
    whatToDo:
      "Track the parcel in the courier's official app. Real customs charges are not collected by SMS link.",
  },
  {
    id: "investment-guaranteed",
    name: "Guaranteed-return investment groups",
    category: "Investment",
    hook: "Consistent profits, no risk, and a seat that expires tonight.",
    looksLike:
      "A Telegram or WhatsApp group showing members' profit screenshots, offering a managed trading or crypto scheme with fixed returns and a minimum deposit.",
    example: "30% monthly returns, zero risk. Limited seats. Do not share this group with anyone.",
    redFlags: [
      "Guaranteed or fixed returns — regulated products cannot promise these",
      "Instructions to keep it secret",
      "Small withdrawals allowed early to build trust",
      "Fees demanded before a large withdrawal is released",
    ],
    wants: "Escalating deposits. Early payouts are marketing, funded by your own money.",
    whatToDo:
      "Check the firm against your financial regulator's public register. Treat any promise of guaranteed returns as disqualifying.",
  },
  {
    id: "phishing-login",
    name: "Fake login pages",
    category: "Phishing",
    hook: "A page identical to one you use every day.",
    looksLike:
      "A link leading to a pixel-perfect copy of a login screen — bank, email, social, or a workplace portal. Copying a login page requires no special access.",
    example: "Sign in to review the suspicious activity on your account: https://account-verify.example",
    redFlags: [
      "You arrived by clicking a link rather than typing the address",
      "The domain is close to but not exactly the real one",
      "The page asks for more than usual — card details on an email login, for instance",
      "It asks for an OTP right after your password",
    ],
    wants: "Your username, password, and the second factor immediately afterwards.",
    whatToDo:
      "Leave the page and reach the service the way you normally do. If you already entered details, change the password and sign out all sessions now.",
  },
  {
    id: "otp-sharing",
    name: "OTP requests",
    category: "OTP",
    hook: "Someone helpful needs the code you just received.",
    looksLike:
      "A caller claiming to be from your bank, a delivery agent, or a marketplace buyer, asking you to read out a code that has just arrived.",
    example: "To verify your identity, please share the 6-digit code we just sent you.",
    redFlags: [
      "Anyone at all asking for an OTP",
      "A code arriving that you did not trigger",
      "Pressure to read it out quickly",
      "The caller already knows some of your details, which feels reassuring",
    ],
    wants: "The second factor, in real time, while they are already logging in as you.",
    whatToDo:
      "Never share an OTP with anyone. A code you did not request means someone is already trying your password — change it immediately.",
  },
  {
    id: "impersonation-family",
    name: "Family and authority impersonation",
    category: "Impersonation",
    hook: "A message from someone you cannot refuse.",
    looksLike:
      "A new number claiming to be a parent, child or manager with an urgent request for money — or a caller claiming to be police, customs or the tax department alleging a case against you.",
    example: "Hi, this is my new number. I'm stuck and need ₹15,000 urgently — don't tell anyone yet.",
    redFlags: [
      "A new or unknown number claiming a known identity",
      "Urgency plus a request to keep it quiet",
      "Refusal or inability to take a voice or video call",
      "Threats of arrest or legal action over the phone",
    ],
    wants: "A fast transfer made before you verify, usually to an account emptied within minutes.",
    whatToDo:
      "Call the person on the number you already have. Real agencies do not demand payment by phone or threaten arrest over a call.",
  },
];
