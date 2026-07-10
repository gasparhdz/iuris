import { z } from "zod";

const passwordSchema = z.string().min(12, "La contrasena debe tener al menos 12 caracteres");

export const loginSchema = z.object({
  email: z.string().email("Debe ser un email valido"),
  // Login acepta cualquier longitud no vacía: la política fuerte aplica al setear/cambiar.
  password: z.string().min(1, "La contrasena es requerida"),
}).strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const registerTenantSchema = z.object({
  estudioNombre: z.string().min(2, "El nombre del estudio es requerido"),
  usuarioNombre: z.string().min(2, "El nombre es requerido"),
  usuarioApellido: z.string().min(2, "El apellido es requerido"),
  email: z.string().email("Debe ser un email valido"),
  password: passwordSchema,
}).strict();

export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;

export const updateProfileSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").optional(),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres").optional(),
  telefono: z.string().optional().nullable(),
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contrasena actual es requerida"),
  newPassword: passwordSchema,
}).strict();

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Debe ser un email valido"),
}).strict();

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email: z.string().email("Debe ser un email valido"),
  token: z.string().min(1, "El token es requerido"),
  newPassword: passwordSchema,
}).strict();

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const authResponseSchema = z.object({
  data: z.object({
    accessToken: z.string(),
    user: z.object({
      id: z.number(),
      estudioId: z.number(),
      estudio: z.object({
        id: z.number(),
        nombre: z.string(),
      }).nullable().optional(),
      nombre: z.string(),
      apellido: z.string(),
      email: z.string(),
      rol: z.string(),
      telefono: z.string().nullable().optional(),
    }),
  }),
});

export const userProfileResponseSchema = z.object({
  id: z.number(),
  estudioId: z.number(),
  estudio: z.object({
    id: z.number(),
    nombre: z.string(),
  }).nullable().optional(),
  nombre: z.string(),
  apellido: z.string(),
  email: z.string(),
  telefono: z.string().nullable().optional(),
  roles: z.array(z.string()),
  permisos: z.array(
    z.object({
      modulo: z.string(),
      ver: z.boolean(),
      crear: z.boolean(),
      editar: z.boolean(),
      eliminar: z.boolean(),
    })
  ),
});

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
