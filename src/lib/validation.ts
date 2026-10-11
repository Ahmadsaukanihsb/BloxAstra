import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Username atau email minimal 3 karakter.")
    .max(100),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(200),
});

export const registerBuyerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Format email tidak valid.").max(200),
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, dan garis bawah."),
  whatsapp: z.string().trim().min(8, "Nomor WhatsApp tidak valid.").max(20),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter.")
    .max(200)
    .regex(/\d/, "Kata sandi harus mengandung angka."),
});

export const registerSellerSchema = registerBuyerSchema.extend({
  fullName: z.string().trim().min(3, "Nama lengkap minimal 3 karakter.").max(100),
  storeName: z.string().trim().min(3, "Nama toko minimal 3 karakter.").max(100),
  /** KTP + selfie data URLs (magic bytes verified server-side). */
  idCardImage: z.string().min(100, "Foto KTP wajib diunggah.").max(1_800_000),
  selfieImage: z.string().min(100, "Selfie + KTP wajib diunggah.").max(1_800_000),
  agreed: z.boolean().refine((value) => value === true, {
    message: "Kamu harus menyetujui aturan penjual.",
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterBuyerInput = z.infer<typeof registerBuyerSchema>;
export type RegisterSellerInput = z.infer<typeof registerSellerSchema>;
