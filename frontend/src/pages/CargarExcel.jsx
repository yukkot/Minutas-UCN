import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import FileDrop from '../components/FileDrop.jsx';
import Mensaje from '../components/Mensaje.jsx';
import { formatoFecha } from '../utils.js';

const TIPOS = [
  { id: 'ingredientes', nombre: 'Ingredientes' },
  { id: 'recetas', nombre: 'Recetas' },
];

export default function CargarExcel() {
  const [tipo, setTipo] = useState('ingredientes');
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [historial, setHistorial] = useState([]);

  const cargarHistorial = () =>
    api.importaciones.listar().then(setHistorial).catch(() => setHistorial([]));

  useEffect(() => { cargarHistorial(); }, []);

  async function elegirArchivo(f) {
    setArchivo(f);
    setPreview(null);
    setMensaje(null);
    setOcupado(true);
    try {
      setPreview(await api.importaciones.previsualizar(f));
    } catch (e) {
      setMensaje({ error: true, texto: e.message, detalle: e.details });
    } finally {
      setOcupado(false);
    }
  }

  async function importar() {
    setOcupado(true);
    try {
      const r = await api.importaciones.importar(archivo, tipo);
      setMensaje({ texto: `Importación #${r.importacion_id}: ${r.guardadas} ${tipo} guardados${r.omitidas ? `, ${r.omitidas} filas sin nombre omitidas` : ''}.` });
      setArchivo(null);
      setPreview(null);
      cargarHistorial();
    } catch (e) {
      setMensaje({ error: true, texto: e.message, detalle: e.details });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section>
      <h1>Cargar Excel</h1>
      <p className="lead">
        Sube un .xlsx, .xls o .csv. Se lee la primera hoja, se transforma a JSON y se guarda en la base de datos.
      </p>

      <div className="panel">
        <div className="row mb">
          <span>Tipo de datos:</span>
          <div className="seg" role="radiogroup" aria-label="Tipo de datos">
            {TIPOS.map((t) => (
              <label key={t.id}>
                <input type="radio" name="tipo" value={t.id} checked={tipo === t.id} onChange={() => setTipo(t.id)} />
                <span>{t.nombre}</span>
              </label>
            ))}
          </div>
        </div>

        <FileDrop onFile={elegirArchivo} archivo={archivo} />
        <Mensaje mensaje={mensaje} />

        {preview && (
          <>
            <h2>
              Vista previa <span className="count">hoja “{preview.hoja}”, {preview.total_filas} filas (se muestran 10)</span>
            </h2>
            <DataTable filas={preview.filas} />
          </>
        )}

        <div className="row mt">
          <button className="btn primary" disabled={!preview || ocupado} onClick={importar}>
            {ocupado ? 'Procesando…' : 'Importar'}
          </button>
        </div>
      </div>

      <h2>Últimas importaciones</h2>
      <DataTable
        vacio="Aún no se ha importado ningún archivo."
        filas={historial.map((h) => ({
          '#': h.id,
          tipo: h.tipo,
          archivo: h.nombre_archivo,
          hoja: h.hoja,
          filas: h.total_filas,
          fecha: formatoFecha(h.creado_en),
        }))}
      />
    </section>
  );
}
