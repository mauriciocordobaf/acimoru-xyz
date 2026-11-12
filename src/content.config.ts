import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const texto = z.string().nullish();

const foto = z.object({
  imagen: z.string(),
  enlace: texto,
  descripcion: texto,
});

/* Elementos que puede llevar una sección. El editor (/admin) usa esta misma lista. */
const bloque = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('texto'), texto }),
  z.object({ tipo: z.literal('spoiler'), texto }),
  z.object({ tipo: z.literal('galeria'), fotos: z.array(foto).nullish() }),
  z.object({ tipo: z.literal('destacado'), imagen: z.string(), enlace: texto, descripcion: texto, texto }),
  z.object({ tipo: z.literal('boton'), texto, enlace: texto }),
  z.object({ tipo: z.literal('video'), enlace: texto }),
  z.object({ tipo: z.literal('redes') }),
  z.object({ tipo: z.literal('separador') }),
]);

const secciones = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/secciones' }),
  schema: z.object({
    titulo: z.string(),
    orden: z.number().default(99),
    bloques: z.array(bloque).nullish(),
  }),
});

const sitio = defineCollection({
  loader: glob({ pattern: 'sitio.yaml', base: './src/content' }),
  schema: z.object({
    titulo: z.string(),
    descripcion: z.string(),
    logo: z.string(),
    pie: texto,
    /** Estado o frase que sale debajo del logo */
    frase: texto,
    /** Música de fondo: archivo dentro de public/audio/ y volumen de 0 a 1 */
    audio: z.object({ archivo: texto, volumen: z.number().nullish() }).nullish(),
    redes: z
      .array(z.object({ nombre: z.string(), icono: z.string(), enlace: z.string() }))
      .nullish(),
    tema: z
      .object({
        principal: texto,
        secundario: texto,
        acento: texto,
        burbujas: z.boolean().nullish(),
        formas: z.boolean().nullish(),
        destellos: z.boolean().nullish(),
      })
      .nullish(),
  }),
});

export const collections = { secciones, sitio };
