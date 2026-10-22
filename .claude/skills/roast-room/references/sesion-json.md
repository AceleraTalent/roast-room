# Archivos de sesión: formato JSON

Cada sesión vive en `sessions/<id>/`, donde `<id>` es `AAAA-MM-DD-<slug-de-la-decision>` (minúsculas, sin tildes, palabras separadas por guiones, máximo 6 palabras). Si la carpeta ya existe, agrega `-2`, `-3`, etc.

El Chair escribe cuatro archivos, cada uno en el momento indicado, como JSON estricto (sin comentarios ni comas finales):

| Archivo | Cuándo se escribe |
|---|---|
| `brief.json` | Al terminar el Paso 1, antes de lanzar la Ronda 1 |
| `round-1.json` | Al cerrar la Ronda 1 (tarjetas revisadas y notas del Chair listas) |
| `round-2.json` | Al cerrar la Ronda 2 |
| `round-3.json` | Al cerrar la Ronda 3, con el veredicto |

Después, `generate_report.mjs` lee los cuatro y escribe `index.html` en la misma carpeta.

`title` es un titular corto (máximo 70 caracteres) que muestra la sala web; si falta, usa `decision`. Las etiquetas de `options[].label` empiezan con un nombre corto antes de los dos puntos (por ejemplo `"Hypergrowth: gastar $80K en ..."`): la sala solo muestra ese nombre.

Reglas comunes:
- Los asientos se escriben con su clave: `hormozi`, `musk`, `vega`, `borrero`.
- Las opciones se identifican con su letra (`"A"`, `"B"`, `"C"`). Toda tarjeta puntúa **todas** las opciones del brief con un entero o decimal de 1 a 10.
- `raw` guarda la tarjeta textual completa, tal como la devolvió el asiento. Los demás campos son la misma información desglosada; no la reescribas ni la resumas con otras palabras.
- Los campos marcados como opcionales se pueden omitir; el resto es obligatorio y el script falla si falta.

## brief.json

```json
{
  "version": 1,
  "id": "2026-10-20-subir-precio-del-curso",
  "title": "¿Subo el precio del curso a $297?",
  "created": "2026-10-20T15:04:00-05:00",
  "mode": "completo",
  "decision": "¿Subo el precio del curso de $97 a $297?",
  "options": [
    { "id": "A", "label": "Subir a $297 con garantía", "added_by_chair": false },
    { "id": "B", "label": "Mantener $97 y sumar un upsell de $297", "added_by_chair": false },
    { "id": "C", "label": "Mantener lo actual", "added_by_chair": true }
  ],
  "context": {
    "business": "Curso online de diseño para freelancers en LatAm",
    "metrics": [
      { "name": "Ingresos mensuales", "value": "$18.000", "assumed": false },
      { "name": "Tasa de cierre", "value": "4%", "assumed": false },
      { "name": "Churn mensual", "value": "9%", "assumed": true }
    ],
    "resources": "Runway de 8 meses, equipo de 3"
  },
  "success": "Duplicar la utilidad mensual sin subir el churn",
  "horizon": "6 meses",
  "lean": { "option": "A", "reason": "Siente que el curso vale más" },
  "assumptions": ["Churn mensual del 9% (supuesto)"],
  "seats": [
    { "seat": "hormozi", "weight": 3, "reason": "Es una decisión de precio" },
    { "seat": "musk", "weight": 1, "reason": "Toca costos de entrega de forma tangencial" },
    { "seat": "vega", "weight": 3, "reason": "Retención y comunidad de estudiantes" },
    { "seat": "borrero", "weight": 2, "reason": "Velocidad de crecimiento y escala" }
  ]
}
```

Opcionales: `context.business`, `context.resources`, `horizon`, `lean`, `assumptions`, `added_by_chair`, `assumed`.

## round-1.json

```json
{
  "round": 1,
  "cards": [
    {
      "seat": "hormozi",
      "stance": "Sí condicionado",
      "scores": { "A": 8, "B": 6, "C": 2 },
      "confidence": 4,
      "ruin_risk": "ninguno",
      "door": "de dos vías",
      "call": "Sube a $297 con garantía condicional.",
      "why": ["...", "...", "..."],
      "risk": "...",
      "change_mind": "...",
      "this_week": "...",
      "question": "...",
      "raw": "ASIENTO: Hormozi (Ofertas, precios y ventas)\nPOSTURA: ..."
    }
  ],
  "chair_notes": {
    "cruxes": [
      { "text": "¿El precio alto sube o baja la retención?", "sides": { "sube": ["hormozi"], "baja": ["vega"] } }
    ],
    "consensus": { "reached": false, "reason": "Las favoritas se reparten entre A y B." },
    "devils_advocates": [{ "seat": "musk", "option": "C" }],
    "pairings": [{ "seat": "hormozi", "responds_to": "vega" }]
  }
}
```

Obligatorios por tarjeta: `seat`, `scores`. Todo lo demás de la tarjeta y `chair_notes` es opcional, pero llénalo siempre que el asiento lo haya dado.

## round-2.json

```json
{
  "round": 2,
  "cards": [
    {
      "seat": "musk",
      "role": "abogado",
      "advocate_option": "C",
      "responds_to": "borrero",
      "rebuttal": "...",
      "best_case": ["...", "...", "..."],
      "concede": "...",
      "on_cruxes": ["..."],
      "scores": { "A": 7, "B": 6, "C": 3 },
      "confidence": 3,
      "ruin_risk": "ninguno",
      "moved": { "moved": true, "from": "B", "to": "A", "because": "..." },
      "conditions": ["..."],
      "raw": "..."
    }
  ],
  "chair_notes": {
    "friction": [{ "between": ["hormozi", "vega"], "summary": "Caja a 30 días contra retención de la comunidad." }],
    "resolved": ["..."],
    "open": ["..."],
    "interim_averages": { "A": 7.1, "B": 5.8, "C": 2.9 }
  }
}
```

`role` es `"propio"` o `"abogado"`; `advocate_option` solo aplica a los abogados. En `scores` va la postura real del asiento después del debate, no la del rol de abogado. `moved` es `{ "moved": false }` si no se movió. `friction` lista los momentos de mayor choque entre asientos (uno a tres).

## round-3.json

```json
{
  "round": 3,
  "cards": [
    {
      "seat": "vega",
      "vote": "A",
      "scores": { "A": 7, "B": 6, "C": 2 },
      "safeguard": "...",
      "main_risk": "...",
      "line": "...",
      "raw": "..."
    }
  ],
  "results": {
    "weighted": { "A": 7.4, "B": 5.9, "C": 2.6 },
    "simple": { "A": 7.3, "B": 5.8, "C": 2.5 },
    "votes": { "A": 3, "B": 1, "C": 0 }
  },
  "verdict": {
    "label": "Adelante con condiciones",
    "option": "A",
    "summary": "Una o dos frases con la decisión.",
    "tie": false,
    "tie_reason": "",
    "why": [{ "text": "...", "seat": "hormozi" }],
    "conditions": [{ "text": "...", "seat": "vega" }],
    "risks": [{ "text": "...", "seat": "borrero", "early_signal": "..." }],
    "dissent": { "text": "...", "seat": "musk" },
    "actions": {
      "this_week": "...",
      "next_30_days": "...",
      "kill_criteria": "..."
    },
    "chair_notes": ["..."]
  }
}
```

Obligatorios: cada tarjeta con `seat`, `vote` (una opción del brief) y `scores`; `verdict.label`, `verdict.option` y `verdict.summary`. `dissent` es `null` si el voto fue unánime. El script recalcula `results` a partir de las tarjetas y los pesos del brief; si lo registrado no coincide, avisa y usa lo recalculado.
