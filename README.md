# Minutas

Sistema para cargar ingredientes y recetas desde Excel, revisar el inventario y simular un menú semanal.

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
│   │   ├── services/        # Lógica de negocio y consultas SQL
│   │   ├── middlewares/     # Subida de archivos, manejo de errores
│   │   ├── utils/
│   │   ├── app.js           # Configuración de Express
│   │   └── server.js        # Punto de entrada
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
│   └── ejemplos/            # Excel de prueba
└── docker-compose.yml       # db + backend + frontend
```

## Puesta en marcha

Requisito: Docker Desktop abierto. Desde la carpeta raíz del proyecto:

```powershell
docker compose up --build -d
```

Eso construye y levanta los tres contenedores:

| Servicio | URL | Qué hace |
|---|---|---|
| `frontend` | http://localhost:8080 | Nginx sirve la app compilada y reenvía `/api` al backend |
| `backend` | http://localhost:3000/api | Aplica las migraciones pendientes y levanta la API |
| `db` | localhost:5432 | PostgreSQL (usuario, clave y base: `minutas`) |

Luego entra a http://localhost:8080 y carga `docs/ejemplos/ingredientes.xlsx` y `docs/ejemplos/recetas.xlsx`.

Comandos útiles:

```powershell
docker compose ps                    # estado de los contenedores
docker compose logs -f backend       # ver logs del backend
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
Copy-Item .env.example .env   # solo la primera vez
npm install                   # solo cuando cambian dependencias
npm run migrate
npm run dev                   # http://localhost:3000/api
```

```powershell
# Terminal 2
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Si los contenedores `backend` y `frontend` están corriendo, detenlos antes para liberar el puerto 3000:
`docker compose stop backend frontend`.

## Flujo de un Excel

1. El frontend envía el archivo a `POST /api/importaciones/preview` y muestra las primeras filas.
2. Al confirmar, lo envía a `POST /api/importaciones` junto con el `tipo`.
3. El backend lo transforma a JSON (claves normalizadas), guarda el JSON completo en `importaciones.datos`
   y hace *upsert* de cada fila en `ingredientes` o `recetas`, todo en una transacción.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Verifica API y conexión a la BD |
| GET | `/api/importaciones` | Últimas 50 importaciones |
| GET | `/api/importaciones/:id` | Una importación con su JSON completo |
| POST | `/api/importaciones/preview` | Lee el Excel sin guardar (`archivo`) |
| POST | `/api/importaciones` | Importa y guarda (`archivo`, `tipo`) |
| GET | `/api/ingredientes?q=` | Lista y busca ingredientes |
| GET | `/api/recetas?q=` | Lista y busca recetas |
| GET / POST | `/api/menus` | Lista o crea menús |
| GET / PUT / DELETE | `/api/menus/:id` | Obtiene, reemplaza o elimina un menú |

## Base de datos

- `importaciones`: historial de archivos y su JSON transformado (`JSONB`).
- `ingredientes`, `recetas`: `nombre` único + `atributos` (`JSONB`) con el resto de las columnas.
- `menus`, `menu_items`: menú semanal (día 0–6 × tiempo de comida → receta).

Para cambiar el esquema, crea un archivo nuevo en `backend/src/db/migrations/`
(ej. `002_columnas_nutricion.sql`) y ejecuta `npm run migrate`. No edites migraciones ya aplicadas.

## Próximos pasos

- Definir el formato oficial de los Excel (`docs/formato-excel.md`) y validar columnas al importar.
- Pasar los valores nutricionales de `atributos` a columnas propias.
- Relacionar recetas con ingredientes (`receta_ingredientes` con cantidades) para calcular la nutrición real.
- Descontar stock según el menú planificado.
