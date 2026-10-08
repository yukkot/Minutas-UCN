-- Ingredientes según el "formato de alimentos" (tabla de composición).
-- Se recrea la tabla: hasta ahora solo tenía datos de prueba y ninguna otra tabla la referencia.
DROP TABLE IF EXISTS ingredientes;

CREATE TABLE ingredientes (
  id              SERIAL PRIMARY KEY,
  codigo          INTEGER     NOT NULL UNIQUE,          -- columna A (CODIGO)
  nombre          TEXT        NOT NULL,                 -- columna C
  fuente          TEXT,                                 -- columna B (Tabla comp), ej. "TCA - 2018"
  porcion_g       NUMERIC     NOT NULL DEFAULT 100,     -- columna D (Cantidad gramos)
  nutrientes      JSONB       NOT NULL DEFAULT '{}',    -- columnas E a AN, claves en src/formatos/alimentos.js
  importacion_id  INTEGER     REFERENCES importaciones(id) ON DELETE SET NULL,
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingredientes_nombre     ON ingredientes (lower(nombre));
CREATE INDEX idx_ingredientes_nutrientes ON ingredientes USING GIN (nutrientes);
