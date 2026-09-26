# Carpeta de Audio — Reproductor Ambiente Global

## Archivo esperado

El reproductor global (`src/components/audio/GlobalAudioPlayer.tsx`) espera encontrar:

```
/public/audio/rep-ambient.mp3
```

## Cómo colocar el archivo

1. Copiá el archivo `Red de Escucha.mp3` (o el que tengas) a esta carpeta con el nombre exacto `rep-ambient.mp3`:

```bash
cp "/ruta/al/archivo/Red de Escucha.mp3" /home/z/my-project/rep/public/audio/rep-ambient.mp3
```

2. Verificá que el archivo esté bien nombrado:

```bash
ls -la /home/z/my-project/rep/public/audio/
# Debe mostrar: rep-ambient.mp3
```

3. Commit + push para que Vercel lo sirva en producción:

```bash
cd /home/z/my-project/rep
git add public/audio/rep-ambient.mp3
git commit -m "feat(audio): agregar pista ambiente para reproductor global"
git push origin main
```

## Personalización

Si querés usar otro nombre o ruta de archivo, podés pasar la prop `src` al componente:

```tsx
// En src/app/layout.tsx
<GlobalAudioPlayer src="/audio/mi-pista-personalizada.mp3" />
```

## Volumen

El volumen inicial por defecto es `0.45` (sutil, no intrusivo). Podés ajustarlo con la prop `volume`:

```tsx
<GlobalAudioPlayer volume={0.3} />  // más suave
<GlobalAudioPlayer volume={0.6} />  // más fuerte
```

## Formatos recomendados

- **MP3**: máximo compatible con todos los navegadores (recomendado)
- **Bitrate**: 128-192 kbps (balance calidad/tamaño)
- **Duración**: idealmente 1-3 min en loop (loopeable sin corte perceptible)
