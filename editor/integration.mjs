/* ------------------------------------------------------------------
   Editor visual PRIVADO.

   Solo existe mientras corres `npm run dev` en tu computador:
     - la página /admin se registra únicamente en modo desarrollo
     - la API que guarda los archivos solo acepta peticiones desde
       localhost y desde la propia página del editor

   `npm run build` (lo que publica Netlify) no incluye nada de esto.
------------------------------------------------------------------ */
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const API = '/__editor/api';
const LOCALES = ['localhost', '127.0.0.1', '[::1]'];
const EXT_IMAGEN = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};
const MAX_IMAGEN = 15 * 1024 * 1024;
const EXT_AUDIO = ['.mp3', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.wav', '.flac', '.webm'];
const MAX_AUDIO = 40 * 1024 * 1024;
/** Nombre de archivo seguro: sin tildes, espacios ni rutas. */
const nombreLimpio = (original, ext) =>
  original
    .slice(0, -ext.length)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
const ID_VALIDO = /^[a-z0-9][a-z0-9-]{0,40}$/;

/** Campos permitidos por tipo de bloque (lo demás se descarta al guardar). */
const CAMPOS = {
  texto: ['texto'],
  spoiler: ['texto'],
  galeria: ['fotos'],
  destacado: ['imagen', 'enlace', 'descripcion', 'texto'],
  boton: ['texto', 'enlace'],
  video: ['enlace'],
  redes: [],
  separador: [],
};

const txt = (v) => (typeof v === 'string' ? v : '');
const limpiarFoto = (f) => ({
  imagen: path.basename(txt(f?.imagen)),
  ...(txt(f?.enlace).trim() ? { enlace: txt(f.enlace).trim() } : {}),
  ...(txt(f?.descripcion).trim() ? { descripcion: txt(f.descripcion) } : {}),
});
function limpiarBloque(b) {
  const campos = CAMPOS[b?.tipo];
  if (!campos) return null;
  const out = { tipo: b.tipo };
  for (const k of campos) {
    if (k === 'fotos') out.fotos = (Array.isArray(b.fotos) ? b.fotos : []).map(limpiarFoto).filter((f) => f.imagen);
    else if (k === 'imagen') out.imagen = path.basename(txt(b.imagen));
    else if (txt(b[k]) !== '') out[k] = txt(b[k]);
  }
  if (b.tipo === 'destacado' && !out.imagen) return null;
  return out;
}
const colorValido = (v) => (/^#[0-9a-f]{6}$/i.test(txt(v)) ? v : undefined);

export default function editor() {
  let raiz = process.cwd();
  const dir = {
    get contenido() {
      return path.join(raiz, 'src', 'content');
    },
    get secciones() {
      return path.join(raiz, 'src', 'content', 'secciones');
    },
    get imagenes() {
      return path.join(raiz, 'src', 'assets', 'images');
    },
    /** La música va en public/audio/ y se publica tal cual en /audio/ */
    get audio() {
      return path.join(raiz, 'public', 'audio');
    },
  };

  const enviar = (res, codigo, datos) => {
    res.statusCode = codigo;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(datos));
  };
  async function cuerpo(req, max = 2 * 1024 * 1024) {
    const partes = [];
    let total = 0;
    for await (const p of req) {
      total += p.length;
      if (total > max) throw Object.assign(new Error('Demasiado grande'), { codigo: 413 });
      partes.push(p);
    }
    return Buffer.concat(partes);
  }
  const listarImagenes = async () =>
    (await fs.readdir(dir.imagenes))
      .filter((n) => EXT_IMAGEN[path.extname(n).toLowerCase()])
      .sort((a, b) => a.localeCompare(b));

  const listarAudios = async () =>
    existsSync(dir.audio)
      ? (await fs.readdir(dir.audio))
          .filter((n) => EXT_AUDIO.includes(path.extname(n).toLowerCase()))
          .sort((a, b) => a.localeCompare(b))
      : [];

  async function estado() {
    const sitio = parse(await fs.readFile(path.join(dir.contenido, 'sitio.yaml'), 'utf8')) ?? {};
    const secciones = [];
    for (const archivo of await fs.readdir(dir.secciones)) {
      if (!archivo.endsWith('.yaml')) continue;
      const d = parse(await fs.readFile(path.join(dir.secciones, archivo), 'utf8')) ?? {};
      secciones.push({
        id: archivo.slice(0, -5),
        titulo: txt(d.titulo),
        orden: Number(d.orden) || 99,
        bloques: Array.isArray(d.bloques) ? d.bloques : [],
      });
    }
    secciones.sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id));
    return { sitio, secciones, imagenes: await listarImagenes(), audios: await listarAudios() };
  }

  async function manejar(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://local');
    if (!url.pathname.startsWith(API + '/')) return next();
    try {
      // Solo desde este computador…
      const host = req.headers.host ?? '';
      if (!LOCALES.includes(host.replace(/:\d+$/, ''))) return enviar(res, 403, { error: 'Solo local' });
      // …y, para cambiar algo, solo desde la propia página del editor.
      if (req.method !== 'GET') {
        const origen = req.headers.origin;
        if (req.headers['x-editor'] !== '1' || !origen || new URL(origen).host !== host)
          return enviar(res, 403, { error: 'Origen no permitido' });
      }

      const ruta = decodeURIComponent(url.pathname.slice(API.length));
      const m = req.method;

      if (m === 'GET' && ruta === '/estado') return enviar(res, 200, await estado());

      if (m === 'PUT' && ruta === '/sitio') {
        const d = JSON.parse((await cuerpo(req)).toString('utf8'));
        const t = d.tema ?? {};
        const pista = path.basename(txt(d.audio?.archivo));
        const volumen = Math.min(1, Math.max(0, Number(d.audio?.volumen)));
        const sitio = {
          titulo: txt(d.titulo) || 'Mi sitio',
          descripcion: txt(d.descripcion),
          logo: path.basename(txt(d.logo)),
          ...(txt(d.pie) ? { pie: txt(d.pie) } : {}),
          ...(txt(d.frase).trim() ? { frase: txt(d.frase) } : {}),
          ...(pista && existsSync(path.join(dir.audio, pista))
            ? { audio: { archivo: pista, volumen: Number.isFinite(volumen) ? volumen : 0.25 } }
            : {}),
          redes: (Array.isArray(d.redes) ? d.redes : [])
            .map((r) => ({ nombre: txt(r?.nombre), icono: txt(r?.icono), enlace: txt(r?.enlace) }))
            .filter((r) => r.nombre || r.enlace),
          tema: {
            principal: colorValido(t.principal) ?? '#0668ab',
            secundario: colorValido(t.secundario) ?? '#0280d6',
            acento: colorValido(t.acento) ?? '#40b1b8',
            burbujas: t.burbujas !== false,
            formas: t.formas !== false,
            destellos: t.destellos !== false,
          },
        };
        if (!existsSync(path.join(dir.imagenes, sitio.logo)))
          return enviar(res, 400, { error: 'El logo no existe en la carpeta de imágenes' });
        await fs.writeFile(path.join(dir.contenido, 'sitio.yaml'), stringify(sitio, { lineWidth: 0 }));
        return enviar(res, 200, { ok: true });
      }

      const sec = ruta.match(/^\/seccion\/([^/]+)$/);
      if (sec) {
        const id = sec[1];
        if (!ID_VALIDO.test(id)) return enviar(res, 400, { error: 'Nombre de sección no válido' });
        const archivo = path.join(dir.secciones, id + '.yaml');
        if (m === 'PUT') {
          const d = JSON.parse((await cuerpo(req)).toString('utf8'));
          const seccion = {
            titulo: txt(d.titulo) || id,
            orden: Number(d.orden) || 99,
            bloques: (Array.isArray(d.bloques) ? d.bloques : []).map(limpiarBloque).filter(Boolean),
          };
          await fs.writeFile(archivo, stringify(seccion, { lineWidth: 0 }));
          return enviar(res, 200, { ok: true });
        }
        if (m === 'DELETE') {
          await fs.rm(archivo, { force: true });
          return enviar(res, 200, { ok: true });
        }
      }

      if (m === 'POST' && ruta === '/imagen') {
        const original = path.basename(url.searchParams.get('nombre') ?? 'imagen');
        const ext = path.extname(original).toLowerCase();
        if (!EXT_IMAGEN[ext]) return enviar(res, 400, { error: 'Formato no admitido (usa png, jpg, webp, avif, gif o svg)' });
        const base =
          original
            .slice(0, -ext.length)
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'imagen';
        const datos = await cuerpo(req, MAX_IMAGEN);
        if (!datos.length) return enviar(res, 400, { error: 'Archivo vacío' });
        let nombre = base + ext;
        for (let n = 2; existsSync(path.join(dir.imagenes, nombre)); n++) nombre = `${base}-${n}${ext}`;
        await fs.writeFile(path.join(dir.imagenes, nombre), datos);
        return enviar(res, 200, { nombre, imagenes: await listarImagenes() });
      }

      if (m === 'POST' && ruta === '/audio') {
        const original = path.basename(url.searchParams.get('nombre') ?? 'audio');
        const ext = path.extname(original).toLowerCase();
        if (!EXT_AUDIO.includes(ext))
          return enviar(res, 400, { error: 'Formato no admitido (usa mp3, ogg, m4a, wav…)' });
        const datos = await cuerpo(req, MAX_AUDIO);
        if (!datos.length) return enviar(res, 400, { error: 'Archivo vacío' });
        await fs.mkdir(dir.audio, { recursive: true });
        const base = nombreLimpio(original, ext) || 'musica';
        let nombre = base + ext;
        for (let n = 2; existsSync(path.join(dir.audio, nombre)); n++) nombre = `${base}-${n}${ext}`;
        await fs.writeFile(path.join(dir.audio, nombre), datos);
        return enviar(res, 200, { nombre, audios: await listarAudios() });
      }

      const img = ruta.match(/^\/imagen\/([^/]+)$/);
      if (m === 'GET' && img) {
        const nombre = path.basename(img[1]);
        const tipo = EXT_IMAGEN[path.extname(nombre).toLowerCase()];
        const archivo = path.join(dir.imagenes, nombre);
        if (!tipo || !existsSync(archivo)) return enviar(res, 404, { error: 'No existe' });
        res.statusCode = 200;
        res.setHeader('content-type', tipo);
        // Los SVG se muestran solo como imagen: sin scripts
        res.setHeader('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'");
        res.setHeader('cache-control', 'no-store');
        return createReadStream(archivo).pipe(res);
      }

      return enviar(res, 404, { error: 'No encontrado' });
    } catch (e) {
      return enviar(res, e?.codigo ?? 500, { error: String(e?.message ?? e) });
    }
  }

  return {
    name: 'editor-local',
    hooks: {
      'astro:config:setup': ({ command, config, injectRoute }) => {
        raiz = fileURLToPath(config.root);
        if (command !== 'dev') return;
        injectRoute({
          pattern: '/admin',
          entrypoint: fileURLToPath(new URL('./admin.astro', import.meta.url)),
        });
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(manejar);
      },
    },
  };
}
