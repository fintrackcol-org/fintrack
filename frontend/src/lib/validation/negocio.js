import { z } from 'zod';
import { t } from '@/lib/i18n';

/**
 * Formulario para crear o editar un negocio (FT-0016). Sigue `POST /businesses`: nombre
 * obligatorio; descripción y NIT opcionales.
 */
export const businessSchema = z.object({
  name: z.string().trim().min(1, t('Ponle un nombre al negocio')).max(60, t('Máximo 60 caracteres')),
  description: z.string().trim().max(200, t('Máximo 200 caracteres')),
  nit: z
    .string()
    .trim()
    .max(20, t('Máximo 20 caracteres'))
    .regex(/^([0-9][0-9.\- ]*)?$/, t('Solo números, puntos y guiones')),
});
