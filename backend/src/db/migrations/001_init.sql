-- Historial de cada Excel cargado. "datos" guarda el JSON transformado completo,
-- así se puede reprocesar o auditar aunque cambie la estructura de las tablas.
CREATE TABLE importaciones (
  id              SERIAL PRIMARY KEY,
  tipo            TEXT        NOT NULL CHECK (tipo IN ('ingredientes', 'recetas')),
  nombre_archivo  TEXT        NOT NULL,
  hoja            TEXT        NOT NULL,
  total_filas     INTEGER     NOT NULL,
  columnas        TEXT[]      NOT NULL,
  datos           JSONB       NOT NULL,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mientras no esté definida la estructura del Excel, todo lo que no es "nombre"
-- queda en "atributos" (JSONB). Cuando se fije, se pasan a columnas propias.
CREATE TABLE ingredientes (
  id              SERIAL PRIMARY KEY,
  nombre          TEXT        NOT NULL UNIQUE,
  atributos       JSONB       NOT NULL DEFAULT '{}',
  importacion_id  INTEGER     REFERENCES importaciones(id) ON DELETE SET NULL,
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recetas (
  id              SERIAL PRIMARY KEY,
  nombre          TEXT        NOT NULL UNIQUE,
  tipo            TEXT,
  atributos       JSONB       NOT NULL DEFAULT '{}',
  importacion_id  INTEGER     REFERENCES importaciones(id) ON DELETE SET NULL,
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menus (
  id              SERIAL PRIMARY KEY,
  nombre          TEXT        NOT NULL,
  dias            SMALLINT    NOT NULL DEFAULT 5 CHECK (dias IN (5, 7)),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
  menu_id    INTEGER  NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  dia        SMALLINT NOT NULL CHECK (dia BETWEEN 0 AND 6),
  tiempo     TEXT     NOT NULL CHECK (tiempo IN ('desayuno', 'almuerzo', 'once', 'cena')),
  receta_id  INTEGER  NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_id, dia, tiempo)
);

CREATE INDEX idx_ingredientes_atributos ON ingredientes USING GIN (atributos);
CREATE INDEX idx_recetas_atributos      ON recetas      USING GIN (atributos);
CREATE INDEX idx_importaciones_tipo     ON importaciones (tipo, creado_en DESC);
