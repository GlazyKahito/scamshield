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
/** ~4MB of raw image, allowing for base64's ~33% overhead under the 6MB body cap. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

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

export const analyzeImageSchema = z.object({
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
    }, "Screenshots must be under 4MB."),
});

export type AnalyzeTextInput = z.infer<typeof analyzeTextSchema>;
export type AnalyzeUrlInput = z.infer<typeof analyzeUrlSchema>;
export type AnalyzeImageInput = z.infer<typeof analyzeImageSchema>;
