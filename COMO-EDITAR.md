# Cómo editar acimoru.xyz

## El editor visual (lo normal)

```bash
npm run dev
```

Abre <http://localhost:4321/admin>. A la izquierda editas, a la derecha ves el sitio.
Todo se guarda solo mientras escribes.

Desde ahí puedes:

- **Secciones:** crear, borrar, reordenar y cambiarles el título.
- **Elementos dentro de cada sección:** añadir, quitar y reordenar.
  - Texto (acepta `**negrita**`, `*cursiva*`, `[enlaces](https://…)` y listas con `-`)
  - Galería de fotos
  - Imagen con texto al lado
  - Botón con enlace
  - Video de YouTube
  - Spoiler (texto oculto)
  - Iconos de redes
  - Separador ondulado
- **Fotos:** el botón «Subir…» de cualquier imagen la copia al proyecto.
- **Redes:** añadir, quitar y reordenar. «Icono» es el nombre de la marca en <https://simpleicons.org>.
- **Personalizar:** los tres colores del sitio, y activar o quitar formas, burbujas y destellos del fondo.
- **Música de fondo:** sube un audio (mp3, ogg, m4a, wav…) y ajusta el volumen. Suena en bucle e intenta empezar sola; si el navegador lo bloquea, arranca con el primer clic o toque del visitante. El botón redondo de abajo a la derecha la apaga y enciende. Los archivos quedan en `public/audio/`.
- **Logo y textos generales:** logo, estado o frase bajo el logo, título, descripción y pie de página.

### Es privado

El editor solo existe en tu computador mientras `npm run dev` está corriendo.
No se sube a Netlify: en acimoru.xyz la dirección `/admin` no existe.

### Publicar los cambios

El editor cambia los archivos del proyecto. Para que se vean en acimoru.xyz hay que subirlos:

```bash
git add -A
```

```bash
git commit -m "Actualizo el sitio"
```

```bash
git push
```

Con el sitio conectado a Netlify desde GitHub, el `git push` lo publica solo.

## Dónde queda guardado todo

| Qué | Dónde |
| --- | --- |
| Secciones | `src/content/secciones/` — un archivo `.yaml` por sección |
| Título, logo, redes, colores, pie | `src/content/sitio.yaml` |
| Fotos | `src/assets/images/` |

Son archivos de texto: también puedes editarlos a mano. Una sección se ve así:

```yaml
titulo: Mi setup
orden: 4
bloques:
  - tipo: texto
    texto: Aquí va el texto, con **negrita** y [enlaces](https://osu.ppy.sh).
  - tipo: galeria
    fotos:
      - imagen: teclado.png
        enlace: https://...
        descripcion: Mi teclado
  - tipo: boton
    texto: Ver más
    enlace: https://...
```

El nombre del archivo (`setup.yaml`) es el enlace de la sección: `acimoru.xyz/#setup`.

## Cambiar el diseño o las animaciones

Eso está en el código: `src/pages/index.astro`.
El editor en sí está en la carpeta `editor/`.
