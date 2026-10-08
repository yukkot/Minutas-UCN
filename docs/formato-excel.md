# Formato de los Excel

Los formatos se definen de forma **declarativa** en `backend/src/formatos/`:

| Archivo | Rol |
|---|---|
| `motor.js` | Motor genérico: busca la hoja, valida, convierte y genera avisos. No depende de ningún formato. |
| `alimentos.js` | Definición del formato de alimentos (columnas, tipos, unidades, obligatorios). |
| `index.js` | Registro: qué formato usa cada tipo de importación. |

La definición también se puede consultar en `GET /api/importaciones/formatos`.

## Ingredientes: formato de alimentos (`alimentos@1`)

**Estructura de la hoja**

| Fila | Contenido | Uso |
|---|---|---|
| 1 | Encabezados (`CODIGO`, `Tabla comp`, `Calorias`…) | Solo se comparan para **avisar** si las columnas parecen corridas |
| 2 | Numeración de columnas: 1, 2, 3 … 40 | **Reconoce la hoja.** Si falta, el archivo se rechaza indicando qué celda no calza |
| 3 en adelante | Un alimento por fila | Se importa |

- Las columnas se leen **por posición**, no por el texto del encabezado.
- El libro puede tener varias hojas: se usa la primera cuya fila 2 tenga la numeración 1…40.
- Los nutrientes son por la cantidad de la columna D (normalmente 100 g).
- Cada archivo se importa a una **lista** (ver README). Si el código ya existe en esa lista, la fila **actualiza** ese alimento; el mismo código puede existir en listas distintas.

**Columnas**

| N° | Col. | Campo | Descripción | Tipo | Unidad | Obligatorio |
|---|---|---|---|---|---|---|
| 1 | A | `codigo` | Código | entero | — | **Sí** |
| 2 | B | `fuente` | Tabla de composición | texto | — | **Sí** |
| 3 | C | `nombre` | Nombre | texto | — | **Sí** |
| 4 | D | `porcion_g` | Cantidad | numero | g | **Sí** |
| 5 | E | `nutrientes.energia` | Calorías | numero | kcal | **Sí** |
| 6 | F | `nutrientes.proteinas` | Proteínas | numero | g | **Sí** |
| 7 | G | `nutrientes.hidratos_carbono` | Hidratos de carbono | numero | g | **Sí** |
| 8 | H | `nutrientes.azucares_totales` | Azúcares totales | numero | g | No |
| 9 | I | `nutrientes.fibra_dietaria` | Fibra dietaria | numero | g | No |
| 10 | J | `nutrientes.lipidos` | Lípidos | numero | g | **Sí** |
| 11 | K | `nutrientes.ag_saturados` | Saturados | numero | g | No |
| 12 | L | `nutrientes.ag_monoinsaturados` | Monoinsaturados | numero | g | No |
| 13 | M | `nutrientes.ag_poliinsaturados` | Poliinsaturados | numero | g | No |
| 14 | N | `nutrientes.ag_trans` | Ácidos grasos trans | numero | g | No |
| 15 | O | `nutrientes.colesterol` | Colesterol | numero | mg | No |
| 16 | P | `nutrientes.omega_6` | Omega 6 | numero | g | No |
| 17 | Q | `nutrientes.omega_3` | Omega 3 | numero | g | No |
| 18 | R | `nutrientes.caroteno` | Caroteno | numero | ER | No |
| 19 | S | `nutrientes.retinol` | Retinol | numero | ER | No |
| 20 | T | `nutrientes.vitamina_a` | Vitamina A | numero | ER | No |
| 21 | U | `nutrientes.vitamina_c` | Vitamina C | numero | mg | No |
| 22 | V | `nutrientes.vitamina_d` | Vitamina D | numero | — | No |
| 23 | W | `nutrientes.vitamina_e` | Vitamina E | numero | mg | No |
| 24 | X | `nutrientes.vitamina_k` | Vitamina K | numero | — | No |
| 25 | Y | `nutrientes.vitamina_b1` | Vitamina B1 | numero | mg | No |
| 26 | Z | `nutrientes.vitamina_b2` | Vitamina B2 | numero | mg | No |
| 27 | AA | `nutrientes.niacina` | Niacina | numero | mg | No |
| 28 | AB | `nutrientes.vitamina_b6` | Vitamina B6 | numero | mg | No |
| 29 | AC | `nutrientes.ac_pantotenico` | Ác. pantoténico | numero | mg | No |
| 30 | AD | `nutrientes.vitamina_b12` | Vitamina B12 | numero | mg | No |
| 31 | AE | `nutrientes.folatos` | Folatos | numero | mcg | No |
| 32 | AF | `nutrientes.sodio` | Sodio | numero | mg | No |
| 33 | AG | `nutrientes.potasio` | Potasio | numero | mg | No |
| 34 | AH | `nutrientes.calcio` | Calcio | numero | mg | No |
| 35 | AI | `nutrientes.fosforo` | Fósforo | numero | mg | No |
| 36 | AJ | `nutrientes.magnesio` | Magnesio | numero | mg | No |
| 37 | AK | `nutrientes.hierro` | Hierro | numero | mg | No |
| 38 | AL | `nutrientes.zinc` | Zinc | numero | mg | No |
| 39 | AM | `nutrientes.cobre` | Cobre | numero | mg | No |
| 40 | AN | `nutrientes.selenio` | Selenio | numero | mcg | No |

**Reglas de validación**

| Caso | Resultado |
|---|---|
| Falta un campo **obligatorio** o su valor es inválido | Fila omitida; el aviso lista **todos** los campos que faltan |
| Código repetido dentro del archivo | Se conserva la primera aparición; las demás se omiten |
| Número negativo (o porción ≤ 0) | Inválido |
| Código con decimales | Inválido |
| Celda vacía, `-`, `--`, `s/d`, `nd` | Sin dato (`null`) |
| `tr` o `trazas` | `0` |
| Decimal con coma (`1,5`) | `1.5` |
| Texto en un campo numérico **opcional** | Se guarda vacío y se genera un aviso |
| Fila completamente vacía | Se salta sin aviso |

Los avisos indican fila y columna del Excel, se muestran en la vista previa y quedan guardados en
`importaciones.avisos`.

**Doble validación**: además del importador, la base de datos rechaza ingredientes sin nombre, sin fuente,
con porción ≤ 0 o sin calorías, proteínas, hidratos de carbono y lípidos (migración `003`).

## Cómo cambiar o agregar un formato

- **Hacer obligatorio u opcional un campo:** cambiar `obligatorio` en `alimentos.js`. Si es uno de los
  nutrientes básicos, ajustar también el CHECK `ingredientes_nutrientes_basicos` con una migración nueva.
- **Agregar una columna al Excel:** agregar su entrada en `alimentos.js` con el siguiente `n`, y subir
  `version` si los Excel antiguos dejan de ser compatibles.
- **Nuevo formato (por ejemplo, recetas):** crear `formatos/recetas.js` con su definición, registrarlo en
  `formatos/index.js` y agregar su función de guardado en `services/importaciones.service.js`.
- Después de cualquier cambio, ejecutar `npm test` en `backend/`.

## Recetas

> Formato pendiente de definir. Mientras tanto se usa la lectura genérica:

- Primera hoja; la primera fila son los encabezados (se normalizan: `Proteínas (g)` → `proteinas_g`).
- Debe existir una columna `nombre`, `receta`, `plato` o `preparacion`.
- Una columna `tipo`, `tiempo` o `categoria` se usa como tiempo de comida (`desayuno`, `almuerzo`, `once`, `cena`).
- El resto de las columnas se guarda en `recetas.atributos` (JSONB).

## Ejemplos

- `docs/ejemplos/ingredientes.xlsx`: Excel de prueba con 8 aceites en el formato real.
  Lo usan las pruebas automáticas (`npm test`): si lo cambias, ajusta `backend/test/alimentos.test.js`.
- `docs/ejemplos/recetas.xlsx`: recetas de prueba para la lectura genérica.

Los Excel de trabajo que no quieras subir guárdalos en la carpeta `datos/` de la raíz: está en `.gitignore`.
