-- =============================================================================
-- 1) LISTAS: agrupan ingredientes que vienen de distintos Excel para no mezclarlos.
-- =============================================================================
CREATE TABLE listas (
  id              SERIAL PRIMARY KEY,
  tipo            TEXT        NOT NULL CHECK (tipo IN ('ingredientes')),  -- preparado para otros tipos
  nombre          TEXT        NOT NULL CHECK (btrim(nombre) <> ''),
  descripcion     TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo, nombre)
);

-- Los ingredientes que ya existían pasan a una lista "General".
INSERT INTO listas (tipo, nombre, descripcion)
SELECT 'ingredientes', 'General', 'Ingredientes cargados antes de existir las listas'
WHERE EXISTS (SELECT 1 FROM ingredientes);

-- Los CHECK de la migración 003 son NOT VALID: no se exigen a filas antiguas, PERO sí a cualquier
-- fila que se actualice. Para asignar la lista sin fallar por datos antiguos incompletos, se quitan
-- y se vuelven a crear igual que en la 003.
ALTER TABLE ingredientes
  DROP CONSTRAINT ingredientes_nombre_no_vacio,
  DROP CONSTRAINT ingredientes_fuente_no_vacia,
  DROP CONSTRAINT ingredientes_porcion_positiva,
  DROP CONSTRAINT ingredientes_nutrientes_basicos;

ALTER TABLE ingredientes ADD COLUMN lista_id INTEGER REFERENCES listas(id) ON DELETE CASCADE;
UPDATE ingredientes SET lista_id = (SELECT id FROM listas WHERE tipo = 'ingredientes' AND nombre = 'General');
ALTER TABLE ingredientes ALTER COLUMN lista_id SET NOT NULL;

ALTER TABLE ingredientes
  ADD CONSTRAINT ingredientes_nombre_no_vacio CHECK (btrim(nombre) <> '') NOT VALID,
  ADD CONSTRAINT ingredientes_fuente_no_vacia CHECK (fuente IS NOT NULL AND btrim(fuente) <> '') NOT VALID,
  ADD CONSTRAINT ingredientes_porcion_positiva CHECK (porcion_g > 0) NOT VALID,
  ADD CONSTRAINT ingredientes_nutrientes_basicos CHECK (
        (jsonb_typeof(nutrientes -> 'energia')          = 'number') IS TRUE
    AND (jsonb_typeof(nutrientes -> 'proteinas')        = 'number') IS TRUE
    AND (jsonb_typeof(nutrientes -> 'hidratos_carbono') = 'number') IS TRUE
    AND (jsonb_typeof(nutrientes -> 'lipidos')          = 'number') IS TRUE
  ) NOT VALID;

-- El código ahora es único dentro de cada lista (dos listas pueden tener el código 1).
ALTER TABLE ingredientes DROP CONSTRAINT ingredientes_codigo_key;
ALTER TABLE ingredientes ADD CONSTRAINT ingredientes_lista_codigo_key UNIQUE (lista_id, codigo);

-- =============================================================================
-- 2) IMPORTACIONES COMO COLA DE TRABAJOS ASÍNCRONOS
--    La API solo registra el archivo (estado "pendiente") y responde de inmediato.
--    Un worker lo procesa después: pendiente -> procesando -> completada | fallida
-- =============================================================================
ALTER TABLE importaciones
  ADD COLUMN lista_id       INTEGER REFERENCES listas(id) ON DELETE SET NULL,
  ADD COLUMN modo           TEXT     NOT NULL DEFAULT 'agregar' CHECK (modo IN ('agregar', 'reemplazar')),
  ADD COLUMN estado         TEXT     NOT NULL DEFAULT 'completada'
                            CHECK (estado IN ('pendiente', 'procesando', 'completada', 'fallida')),
  ADD COLUMN archivo        BYTEA,                -- se borra al completar; se conserva si falla (para reintentar)
  ADD COLUMN intentos       SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN procesadas     INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN guardadas      INTEGER,
  ADD COLUMN eliminadas     INTEGER,
  ADD COLUMN omitidas       INTEGER,
  ADD COLUMN error          TEXT,
  ADD COLUMN error_detalle  JSONB,
  ADD COLUMN iniciado_en    TIMESTAMPTZ,
  ADD COLUMN latido_en      TIMESTAMPTZ,          -- el worker lo actualiza mientras procesa
  ADD COLUMN finalizado_en  TIMESTAMPTZ;

-- Las importaciones antiguas ya estaban completas; las nuevas parten pendientes.
ALTER TABLE importaciones ALTER COLUMN estado SET DEFAULT 'pendiente';

-- Estos datos se conocen recién cuando el worker lee el archivo.
ALTER TABLE importaciones
  ALTER COLUMN hoja        DROP NOT NULL,
  ALTER COLUMN total_filas DROP NOT NULL,
  ALTER COLUMN columnas    DROP NOT NULL,
  ALTER COLUMN datos       DROP NOT NULL;

UPDATE importaciones SET lista_id = (SELECT id FROM listas WHERE tipo = 'ingredientes' AND nombre = 'General')
WHERE tipo = 'ingredientes';

-- Índice parcial: el worker solo busca entre los trabajos activos.
CREATE INDEX idx_importaciones_cola  ON importaciones (creado_en) WHERE estado IN ('pendiente', 'procesando');
CREATE INDEX idx_importaciones_lista ON importaciones (lista_id, creado_en DESC);
