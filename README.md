# Minutas

Sistema para cargar ingredientes y recetas desde Excel, organizarlos en listas, revisar el inventario y simular un menú semanal.
Las importaciones se procesan de forma **asíncrona** con workers escalables.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + React Router |
| Backend | Node.js 20+ + Express 5 |
| Base de datos | PostgreSQL 16 |
| Contenedores | Docker Compose (Nginx para el frontend) |
| Lectura de Excel | SheetJS (en el backend) |

## Estructura

```
minutas/
├── backend/
│   ├── src/
│   │   ├── config/          # Variables de entorno
│   │   ├── db/
│   │   │   ├── migrations/  # Esquema SQL versionado (001_init.sql, 002_...)
│   │   │   ├── migrate.js   # Aplica migraciones pendientes
│   │   │   └── pool.js      # Conexión y transacciones
│   │   ├── routes/          # Definición de endpoints
│   │   ├── controllers/     # Leen la request y responden
│   │   ├── jobs/            # Worker de importaciones (cola en PostgreSQL)
│   │   ├── formatos/        # Motor genérico + definiciones de formatos de Excel (alimentos)
│   │   ├── services/        # Lógica de negocio y consultas SQL
│   │   ├── middlewares/     # Subida de archivos, manejo de errores
│   │   ├── utils/
│   │   ├── app.js           # Configuración de Express
│   │   ├── server.js        # Punto de entrada de la API
│   │   └── worker.js        # Punto de entrada del worker
│   ├── test/                # Pruebas automatizadas (npm test)
│   ├── requests.http        # Pruebas rápidas de la API desde VS Code
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/             # Cliente HTTP hacia el backend
│   │   ├── components/      # Tabla, zona de carga, mensajes
│   │   ├── pages/           # CargarExcel, Inventario, MenuSemanal
│   │   └── styles/
│   ├── Dockerfile           # Compila con Vite y sirve con Nginx
│   └── nginx.conf           # Sirve la app y reenvía /api al backend
├── docs/
│   ├── formato-excel.md     # Estructura esperada de los Excel (por definir)
│   └── ejemplos/            # Excel de prueba con datos ficticios
├── datos/                   # Tus Excel reales (ignorada por git, créala si la necesitas)
├── scripts/                 # configurar.ps1 / configurar.sh: crean los .env en un PC nuevo
├── .env.example             # Plantilla de credenciales para Docker (.env no se sube)
├── .gitattributes           # Finales de línea iguales en Windows, macOS y Linux
└── docker-compose.yml       # db + backend + worker + frontend
```

## Puesta en marcha

Funciona igual en Windows, macOS y Linux. Requisitos: **Docker Desktop** abierto (y **Git** para clonar).
Node.js 20+ solo hace falta para el modo desarrollo.

Desde la carpeta raíz del proyecto:

```powershell
# 1. Solo la primera vez en cada PC: crea .env y backend/.env con una clave aleatoria
powershell -ExecutionPolicy Bypass -File scripts\configurar.ps1     # Windows
sh scripts/configurar.sh                                              # macOS / Linux

# 2. Construir y levantar
docker compose up --build -d
```

El `.env` tiene la clave de la base de datos y **no se sube a GitHub**; cada PC genera la suya.
También puedes crearlo a mano copiando `.env.example` como `.env`. Si en ese PC los puertos `8080` o `5432`
ya están ocupados, cámbialos en el `.env` (`FRONTEND_PORT`, `POSTGRES_PORT`) antes de levantar.

Postgres solo toma la clave la primera vez que crea su volumen de datos: si cambias la clave de una base
que ya existe, sigue los pasos de [Cambiar la clave de la base de datos](#cambiar-la-clave-de-la-base-de-datos).

Eso construye y levanta cuatro contenedores:

| Servicio | URL | Qué hace |
|---|---|---|
| `frontend` | http://localhost:8080 | Nginx sirve la app compilada y reenvía `/api` al backend |
| `backend` | http://localhost:8080/api | Aplica las migraciones, recibe los Excel y los deja en cola |
| `worker` | — | Procesa las importaciones en segundo plano (escalable) |
| `db` | localhost:5432 | PostgreSQL (credenciales del `.env`; solo accesible desde tu PC) |

Luego entra a http://localhost:8080 y carga `docs/ejemplos/ingredientes.xlsx` y `docs/ejemplos/recetas.xlsx`.

Comandos útiles:

```powershell
docker compose ps                    # estado de los contenedores
docker compose logs -f backend       # ver logs del backend
docker compose logs -f worker        # ver qué está procesando el worker
docker compose up -d --scale worker=3   # 3 workers en paralelo
docker compose up --build -d         # reconstruir después de cambiar código
docker compose down                  # detener (los datos se conservan)
docker compose down -v               # detener y BORRAR la base de datos
```

### Modo desarrollo (recarga automática al guardar)

Para programar es más cómodo dejar solo la base de datos en Docker y correr el resto con npm.
Cada uno en su propia terminal (en PowerShell 5 no se puede usar `&&`):

```powershell
# Terminal 1
docker compose up -d db
cd backend
# backend/.env lo crea scripts/configurar (paso 1 de arriba)
npm install                   # solo cuando cambian dependencias
npm run migrate
npm run dev                   # http://localhost:3000/api (incluye el worker)
```

```powershell
# Terminal 2
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

En desarrollo la API también procesa las importaciones (`EJECUTAR_WORKER=true`), así que no hace falta
una tercera terminal. Si quieres probar el worker por separado: `EJECUTAR_WORKER=false` en `.env` y
`npm run dev:worker` en otra terminal.

El backend en Docker no ocupa el puerto 3000 de tu PC, así que ambos modos pueden convivir.
Si aparece "port is already allocated", revisa qué proceso lo usa con `netstat -ano | findstr :3000`.

### Cambiar la clave de la base de datos

Si la base ya existe, cambiar `POSTGRES_PASSWORD` en el `.env` no basta: hay que cambiarla también dentro de Postgres.

```powershell
# 1. Con la clave ACTUAL todavía en el .env:
docker compose exec db psql -U minutas -d minutas -c "ALTER USER minutas WITH PASSWORD 'NuevaClave123';"
# 2. Pon la clave nueva en .env (raíz) y en backend/.env (DATABASE_URL)
# 3. Recrea los servicios para que tomen la clave nueva:
docker compose up -d
```

## Pruebas

```powershell
cd backend
npm test
```

Prueban el lector del formato de alimentos con el Excel de ejemplo (datos ficticios) y con casos borde. No necesitan base de datos.

## Importación asíncrona y listas

```
Frontend                    API (backend)                         Worker(s)
   │  POST /preview  ───────►  lee y valida, responde al instante
   │  POST /importaciones ──►  guarda el archivo, estado "pendiente"
   │  ◄──── 202 + id          (responde sin esperar el procesamiento)
   │                                                        toma el trabajo (SKIP LOCKED)
   │  GET /importaciones/:id ◄──── estado + avance ◄─────── lee, valida y guarda por lotes
   │  (sondeo cada 1 s)                                    "completada" o "fallida"
```

- **Estados:** `pendiente` → `procesando` → `completada` | `fallida`.
- **Atomicidad:** todo lo que modifica datos ocurre en una transacción. Si algo falla, la lista queda como estaba.
- **Escalable:** varios workers toman trabajos distintos sin pisarse (`FOR UPDATE SKIP LOCKED`). Listas distintas
  se procesan en paralelo; las importaciones de una misma lista, en orden de llegada (gana el último Excel subido).
- **Tolerante a fallos:** el worker marca un "latido" mientras procesa. Si se cae, otro retoma el trabajo tras
  `WORKER_TIMEOUT_MIN` minutos (hasta `WORKER_MAX_INTENTOS`). Los errores del archivo no se reintentan.
- **Guardado por lotes** de `WORKER_TAMANO_LOTE` filas con `jsonb_to_recordset`, en vez de fila por fila.

**Listas de ingredientes:** cada Excel de alimentos va a una lista, así distintas tablas no se mezclan
(el mismo código puede existir en dos listas). Al importar se elige:

| Destino | Modo | Resultado |
|---|---|---|
| Lista nueva | — | Se crea la lista con el contenido del Excel |
| Lista existente | `reemplazar` | La lista queda **igual al Excel**: se eliminan los alimentos que no vengan |
| Lista existente | `agregar` | Agrega nuevos y actualiza existentes (por código), sin eliminar |

Eliminar una lista borra todos sus ingredientes. Las recetas aún no usan listas.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Verifica API y conexión a la BD |
| GET | `/api/listas?tipo=ingredientes` | Listas con su cantidad de ingredientes e importaciones en curso |
| POST | `/api/listas` | Crea una lista vacía (`nombre`, `descripcion`) |
| GET / PATCH / DELETE | `/api/listas/:id` | Obtiene, renombra o elimina una lista (con sus ingredientes) |
| GET | `/api/importaciones/formatos` | Definición de cada formato: columnas, tipos, unidades y obligatorios |
| POST | `/api/importaciones/preview` | Lee y valida el Excel sin guardar (`archivo`, `tipo`) |
| POST | `/api/importaciones` | **Encola** el Excel y responde `202` (`archivo`, `tipo`, y `lista_nombre` o `lista_id` + `modo`) |
| GET | `/api/importaciones?lista_id=&limite=` | Historial de importaciones |
| GET | `/api/importaciones/:id` | Estado y avance (`?datos=true` incluye el JSON transformado) |
| POST | `/api/importaciones/:id/reintentar` | Vuelve a encolar una importación fallida |
| GET | `/api/ingredientes?lista_id=&q=&pagina=&por_pagina=` | Ingredientes paginados: `{ total, pagina, por_pagina, items }` |
| GET | `/api/ingredientes/nutrientes` | Catálogo de nutrientes: clave, nombre, unidad y si es obligatorio |
| GET | `/api/recetas?q=` | Lista y busca recetas |
| GET / POST | `/api/menus` | Lista o crea menús |
| GET / PUT / DELETE | `/api/menus/:id` | Obtiene, reemplaza o elimina un menú |

Ejemplos listos para ejecutar en `backend/requests.http`.

## Base de datos

- `listas`: grupos de ingredientes (`nombre` único por tipo).
- `importaciones`: cola de trabajos e historial: estado, avance, archivo (mientras se procesa), formato usado
  (`alimentos@1`), JSON transformado y avisos.
- `ingredientes`: pertenece a una lista; `codigo` único **dentro de la lista**, `nombre`, `fuente`, `porcion_g`
  y `nutrientes` (`JSONB`). Ver `docs/formato-excel.md`.
- `recetas`: `nombre` único + `atributos` (`JSONB`) con el resto de las columnas.
- `menus`, `menu_items`: menú semanal (día 0–6 × tiempo de comida → receta).

Para cambiar el esquema, crea un archivo nuevo en `backend/src/db/migrations/`
(ej. `002_columnas_nutricion.sql`) y ejecuta `npm run migrate`. No edites migraciones ya aplicadas.

## Próximos pasos

- Definir el formato oficial del Excel de recetas.
- Relacionar recetas con ingredientes (`receta_ingredientes` con cantidades) para calcular la nutrición real.
- Descontar stock según el menú planificado.
