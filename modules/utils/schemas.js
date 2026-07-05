import { z } from "zod";

export const TerritorioSchema = z.object({
    id: z.string().optional(),
    numero: z.string(),
    localidad: z.string().optional(),
    manzanas: z.string().optional(),
    estado: z.string().default("Disponible"),
    asignado_a: z.string().nullable().optional(),
    auxiliar: z.string().nullable().optional(),
    fecha_asignacion: z.string().nullable().optional(),
    tipo: z.string().optional(),
    is_incomplete: z.boolean().optional(),
    imagen: z.string().optional(),
    coordenadas: z.array(z.number()).optional(),
});

export const PublicadorSchema = z.object({
    id: z.string().optional(),
    nombre: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    role: z.string().default("Usuario"),
    privilegios: z.array(z.string()).optional(),
});

export const ProgramaSemanalSchema = z.object({
    id: z.string(),
    dias: z.array(z.any()),
});

export const HistoryRecordSchema = z.object({
    id: z.string().optional(),
    numero: z.string(),
    conductor: z.string(),
    fecha_asignacion: z.string(),
    fecha_entrega: z.string().optional(),
    estado: z.string(),
    observaciones: z.string().optional(),
    timestamp: z.any().optional(),
});
