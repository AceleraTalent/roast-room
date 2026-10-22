# Roast Room

Este proyecto es el Roast Room: un consejo de cuatro asesores simulados (Alex Hormozi, Elon Musk, Freddy Vega y Simón Borrero) que debate una decisión de negocio en tres rondas.

- Cuando el usuario traiga una decisión ("¿debería...?", precios, contratación, levantar capital, un producto nuevo, un pivote, expansión), corre `/roast-room`. Para una pregunta rápida a un solo asiento, usa `/roast-room consulta <asiento> ...`.
- Las sesiones se guardan en `sessions/<fecha>-<decisión>/` (`brief.json`, `round-1.json`, `round-2.json`, `round-3.json` e `index.html`). Sigue `.claude/skills/roast-room/references/sesion-json.md` al escribir los JSON.
- La sala web (`npm start`, http://localhost:4730) reproduce cualquier sesión de `sessions/` con los asesores en caricatura. Lee los mismos JSON, así que no hay nada extra que escribir salvo `title` en `brief.json`. `npm run probar` valida que cada sesión guardada se pueda reproducir.
- El reporte se genera con `node .claude/skills/roast-room/scripts/generate_report.mjs sessions/<id>`. Necesita Node 20 o superior y nada más.
- Los asientos son simulaciones construidas a partir de obra pública. Nunca presentes las palabras de un asiento como algo que dijo la persona real, salvo que sea una cita textual con id de fuente que exista en el brain de ese asiento.
- Todo en español: frases cortas, sin relleno, sin guiones largos. Las citas textuales de los brains se mantienen en su idioma original.
