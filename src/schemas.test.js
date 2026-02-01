import { describe, it, expect } from 'vitest';
import { TerritorioSchema } from '../modules/utils/schemas.js';

describe('TerritorioSchema Validation', () => {
    it('should validate a correct territory object', () => {
        const validT = {
            numero: "1",
            localidad: "Test City",
            estado: "Disponible"
        };
        const result = TerritorioSchema.safeParse(validT);
        expect(result.success).toBe(true);
    });

    it('should fail if numero is missing', () => {
        const invalidT = {
            localidad: "Test City"
        };
        const result = TerritorioSchema.safeParse(invalidT);
        expect(result.success).toBe(false);
    });

    it('should set default state to Disponible', () => {
        const t = { numero: "5" };
        const result = TerritorioSchema.parse(t);
        expect(result.estado).toBe('Disponible');
    });
});
