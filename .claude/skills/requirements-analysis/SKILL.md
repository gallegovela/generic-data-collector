---
name: requirements-analysis
description: Técnicas para obtener, aclarar y redactar requisitos de software a partir de conversaciones o issues. Úsala al analizar una petición nueva, al detectar ambigüedades o al escribir requisitos funcionales, no funcionales y criterios de aceptación.
---

# Análisis de requisitos

## 1. Entender la petición

Antes de escribir nada, responde por escrito (aunque sea en tus notas):

- **Quién** lo usa (administrador, trabajador de campo, cliente final, sistema externo).
- **Qué problema** resuelve y cómo se resuelve hoy (papel, Excel, WhatsApp).
- **Cuándo** se considera hecho: qué tiene que poder hacer el usuario al final.
- **Dónde** encaja en el recorrido de la demo de `CLAUDE.md` y en qué módulo de `specs/`.
- **Qué no** incluye (fuera de alcance explícito).

## 2. Separar necesidad de solución

El usuario suele pedir una solución ("pon un botón que exporte"). Pregunta o deduce la necesidad ("el gestor necesita los datos en su Excel cada viernes") y valora si la solución pedida es la mejor. Si propones otra, explica por qué.

## 3. Detectar huecos

Revisa siempre estas dimensiones:

| Dimensión | Preguntas típicas |
| --- | --- |
| Datos | ¿Qué se guarda? ¿Es dato personal? ¿Cuánto tiempo se conserva? |
| Permisos | ¿Qué rol puede hacerlo (`admin`, `collector`)? ¿Aislado por organización? |
| Sin conexión | ¿Tiene que funcionar sin red? ¿Qué pasa al sincronizar? ¿Conflictos? |
| Errores | ¿Qué ve el usuario si falla? ¿Se reintenta? |
| Volumen | ¿Cuántos registros, ficheros, tamaño máximo? |
| Versionado | ¿Afecta a formularios ya publicados o a respuestas antiguas? |
| Demo | ¿Cómo se enseña en la demo? ¿Necesita datos de ejemplo en el seed? |

## 4. Preguntar bien

- Máximo 5 preguntas por ronda, numeradas.
- Cada pregunta con una **propuesta por defecto**: "¿El PDF incluye las fotos? Propuesta: sí, en miniatura al final".
- Pregunta solo lo que cambia el diseño. Lo demás, decídelo y déjalo anotado como supuesto.

## 5. Redactar requisitos

- **Funcionales** (`RF-<MOD>-NN`): "El sistema debe…" / "El administrador puede…". Uno por comportamiento, verificable, sin detalles de implementación.
- **No funcionales** (`RNF-<MOD>-NN`): rendimiento, seguridad, RGPD, accesibilidad, compatibilidad móvil, sin conexión. Con número siempre que se pueda ("en menos de 2 s con 1 000 respuestas").
- **Criterios de aceptación** (`CA-<MOD>-NN`) en formato Dado / Cuando / Entonces:

  ```text
  CA-OUT-03
  Dado un formulario publicado con un destino de email configurado
  Cuando un trabajador envía una respuesta
  Entonces el destinatario recibe en menos de 1 minuto un email con el PDF de la respuesta adjunto
  ```

- Prioridad MoSCoW por requisito: `Must`, `Should`, `Could`, `Won't (ahora)`.
- Supuestos y preguntas abiertas, en su propia sección.

## 6. Comprobar calidad

Cada requisito debe ser: necesario, sin ambigüedad (nada de "rápido", "fácil", "etc."), verificable, coherente con los demás módulos y trazable (tiene identificador y aparece en algún issue).
