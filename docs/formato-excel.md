# Formato de los Excel

> Pendiente de definir. Mientras tanto, el importador acepta cualquier columna.

## Reglas actuales del importador

- Se lee solo la **primera hoja**; la **primera fila** son los encabezados.
- Los encabezados se normalizan: minúsculas, sin tildes, espacios y símbolos a `_`.
  `Proteínas (g)` → `proteinas_g`.
- Debe existir una columna de nombre: `nombre`, `ingrediente`, `receta`, `plato` o `preparacion`.
  Si un nombre ya existe en la BD, la fila **actualiza** el registro (no lo duplica).
- En recetas, una columna `tipo`, `tiempo` o `categoria` se usa como tiempo de comida
  (`desayuno`, `almuerzo`, `once`, `cena`).
- Las demás columnas se guardan tal cual en `atributos` (JSONB).
- El JSON completo de cada archivo queda en la tabla `importaciones`.

En `docs/ejemplos/` hay dos archivos de prueba.

## Ingredientes

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| _por definir_ | | | |

## Recetas

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| _por definir_ | | | |
