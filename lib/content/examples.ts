/**
 * Fictional demo specimens, shared by the landing demo and the analyzer.
 *
 * `.example` is a reserved TLD and cannot resolve, so nothing here points at a
 * real site. The ordinary message is included on purpose: a detector that only
 * ever shows red is not demonstrating anything.
 */

export interface ExampleSpecimen {
  id: string;
  label: string;
  text: string;
}

export const MESSAGE_EXAMPLES: ExampleSpecimen[] = [
  {
    id: "banking",
    label: "Bank KYC warning",
    text: "URGENT: Your SBI account will be blocked today.\nComplete KYC immediately at:\nhttps://sbi-secure-login.example",
  },
  {
    id: "internship",
    label: "Internship offer",
    text: "Congratulations! You have been selected for a ₹60,000/month work-from-home internship with no experience required. Pay ₹1,999 registration fee to confirm your position before 6 PM today.",
  },
  {
    id: "upi",
    label: "Refund request",
    text: "Sir your refund of ₹5,000 is approved. Please scan this QR code and enter your UPI PIN to receive the amount in your account.",
  },
  {
    id: "ordinary",
    label: "An ordinary message",
    text: "Hi Ma, reaching home by 8 tonight. Do you need anything from the market? Also Priya called, she said she'll come over on Sunday.",
  },
];

export const URL_EXAMPLES: ExampleSpecimen[] = [
  { id: "lookalike", label: "Lookalike bank login", text: "http://sbi-secure-login.example/kyc/verify" },
  { id: "buried", label: "Buried subdomain", text: "https://verify.account.secure-update.example/login" },
];
