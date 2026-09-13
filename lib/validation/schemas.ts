/**
 * Input validation.
 *
 * Every API entry point validates here before anything else runs. Limits are
 * enforced server-side regardless of what the client sends, and error messages
 * never echo the submitted content back.
 */

import { z } from "zod";

/** Long enough for a forwarded email chain, short enough to bound AI cost. */
export const MAX_TEXT_LENGTH = 8000;
export const MIN_TEXT_LENGTH = 3;
export const MAX_URL_LENGTH = 2048;

/**
 * 3MB of raw image. Base64 adds ~33%, so the JSON body stays under Vercel's
 * 4.5MB request limit; anything larger would fail at the platform with no
 * useful message.
 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Hard caps on raw request bodies, checked before JSON parsing. */
export const MAX_TEXT_BODY_BYTES = 64 * 1024;
export const MAX_IMAGE_BODY_BYTES = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 16 * 1024;

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** Checks the decoded file signature so a mislabelled or corrupt upload is rejected here, not by the AI provider. */
function matchesImageSignature(base64: string, mimeType: string): boolean {
  const head = Buffer.from(base64.slice(0, 24), "base64");
  if (mimeType === "image/png") return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/jpeg") return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (mimeType === "image/webp") return head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP";
  return false;
}

export const analyzeTextSchema = z.object({
  text: z
    .string({ required_error: "Please paste a message to analyse." })
    .trim()
    .min(MIN_TEXT_LENGTH, "That message is too short to analyse.")
    .max(MAX_TEXT_LENGTH, `Messages are limited to ${MAX_TEXT_LENGTH.toLocaleString()} characters. Please paste the relevant part.`),
  save: z.boolean().optional().default(false),
});

export const analyzeUrlSchema = z.object({
  url: z
    .string({ required_error: "Please paste a URL to analyse." })
    .trim()
    .min(4, "Please paste a valid URL.")
    .max(MAX_URL_LENGTH, "That URL is too long to analyse.")
    .transform((value) => (/^https?:\/\//i.test(value) ? value : `http://${value}`))
    .refine((value) => {
      try {
        const u = new URL(value);
        // Block non-web schemes and hostless URLs outright.
        return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
      } catch {
        return false;
      }
    }, "That does not look like a valid web address."),
  save: z.boolean().optional().default(false),
});

export const analyzeImageSchema = z
  .object({
    mimeType: z.enum(ACCEPTED_IMAGE_TYPES, {
      errorMap: () => ({ message: "Screenshots must be PNG, JPEG or WebP." }),
    }),
    base64Data: z
      .string()
      .min(1, "The uploaded image appears to be empty.")
      .refine((value) => {
        // base64 expands by ~4/3; check decoded size without allocating a buffer.
        const decodedBytes = Math.floor((value.length * 3) / 4);
        return decodedBytes <= MAX_IMAGE_BYTES;
      }, "Screenshots must be under 3MB.")
      .refine((value) => BASE64_PATTERN.test(value), "The uploaded image could not be read."),
  })
  .refine((data) => matchesImageSignature(data.base64Data, data.mimeType), {
    message: "That file is not a valid PNG, JPEG or WebP image.",
    path: ["base64Data"],
  });

export type AnalyzeTextInput = z.infer<typeof analyzeTextSchema>;
export type AnalyzeUrlInput = z.infer<typeof analyzeUrlSchema>;
export type AnalyzeImageInput = z.infer<typeof analyzeImageSchema>;
