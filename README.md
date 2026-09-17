# Analog Replay TV

Analog Replay TV es una aplicación de escritorio inspirada en la experiencia de ver televisión retro, combinando reproducción de contenido de video, simulación de canales, programación real basada en la hora del dispositivo, guía de programación y estética nostálgica de los años 90 y 2000s.

La idea del proyecto es recrear una experiencia de TV analógica en formato moderno, con un entorno visual retro, navegación de canales, control remoto simulado, programación por horarios alineada a slots de 30 minutos, y reproducción inteligente de videos compatibles con la web o convertidos automáticamente si es necesario.

---

## Visión general

Este proyecto está pensado como una mezcla de:

- simulador de television estilo vintage, con control remoto y encendido/apagado simulados,
- reproductor multimedia local con reanudación automática según la hora real,
- gestor de programación de shows y canales que genera una parrilla realista año por año,
- herramienta de conversión/gestión de video para compatibilidad multiplataforma.

Se desarrolla con React para la interfaz, Electron para la aplicación de escritorio y FFmpeg para procesado de video. La lógica de programación y la gestión de canales están diseñadas para que la experiencia final se parezca al comportamiento de una televisión real: los canales tienen una parrilla generada con los shows configurados, cada episodio se transmite en un horario fijo alineado a bloques de 30 minutos, y al sintonizar un canal la aplicación calcula automáticamente en qué punto del episodio "debería" estar la transmisión según la hora actual del dispositivo.

---

## Funcionalidades que experimenta el usuario

Esta es la experiencia completa desde el punto de vista de quien usa la aplicación, de principio a fin:

- **Selección de año de transmisión inicial**: la primera vez que se abre la app, se elige una década y un año; a partir de ahí se genera automáticamente la programación de todos los canales para ese año completo.
- **Cambio de canal realista**: al subir/bajar de canal, la app siempre muestra el show y episodio que "está en emisión ahora mismo" según la hora real del dispositivo y la programación generada — no siempre el mismo episodio desde el principio, sino el punto exacto (minuto y segundo) donde debería estar la transmisión en ese momento.
- **Programación alineada a bloques de 30 minutos**: cada episodio comienza siempre en horario "en punto" o "y media", como una parrilla de TV real. Si un episodio dura menos de 30 minutos, el tiempo restante se llena con una pantalla animada de identificación de estación ("AnalogReplayTV") con estilo acorde a la época elegida (90s o 2000s), en lugar de dejar un vacío o cortar abruptamente. Este espacio será usado a futuro para comerciales.
- **Episodios multiparte como un solo programa**: los archivos de episodio que comparten un código de bloque en su título (patrón `<número><letra>`, por ejemplo "01a: ...", "01b: ...", "01c: ...", que corresponden al mismo episodio real dividido en varias partes) se detectan automáticamente y se agrupan en un solo bloque etiquetado como un único episodio: la programación calcula su duración combinada (todas las partes cuentan como un solo programa dentro del bloque de 30 minutos) y el reproductor las encadena en secuencia automáticamente, incluyendo reanudar en la parte correcta si la transmisión cae a mitad del bloque. Los episodios independientes sin código de letra (como especiales sueltos) siguen tratándose como bloques de una sola parte.
- **Avance automático de episodios**: mientras se permanece en un canal, la aplicación revisa periódicamente si la programación avanzó a un nuevo episodio o bloque y actualiza la reproducción automáticamente, sin que el usuario tenga que volver a cambiar de canal.
- **Mezcla de shows por canal**: cuando varios programas comparten el mismo canal, se alternan entre sí (round-robin) en vez de transmitir todos los episodios de uno antes de pasar al siguiente, simulando una parrilla más variada.
- **Filtrado de programación por año de emisión**: cada show puede configurarse con años de transmisión específicos o marcarse como "hasta la fecha" para que aparezca siempre sin importar el año elegido.
- **Reproducción resiliente ante archivos faltantes**: si el episodio programado no se encuentra en ninguna carpeta configurada, la aplicación busca automáticamente otro episodio disponible del mismo show en vez de detenerse con un error; los mensajes de error, cuando ocurren, se muestran de forma discreta dentro del propio reproductor (nunca como ventanas emergentes intrusivas).
- **Múltiples carpetas de contenido por temporada**: es posible agregar más de una carpeta de contenido para una misma temporada (por ejemplo, un disco duro externo con otro puerto o una copia de respaldo). Al agregar una carpeta nueva, la aplicación intenta emparejar automáticamente los archivos existentes en ella con los episodios ya configurados (por nombre exacto, nombre similar, o código de episodio), y reproduce el que efectivamente exista sin pedir intervención manual.
- **Control remoto simulado**: un panel con botones de encendido/apagado, silencio, canal arriba/abajo, volumen arriba/abajo, menú, guía, teclado numérico para saltar directamente a un canal, y botón de último canal ("LAST"). Es completamente navegable con el mouse o con el teclado (flechas para moverse entre botones, Enter para seleccionar).
- **Encendido/apagado de la TV**: al "apagar" la TV desde el control remoto, la pantalla se pone en negro y el audio se silencia; al "encenderla" de nuevo, la reproducción continúa exactamente donde correspondería según la hora real.
- **Botones de control ocultables**: los botones inferiores (canal arriba/abajo, menú, guía, control remoto) están ocultos por defecto para una vista más limpia; se muestran presionando Enter o cualquier flecha del teclado, y se ocultan con Escape o con un botón dedicado.
- **Guía de programación (TV Guide)**: muestra en una grilla los canales disponibles junto con el show y episodio real que corresponde a cada franja horaria del día, navegable con el teclado.
- **Ajustes visuales en vivo**: cambio entre estilo 90s/2000s, relación de aspecto 4:3/16:9 (con el marco de la TV cambiando de forma correctamente), filtro CRT, y control de volumen — todo aplicado sin interrumpir la reproducción en curso.
- **Resetear programación**: desde el menú de configuración es posible borrar toda la programación generada y volver a elegir un año de transmisión desde cero, con confirmación previa para evitar borrados accidentales.
- **Gestión completa de shows y canales**: alta, edición e importación de shows (con temporadas, episodios, canales asignados, años de emisión, y carpetas de contenido) y canales, todo desde el menú de configuración dentro de la propia aplicación.
- **Conversión automática de video cuando es necesario**: si el archivo de un episodio no es compatible de forma nativa con el reproductor, la aplicación lo detecta y lo convierte automáticamente con FFmpeg antes de reproducirlo.

---

## Funcionalidades principales

### 1. Simulación de TV retro

- Interfaz tipo televisor con estilos visuales inspirados en los años 90 y 2000.
- Cambio de canal con comportamiento similar a una TV analógica.
- Visualización de información del canal y del contenido en reproducción.
- Controles de volumen, estilo visual, relación de aspecto (4:3/16:9) y filtros CRT.
- **Filtro CRT optimizado para rendimiento**: el tinte de color del filtro CRT se "hornea" sobre un canvas de resolución fija y pequeña (en vez de aplicar la propiedad CSS `filter` sobre el video), de modo que la GPU solo estira el bitmap ya procesado al mostrarlo en pantalla completa; esto evita que Chromium re-rasterice el filtro a la resolución de pantalla (la causa del lag) sin sacrificar el efecto visual, que incluye resplandor del fósforo y líneas de escaneo animadas.
- Menús y componentes con estética retro adaptada al diseño.
- Botones de control (canal, menú, guía) ocultos por defecto, mostrados/ocultados con el teclado (flechas/Enter/Escape) o con un botón dedicado.
- Control remoto simulado con navegación completa por teclado o mouse (encendido/apagado, silencio, canal, volumen, menú, guía, acceso numérico directo a canal, último canal).
- Pantalla de "TV apagada" y pantalla de relleno animada ("AnalogReplayTV") con estilo acorde a la época elegida.

### 2. Reproducción de video local

- Soporte para archivos de video en distintos formatos.
- Reproducción mediante componentes híbridos de video y tecnología del navegador.
- Detección automática de compatibilidad HTML5.
- Fallback y adaptaciones según el formato del archivo.
- Manejo de contenido con transiciones y visualización de estado de reproducción.
- Reanudación de episodios en el punto exacto (seek time) que corresponde según la hora real y la programación generada.
- Reproducción en secuencia de episodios multiparte: cuando el episodio programado pertenece a un bloque con varias partes ("01a/01b/01c"), el reproductor arma automáticamente la lista de todas sus partes, inicia en la parte y desplazamiento correctos según el seek time acumulado, y encadena cada parte al terminar la anterior (listener de fin de reproducción sobre el propio elemento de video).
- Resolución de episodios tolerante: prueba múltiples nombres de archivo candidatos y múltiples carpetas de contenido (incluyendo subcarpetas de temporada) antes de reportar un episodio como no disponible; si el episodio programado no existe, reproduce otro episodio disponible del mismo show como respaldo.

### 3. Conversión automática de video con FFmpeg

- Análisis de metadatos con ffprobe.
- Conversión automática de videos no compatibles con la web.
- Reducción de resolución y ajustes de calidad según la resolución original.
- Generación de archivos temporales en caché para evitar reprocesamiento innecesario.
- Seguimiento de progreso de conversión y gestión de colas de trabajo.

### 4. Sistema de canales

- Administración de canales por número y nombre.
- Carga de configuración de canales y asociaciones por tipo de programación.
- Soporte para múltiples canales por show y cambios de canal dinámicos.
- Manejo de estados de canal y errores si no existe contenido disponible.

### 5. Sistema de shows y programación

- Definición de shows, temporadas y episodios, con soporte para múltiples nombres de archivo candidatos por episodio (`fileNames`), útil cuando el mismo episodio existe en más de una carpeta con nombres distintos.
- Agrupación automática de archivos multiparte en bloques individuales: los archivos cuyo nombre comienza con un código de grupo y letra (patrón `<número><letra>`) se agrupan como un solo episodio real antes de generar la programación, de forma que cada bloque (todas sus partes) cuente como un solo programa en la parrilla y tenga la duración combinada de todas sus partes, sin importar cuántos archivos de contenido haya por cada bloque.
- Soporte para múltiples carpetas de contenido por temporada, con emparejamiento automático de archivos al agregar una carpeta nueva.
- Configuración de años de transmisión por show (`airYears`) o marca "hasta la fecha" (`airUntilToDate`) para controlar en qué años aparece un show en la programación generada.
- Generación de programación real y anual: se lee el catálogo real de shows/canales configurados, se filtra por año de emisión, y se arma una rotación mezclada (round-robin) de episodios por canal.
- Programación alineada a slots de 30 minutos, con relleno automático ("AnalogReplayTV") cuando un episodio no llena el bloque completo.
- Resolución en tiempo real de "qué se transmite ahora": cruza la hora actual del dispositivo con la programación generada para determinar el show, temporada, episodio y punto de reanudación exactos.
- Avance automático de episodios mediante sondeo periódico mientras la TV permanece encendida en un canal.
- Opción de resetear la programación completa desde el menú, para volver a generarla desde cero con un nuevo año.

### 6. Guía de programación

- Visualización de la programación real del día por canal y franja horaria (basada en las mismas entradas generadas que usa el reproductor, no en datos simulados).
- Información sobre el contenido actual y próximo.
- Cálculo de tiempo transcurrido y restante dentro del programa.
- Gestión del flujo de reproducción con continuidad entre episodios y bloques.

### 7. Persistencia local y configuración

- Configuración de usuario guardada localmente (estilo visual, aspecto, volumen, filtro CRT).
- Programación generada persistida en la carpeta de datos de usuario de Electron (no en el código fuente), compatible con builds empaquetadas.
- Inicialización al arrancar la aplicación para recuperar estado previo.

---

## Tecnologías y stack

### Frontend

- React 18
- TypeScript
- Vite
- CSS moderno y estilos personalizados para la estética retro
- React Router DOM

### Desktop app

- Electron
- Electron Builder para empaquetado
- Proceso principal y preload para comunicación entre UI y sistema local

### Video / multimedia

- FFmpeg
- ffprobe para análisis de metadatos
- Fluent FFmpeg
- WebCodecs / HTML5 video pipeline
- Node-based media processing in Electron main process

### Node y entorno

- Node.js
- TypeScript para Electron y lógica del proceso principal
- Concurrently y Wait-On para tareas de desarrollo
- Cross-env para entorno multi-platform

### Utilidades y librerías auxiliares

- UUID para identificadores de recursos
- Canvas
- get-video-duration
- node-vlc-http (integración con reproducción/streaming multimedia avanzado)
- ESLint para calidad de código

---

## Arquitectura del proyecto

El proyecto está estructurado en varias capas:

- Frontend de la interfaz: componentes React en src/
- Lógica de dominio: servicios, hooks y managers para canales, shows y guía
- Proceso principal de Electron: electron/
- Procesado y análisis de video: electron/services/
- Configuración y contenido local: src/config/
- Tipos y modelos: src/types/
- Utilidades compartidas: src/utils/
- Estilos visuales: src/styles/

### Estructura principal

```text
AnalogReplayTV/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── VideoEngineMain.ts
│   ├── services/
│   │   ├── NativeVideoPlayer.ts
│   │   ├── ScheduleService.ts
│   │   ├── VideoAnalyzer.ts
│   │   ├── VideoConversionQueue.ts
│   │   ├── VideoConverter.ts
│   │   ├── VideoStreamManager.ts
│   │   └── WebCodecsVideoPlayer.ts
│   └── types/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── RemoteControl.tsx
│   │   ├── AnalogReplayFiller.tsx
│   │   ├── TVShowPlayer.tsx
│   │   ├── TVGuide.tsx
│   │   ├── ShowConfig.tsx
│   │   ├── ChannelConfig.tsx
│   │   └── ...
│   ├── config/
│   ├── features/
│   ├── hooks/
│   ├── services/
│   ├── styles/
│   ├── types/
│   └── utils/
│       ├── episodeFiles.ts
│       └── episodeBlocks.ts
├── docs/
│   ├── COMMERCIAL_SYSTEM.md
│   ├── SCHEDULE_SYSTEM.md
│   ├── SHOW_SYSTEM.md
│   └── VIDEO_ARCHITECTURE_PROPOSAL.md
├── public/
├── scripts/
├── dist-electron/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.json
├── index.html
├── README.md
└── ...
```

---

## Flujo de uso

1. El usuario lanza la aplicación.
2. Si es la primera vez, se solicita elegir una década y un año de transmisión; con eso se genera automáticamente la programación anual completa para todos los canales configurados.
3. La UI inicializa canales y carga la programación generada.
4. El usuario navega entre canales (con los botones en pantalla, el teclado o el control remoto simulado); en cada canal se resuelve el show, temporada, episodio y punto exacto de reproducción según la hora real del dispositivo.
5. Si el episodio dura menos que su bloque de 30 minutos, se muestra la pantalla animada de relleno "AnalogReplayTV" hasta el siguiente bloque.
6. Mientras el usuario permanece en un canal, la aplicación revisa periódicamente si la programación avanzó y actualiza la reproducción automáticamente.
7. Si el video no es compatible, la aplicación lo convierte con FFmpeg antes de reproducirlo; si el archivo programado no está disponible en ninguna carpeta configurada, se reproduce otro episodio disponible del mismo show.
8. La experiencia se mantiene con estilo retro, guía de programación, control remoto y controles de TV ocultables.
9. En cualquier momento el usuario puede resetear la programación desde el menú para elegir un nuevo año desde cero.

---

## Requisitos previos

- Node.js 18 o superior
- npm o pnpm
- FFmpeg instalado y accesible desde el PATH
- Entorno Windows recomendado para la instalación de FFmpeg y el empaquetado final

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/ChuckAileron/Analog-Replay-TV.git
cd Analog-Replay-TV
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Instalar FFmpeg

Se recomienda instalar FFmpeg para que la conversión y análisis de video funcione correctamente.

#### Opción recomendada

```powershell
npm run install-ffmpeg
```

#### Verificación

```powershell
ffmpeg -version
```

Si FFmpeg no está disponible, puedes comprobarlo con:

```bash
npm run check-ffmpeg
```

---

## Scripts disponibles

En el proyecto se usan los siguientes comandos principales:

```bash
npm run dev
```
Inicia la aplicación en modo de desarrollo con Vite.

```bash
npm run build
```
Compila la aplicación React para producción.

```bash
npm run preview
```
Previsualiza la build de producción.

```bash
npm run compile:electron
```
Compila el código TypeScript del proceso principal de Electron.

```bash
npm run electron:dev
```
Ejecuta la app en modo desarrollo con Electron.

```bash
npm run electron:build
```
Genera el paquete final de la aplicación de escritorio.

```bash
npm run lint
```
Ejecuta ESLint para validar el código.

```bash
npm run type-check
```
Comprueba los tipos de TypeScript para frontend y Electron.

---

## Modo de desarrollo

```bash
npm run compile:electron
npm run dev
```

O bien, para arrancar todo integrado en Electron:

```bash
npm run electron:dev
```

Esto permite trabajar con la UI y con el proceso principal de la aplicación en un entorno similar al final de producción.

---

## Producción

```bash
npm run electron:build
```

Este comando compila la aplicación y genera un paquete listo para distribución mediante Electron Builder.

---

## Documentación adicional

El repositorio incluye varios documentos en la carpeta docs/ que describen con detalle cada parte del sistema:

- SCHEDULE_SYSTEM.md: lógica de programación
- SHOW_SYSTEM.md: definición y gestión de shows
- VIDEO_ARCHITECTURE_PROPOSAL.md: arquitectura del flujo de video
- COMMERCIAL_SYSTEM.md: sistema de comerciales y bloques publicitarios (el espacio de relleno "AnalogReplayTV" es el paso previo a este sistema)

Estos archivos ayudan a entender el diseño del proyecto y la evolución de la arquitectura.

---

## Casos de uso

El proyecto es especialmente útil para:

- crear experiencias de TV nostálgica en entorno local, con una programación que se comporta como una parrilla real,
- reproducir bibliotecas de video personales con un estilo retro,
- generar una programación automática tipo canal de televisión, alineada a bloques de 30 minutos,
- experimentar con sistemas de guía, contenido y simbiosis de video + UI.

---

## Estado del proyecto

Analog Replay TV está en desarrollo activo y combina varias piezas clave de un sistema multimedia completo: reproducción, conversión, programación real basada en tiempo, control remoto simulado, visual design y gestión de contenido.

Es un proyecto flexible y extensible, ideal para seguir evolucionando con nuevas funcionalidades como:

- sistema de comerciales real (reemplazando/complementando el espacio de relleno actual),
- más canales y show packs,
- mayor personalización de estilos retro,
- soporte más robusto de codecs,
- mejoras en la guía de programación,
- sistema más avanzado de reproducción por timecode y buffering.

---

## Resumen

Analog Replay TV no es solo un reproductor multimedia; es una experiencia de televisión retro con un sistema de canales, programación real basada en la hora del dispositivo, control remoto simulado, contenido, reproducción y conversión de video todo en una sola aplicación local.

Su principal valor es unir estética vintage, arquitectura moderna de aplicaciones desktop y un pipeline multimedia capaz de adaptar videos para su visualización con una experiencia coherente, resiliente y personalizable.
