import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, estaActiva } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import FileDrop from '../components/FileDrop.jsx';
import Mensaje from '../components/Mensaje.jsx';
import HistorialImportaciones from '../components/HistorialImportaciones.jsx';
import { ProgresoImportacion } from '../components/EstadoImportacion.jsx';
import { useSondeo } from '../hooks/useSondeo.js';

const TIPOS = [
  { id: 'ingredientes', nombre: 'Ingredientes' },
  { id: 'recetas', nombre: 'Recetas' },
];

const MODOS = [
  { id: 'reemplazar', nombre: 'Reemplazar contenido', ayuda: 'La lista queda igual al Excel: se eliminan los alimentos que no vengan en el archivo.' },
  { id: 'agregar', nombre: 'Agregar y actualizar', ayuda: 'Agrega los alimentos nuevos y actualiza los existentes (por código). No elimina nada.' },
];

const AYUDA_GENERICA = 'Primera hoja, fila 1 como encabezados y una columna "nombre" o "receta".';

/** Texto de ayuda armado desde la definición del formato que entrega el backend. */
function ayudaFormato(formato) {
  if (!formato) return AYUDA_GENERICA;
  const { filas, columnas } = formato;
  const obligatorios = columnas.filter((c) => c.obligatorio).map((c) => `${c.etiqueta} (${c.columna})`);
  return `${formato.descripcion} v${formato.version}: fila ${filas.numeracion} numerada del 1 al ${columnas.length}, `
    + `datos desde la fila ${filas.datos}. Obligatorios: ${obligatorios.join(', ')}.`;
}

const tablaAvisos = (avisos) =>
  avisos.map((a) => ({ Fila: a.fila, Columna: a.columna ?? '', Detalle: a.mensaje }));

function Segmentado({ nombre, opciones, valor, onChange, deshabilitadas = [] }) {
  return (
    <div className="seg" role="radiogroup">
      {opciones.map((o) => (
        <label key={o.id} className={deshabilitadas.includes(o.id) ? 'disabled' : undefined}>
          <input
            type="radio" name={nombre} value={o.id} checked={valor === o.id}
            disabled={deshabilitadas.includes(o.id)} onChange={() => onChange(o.id)}
          />
          <span>{o.nombre}</span>
        </label>
      ))}
    </div>
  );
}

export default function CargarExcel() {
  const [params] = useSearchParams();
  const listaDeUrl = params.get('lista') ?? '';

  const [tipo, setTipo] = useState('ingredientes');
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [formatos, setFormatos] = useState({});

  // Destino (solo ingredientes)
  const [listas, setListas] = useState([]);
  const [destino, setDestino] = useState(listaDeUrl ? 'existente' : 'nueva');
  const [listaId, setListaId] = useState(listaDeUrl);
  const [listaNombre, setListaNombre] = useState('');
  const [modo, setModo] = useState('reemplazar');

  const [historial, setHistorial] = useState([]);
  const [seguimiento, setSeguimiento] = useState(null); // importación recién encolada

  const cargarHistorial = useCallback(() => api.importaciones.listar({ limite: 20 }).then(setHistorial).catch(() => {}), []);
  const cargarListas = useCallback(() => api.listas.listar('ingredientes').then(setListas).catch(() => {}), []);

  useEffect(() => {
    cargarHistorial();
    cargarListas();
    api.importaciones.formatos().then(setFormatos).catch(() => setFormatos({}));
  }, [cargarHistorial, cargarListas]);

  // Si se elige "lista existente" sin lista seleccionada, se toma la primera
  useEffect(() => {
    if (destino === 'existente' && !listaId && listas.length) setListaId(String(listas[0].id));
  }, [destino, listaId, listas]);

  // Vista previa (síncrona, no guarda): se recalcula al cambiar archivo o tipo
  useEffect(() => {
    if (!archivo) return undefined;
    let vigente = true;
    setPreview(null);
    setMensaje(null);
    setLeyendo(true);
    api.importaciones.previsualizar(archivo, tipo)
      .then((p) => vigente && setPreview(p))
      .catch((e) => vigente && setMensaje({ error: true, texto: e.message, detalle: e.details }))
      .finally(() => vigente && setLeyendo(false));
    return () => { vigente = false; };
  }, [archivo, tipo]);

  // Sondeo del trabajo en curso y del historial mientras haya importaciones activas
  useSondeo(async () => {
    const t = await api.importaciones.obtener(seguimiento.id);
    setSeguimiento(t);
    if (!estaActiva(t)) { cargarHistorial(); cargarListas(); }
  }, 1000, estaActiva(seguimiento));
  useSondeo(cargarHistorial, 2000, historial.some(estaActiva));

  const listaSeleccionada = listas.find((l) => String(l.id) === String(listaId));
  const destinoValido = tipo !== 'ingredientes'
    || (destino === 'nueva' ? listaNombre.trim().length > 0 : Boolean(listaSeleccionada));

  async function importar() {
    setEnviando(true);
    setMensaje(null);
    try {
      const datosDestino = tipo !== 'ingredientes' ? {}
        : destino === 'nueva' ? { lista_nombre: listaNombre.trim() } : { lista_id: listaId, modo };
      const trabajo = await api.importaciones.importar(archivo, tipo, datosDestino);
      setSeguimiento(trabajo);
      setArchivo(null);
      setPreview(null);
      if (destino === 'nueva' && trabajo.lista_id) {
        // La lista recién creada queda seleccionada para la próxima carga
        setDestino('existente');
        setListaId(String(trabajo.lista_id));
        setListaNombre('');
      }
      cargarHistorial();
      cargarListas();
    } catch (e) {
      setMensaje({ error: true, texto: e.message, detalle: e.details });
    } finally {
      setEnviando(false);
    }
  }

  async function reintentar(id) {
    try {
      setSeguimiento(await api.importaciones.reintentar(id));
      cargarHistorial();
    } catch (e) {
      setMensaje({ error: true, texto: e.message });
    }
  }

  return (
    <section>
      <h1>Cargar Excel</h1>
      <p className="lead">
        El archivo se valida al instante y se procesa en segundo plano: puedes seguir usando la aplicación mientras tanto.
      </p>

      <div className="panel">
        <div className="row mb">
          <span>Tipo de datos:</span>
          <Segmentado nombre="tipo" opciones={TIPOS} valor={tipo} onChange={setTipo} />
        </div>
        <p className="hint">{ayudaFormato(formatos[tipo])}</p>

        {tipo === 'ingredientes' && (
          <fieldset className="destino">
            <legend>Lista de destino</legend>
            <div className="row mb">
              <Segmentado
                nombre="destino"
                opciones={[{ id: 'nueva', nombre: 'Nueva lista' }, { id: 'existente', nombre: 'Lista existente' }]}
                valor={destino}
                onChange={setDestino}
                deshabilitadas={listas.length ? [] : ['existente']}
              />
            </div>

            {destino === 'nueva' ? (
              <label className="campo">
                Nombre de la lista
                <input
                  type="text" maxLength={120} value={listaNombre} placeholder="Ej: Tabla TCA 2018"
                  onChange={(e) => setListaNombre(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="campo">
                  Lista
                  <select value={listaId} onChange={(e) => setListaId(e.target.value)}>
                    {listas.map((l) => (
                      <option key={l.id} value={l.id}>{l.nombre} · {l.total_items} alimentos</option>
                    ))}
                  </select>
                </label>
                <div className="modos">
                  {MODOS.map((m) => (
                    <label key={m.id} className="modo">
                      <input type="radio" name="modo" value={m.id} checked={modo === m.id} onChange={() => setModo(m.id)} />
                      <span><strong>{m.nombre}</strong><br /><span className="hint">{m.ayuda}</span></span>
                    </label>
                  ))}
                </div>
                {listaSeleccionada?.importaciones_activas > 0 && (
                  <p className="hint">
                    Esta lista tiene {listaSeleccionada.importaciones_activas} importación(es) en curso;
                    la nueva se procesará cuando terminen.
                  </p>
                )}
              </>
            )}
          </fieldset>
        )}

        <FileDrop onFile={setArchivo} archivo={archivo} />
        <Mensaje mensaje={mensaje} />

        {leyendo && <p className="hint mt">Leyendo el archivo…</p>}
        {preview && (
          <>
            <h2>
              Vista previa{' '}
              <span className="count">
                hoja “{preview.hoja}”: {preview.total_filas} filas válidas
                {preview.omitidas ? `, ${preview.omitidas} omitidas` : ''} (se muestran 10)
              </span>
            </h2>
            <DataTable filas={preview.filas} />

            {preview.total_avisos > 0 && (
              <>
                <h2>
                  Avisos <span className="count">({preview.total_avisos}
                  {preview.total_avisos > preview.avisos.length ? `, se muestran ${preview.avisos.length}` : ''})</span>
                </h2>
                <DataTable filas={tablaAvisos(preview.avisos)} />
              </>
            )}
          </>
        )}

        <div className="row mt">
          <button className="btn primary" disabled={!preview || leyendo || enviando || !destinoValido} onClick={importar}>
            {enviando ? 'Enviando…' : 'Importar'}
          </button>
          {preview && !destinoValido && <span className="hint">Indica el nombre de la lista o elige una existente.</span>}
        </div>

        {seguimiento && <ProgresoImportacion importacion={seguimiento} onReintentar={reintentar} />}
      </div>

      <h2>Últimas importaciones</h2>
      <HistorialImportaciones importaciones={historial} onReintentar={reintentar} />
    </section>
  );
}
