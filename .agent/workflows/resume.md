---
description: Cómo retomar el desarrollo de KaraPlayback
---

Para continuar con el desarrollo de **KaraPlayback** y que el asistente tenga todo el contexto, sigue estos pasos:

1. **Abre el repositorio**: Asegúrate de que el asistente tenga acceso a la carpeta raíz del proyecto (`d:/Pruebas/APP desde Gemini/Pasado a Chat GPT`).
2. **Carga los Artefactos**: Pide al asistente que lea los archivos en la carpeta del cerebro (`brain`). Estos archivos contienen el plan maestro y el progreso:
   - `task.md`: La lista de tareas pendientes y completadas.
   - `implementation_plan.md`: La arquitectura técnica y decisiones de diseño.
   - `walkthrough.md`: El resumen de las funcionalidades implementadas.
3. **Inicia el Servidor**: El asistente debe ejecutar `npm run dev` para ver los cambios en tiempo real.
4. **Verifica la Base de Datos**: Recuerda que las canciones y carpetas están guardadas en el navegador (**IndexedDB**).

// turbo
**Comando rápido**: "Lee los artefactos en el directorio brain y dime cuál es el siguiente paso según task.md"
