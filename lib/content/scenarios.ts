/**
 * Simulator scenarios.
 *
 * ALL CONTENT IS FICTIONAL. Domains use the reserved `.example` TLD and cannot
 * resolve. No real phone numbers, links or credentials appear anywhere here.
 *
 * Each scenario teaches one mechanic. The wrong answers are deliberately
 * plausible — an option nobody would pick teaches nothing.
 */

export interface Scenario {
  id: string;
  category: string;
  sender: string;
  channel: string;
  message: string;
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  technique: string;
  outcome: string;
  redFlags: string;
  correctAction: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "banking-kyc",
    category: "Banking / KYC",
    sender: "VM-SBIBNK",
    channel: "SMS",
    message:
      "URGENT: Your SBI account will be blocked today due to incomplete KYC.\nComplete verification immediately at:\nhttps://sbi-secure-login.example",
    question: "What would you do?",
    options: [
      { id: "click", text: "Open the link and complete the KYC form" },
      { id: "reply", text: "Reply asking whether this is genuine" },
      { id: "verify", text: "Ignore the link and open the bank's own app instead" },
      { id: "call", text: "Call the number that sent the message" },
    ],
    correctOptionId: "verify",
    technique:
      "Urgency plus authority. A same-day deadline stops you checking with anyone, and the bank's name borrows trust you already have. The domain carries 'sbi' but is not a domain the bank owns — putting a brand name in front of a domain you control costs nothing.",
    outcome:
      "The page would look identical to the real login screen. Whatever you typed — customer ID, password, then the OTP that arrives — goes straight to the attacker, who is logging in as you in real time while you wait.",
    redFlags:
      "A deadline measured in hours. A link sent to you rather than one you found. A domain that wears the brand name but is not the bank's own. Banks do not suspend accounts over SMS links.",
    correctAction:
      "Open your banking app directly, or call the number printed on your card. If KYC is genuinely pending, it will be visible there.",
  },
  {
    id: "fake-internship",
    category: "Fake internship",
    sender: "+91 XXXXX XXXXX",
    channel: "WhatsApp",
    message:
      "Congratulations! You have been selected for a ₹60,000/month work-from-home internship with no experience required.\n\nPay ₹1,999 registration fee to confirm your position before 6 PM today.",
    question: "What would you do?",
    options: [
      { id: "pay", text: "Pay the ₹1,999 — it's small compared to the salary" },
      { id: "negotiate", text: "Ask if the fee can be deducted from the first salary" },
      { id: "refuse", text: "Refuse to pay and verify the company independently" },
      { id: "docs", text: "Send your documents first, then decide about the fee" },
    ],
    correctOptionId: "refuse",
    technique:
      "Selection flattery plus a small upfront fee. Being 'selected' for something you never applied to creates a sense of luck worth protecting, and ₹1,999 is priced deliberately low — small enough to risk, large enough to be worth collecting at scale.",
    outcome:
      "Paying usually leads to more fees: training, verification, equipment deposit. The job never begins. Documents sent 'for onboarding' can be reused to open accounts in your name.",
    redFlags:
      "You were 'selected' without applying. Pay exceeds the work described. A fee is required before you start. A deadline today. Contact is over a personal number rather than a company address.",
    correctAction:
      "Look up the company yourself and apply through its official careers page. A genuine employer never charges you to be hired.",
  },
  {
    id: "upi-refund",
    category: "UPI / payment",
    sender: "+91 XXXXX XXXXX",
    channel: "WhatsApp",
    message:
      "Sir your refund of ₹5,000 has been approved.\n\nPlease scan this QR code and enter your UPI PIN to receive the amount in your account.",
    question: "What would you do?",
    options: [
      { id: "scan", text: "Scan the QR code and enter the PIN to collect the refund" },
      { id: "small", text: "Ask them to send ₹1 first as a test" },
      { id: "decline", text: "Refuse — receiving money never requires a PIN" },
      { id: "share", text: "Share your UPI ID so they can send it directly" },
    ],
    correctOptionId: "decline",
    technique:
      "A reversed transaction disguised as a refund. Scanning a QR code or entering a UPI PIN authorises money leaving your account. There is no mechanism in UPI where either is needed to receive funds.",
    outcome:
      "The PIN authorises a debit, not a credit. The amount charged is usually far larger than the promised refund, and UPI transfers settle instantly — the money is gone before you see the notification.",
    redFlags:
      "A PIN or QR scan required to 'receive'. A refund you did not request. Pressure to act while they stay on the line.",
    correctAction:
      "Decline. Check your payment app's own history for any real pending refund, and report the sender in-app.",
  },
  {
    id: "delivery-customs",
    category: "Delivery",
    sender: "IM-DLVRY",
    channel: "SMS",
    message:
      "Your parcel is on hold at the customs office.\n\nPay the pending customs duty of ₹47 within 24 hours to release your shipment:\nhttps://indiapost-delivery-fee.example/pay",
    question: "What would you do?",
    options: [
      { id: "pay", text: "Pay ₹47 — it's a trivial amount to release the parcel" },
      { id: "track", text: "Check the courier's official app for any real pending delivery" },
      { id: "click", text: "Open the link to see what parcel it refers to" },
      { id: "wait", text: "Wait and see if the courier calls" },
    ],
    correctOptionId: "track",
    technique:
      "A trivial amount lowers scrutiny. Nobody investigates ₹47 — the fee is not the goal. The payment page exists to capture your full card details, which are worth far more than the fee itself.",
    outcome:
      "The card details entered to pay ₹47 are used for much larger transactions later, often after a delay so you do not connect the two events.",
    redFlags:
      "A fee small enough not to question. A parcel you may not be expecting. A 24-hour deadline. A domain that is not the courier's real one.",
    correctAction:
      "Track the parcel in the courier's official app, typed in yourself. Genuine customs charges are not collected through SMS links.",
  },
  {
    id: "investment-returns",
    category: "Investment",
    sender: "Trading group",
    channel: "Telegram",
    message:
      "Our members made 30% returns this month with zero risk.\n\nLimited seats in the next batch. Deposit minimum ₹10,000 today and start earning daily profits. Do not share this group with anyone.",
    question: "What would you do?",
    options: [
      { id: "small", text: "Start with a small amount to test whether it works" },
      { id: "deposit", text: "Deposit ₹10,000 before the seats fill" },
      { id: "leave", text: "Leave — guaranteed returns and secrecy are disqualifying" },
      { id: "research", text: "Ask the group for proof of past returns" },
    ],
    correctOptionId: "leave",
    technique:
      "Guaranteed returns plus scarcity plus secrecy. The secrecy instruction is the clearest tell: it exists to keep you away from anyone who would talk you out of it. Small test deposits are often paid back precisely to earn a larger one.",
    outcome:
      "Early withdrawals typically succeed, which builds confidence for a much larger deposit. That one cannot be withdrawn — it is held behind 'tax', 'unlocking fees' or a frozen account.",
    redFlags:
      "Guaranteed or fixed returns. 'Zero risk'. Artificial scarcity. An instruction not to tell anyone. No regulated entity named.",
    correctAction:
      "Leave the group. Check any firm against your financial regulator's public register. Regulated products cannot promise a fixed return.",
  },
];
