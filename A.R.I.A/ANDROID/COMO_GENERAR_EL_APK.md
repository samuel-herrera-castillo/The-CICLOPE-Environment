# Cómo generar el APK de A.R.I.A

El proyecto ya está completamente configurado con:
- El icono de las alas (en todos los tamaños)
- El nombre **A.R.I.A** que aparecerá bajo el icono
- Tu aplicación web completa dentro

Solo falta **compilar** el APK. Compilar requiere el Android SDK, que no cabía en la entrega. Aquí tienes dos formas de hacerlo, de la más fácil a la más técnica.

---

## OPCIÓN A — La más fácil: compilar en la nube (sin instalar nada)

Usa un servicio gratuito que compila el proyecto por ti.

### Con GitHub + un compilador online

1. Crea una cuenta gratis en **github.com** si no tienes.
2. Crea un repositorio nuevo y sube esta carpeta completa.
3. Ve a **https://www.pwabuilder.com** o usa **Codemagic** (codemagic.io, tiene plan gratis) o **AppCircle**.
4. Conecta tu repositorio y elige "compilar APK de Android".
5. Descarga el `.apk` cuando termine.

> Codemagic es el más recomendado: detecta que es un proyecto Capacitor y compila el APK automáticamente. El plan gratuito alcanza de sobra.

---

## OPCIÓN B — En tu propia PC con Android Studio (gratis)

Esta es la forma oficial y te da control total.

### 1. Instala Android Studio
Descárgalo gratis de **https://developer.android.com/studio**
Al instalarlo, acepta que descargue el "Android SDK" (lo hace solo).

### 2. Instala Node.js
Descárgalo de **https://nodejs.org** (versión LTS).

### 3. Prepara el proyecto
Abre una terminal (CMD en Windows) dentro de esta carpeta y ejecuta:

```
npm install
npx cap sync android
```

### 4. Abre y compila
```
npx cap open android
```
Esto abre Android Studio. Dentro:
- Espera a que termine de indexar (barra de abajo).
- Menú **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
- Cuando termine, aparece un aviso "locate" → clic ahí y encontrarás el archivo:
  `android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Instala en tu teléfono
- Pasa el `app-debug.apk` a tu teléfono (por cable, WhatsApp, Drive, etc.).
- Ábrelo en el teléfono y acepta "instalar de fuentes desconocidas".
- ¡Listo! A.R.I.A aparece en tu pantalla con el icono de las alas.

---

## Detalles del proyecto (ya configurados)

| Dato | Valor |
|------|-------|
| Nombre de la app | A.R.I.A |
| ID del paquete | edu.sena.aria |
| Icono | Las alas que enviaste |
| Fondo del icono | Blanco |

Si quieres cambiar el nombre o el ID más adelante, están en:
- Nombre: `android/app/src/main/res/values/strings.xml`
- ID: `capacitor.config.json`

---

## Nota sobre APK vs. instalación

Este APK es de tipo **debug** (para uso personal), se instala directamente sin
pasar por Google Play. Es perfecto para ti y para compartir con colegas. Si algún
día quisieras publicarlo en Google Play, habría que generar una versión "firmada"
(release), pero para uso propio el debug funciona igual de bien.
