-- 1) Trazabilidad de importaciones: qué formato/versión se usó y qué avisos hubo.
ALTER TABLE importaciones
  ADD COLUMN formato TEXT,                               -- ej. 'alimentos@1'; NULL = lectura genérica
  ADD COLUMN avisos  JSONB NOT NULL DEFAULT '[]';

-- 2) Datos básicos obligatorios de cada ingrediente, también en la base de datos.
--    El importador ya los valida; esto evita que entren datos incompletos por otra vía.
--    NOT VALID: se exige para filas nuevas o modificadas sin fallar por datos de prueba antiguos.
ALTER TABLE ingredientes
  ADD CONSTRAINT ingredientes_nombre_no_vacio CHECK (btrim(nombre) <> '') NOT VALID,
  ADD CONSTRAINT ingredientes_fuente_no_vacia CHECK (fuente IS NOT NULL AND btrim(fuente) <> '') NOT VALID,
  ADD CONSTRAINT ingredientes_porcion_positiva CHECK (porcion_g > 0) NOT VALID,
  -- "IS TRUE": si la clave no existe, jsonb_typeof da NULL y un CHECK con NULL dejaría pasar la fila.
  ADD CONSTRAINT ingredientes_nutrientes_basicos CHECK (
        (jsonb_typeof(nutrientes -> 'energia')          = 'number') IS TRUE
    AND (jsonb_typeof(nutrientes -> 'proteinas')        = 'number') IS TRUE
    AND (jsonb_typeof(nutrientes -> 'hidratos_carbono') = 'number') IS TRUE
    AND (jsonb_typeof(nutrientes -> 'lipidos')          = 'number') IS TRUE
  ) NOT VALID;
