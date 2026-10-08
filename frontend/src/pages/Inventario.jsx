import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import Mensaje from '../components/Mensaje.jsx';
import { useSondeo } from '../hooks/useSondeo.js';
import { aplanar, formatoFecha } from '../utils.js';

const POR_PAGINA = 50;
const encabezado = (n) => (n.unidad ? `${n.etiqueta} (${n.unidad})` : n.etiqueta);

/** Fila de ingrediente para la tabla, con los nutrientes en el orden del Excel. */
const filaIngrediente = (nutrientes, mostrarLista) => (i) => ({
  ...(mostrarLista ? { Lista: i.lista_nombre } : {}),
  Código: i.codigo,
  Nombre: i.nombre,
  Fuente: i.fuente,
  'Porción (g)': Number(i.porcion_g),
  ...Object.fromEntries(nutrientes.map((n) => [encabezado(n), i.nutrientes?.[n.clave] ?? null])),
});

export default function Inventario() {
  const [params, setParams] = useSearchParams();
  const listaId = params.get('lista') ?? '';

  const [listas, setListas] = useState([]);
  const [nutrientes, setNutrientes] = useState([]);
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState(''); // búsqueda aplicada (con retardo)
  const [pagina, setPagina] = useState(1);
  const [ingredientes, setIngredientes] = useState({ total: 0, items: [] });
  const [recetas, setRecetas] = useState([]);
  const [mensaje, setMensaje] = useState(null);

  const cargarListas = useCallback(() => api.listas.listar('ingredientes').then(setListas).catch(() => {}), []);

  const cargarIngredientes = useCallback(async () => {
    try {
      setIngredientes(await api.ingredientes.listar({ lista_id: listaId, q, pagina, por_pagina: POR_PAGINA }));
    } catch (e) {
      setMensaje({ error: true, texto: `No se pudo cargar el inventario: ${e.message}` });
    }
  }, [listaId, q, pagina]);

  useEffect(() => {
    cargarListas();
    api.ingredientes.nutrientes().then(setNutrientes).catch(() => setNutrientes([]));
  }, [cargarListas]);

  // Búsqueda: espera 300 ms después de la última tecla
  useEffect(() => {
    const t = setTimeout(() => { setQ(texto.trim()); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => { cargarIngredientes(); }, [cargarIngredientes]);
  useEffect(() => { api.recetas.listar(q).then(setRecetas).catch(() => setRecetas([])); }, [q]);

  const listaSel = listas.find((l) => String(l.id) === listaId);

  // Si la lista tiene importaciones en curso, se refresca sola hasta que terminen
  useSondeo(async () => { await cargarListas(); await cargarIngredientes(); }, 2000, listaSel?.importaciones_activas > 0);

  function elegirLista(id) {
    setPagina(1);
    setMensaje(null);
    setParams(id ? { lista: id } : {});
  }

  async function renombrar(lista) {
    const nombre = window.prompt('Nuevo nombre de la lista', lista.nombre);
    if (!nombre || nombre.trim() === lista.nombre) return;
    try {
      await api.listas.actualizar(lista.id, { nombre: nombre.trim() });
      await cargarListas();
      await cargarIngredientes();
      setMensaje({ texto: 'Lista renombrada.' });
    } catch (e) {
      setMensaje({ error: true, texto: e.message });
    }
  }

  async function eliminar(lista) {
    const enCurso = lista.importaciones_activas
      ? `\n\nTiene ${lista.importaciones_activas} importación(es) en curso: se cancelarán.` : '';
    const ok = window.confirm(
      `¿Eliminar la lista “${lista.nombre}” y sus ${lista.total_items} alimentos? Esta acción no se puede deshacer.${enCurso}`,
    );
    if (!ok) return;
    try {
      const r = await api.listas.eliminar(lista.id);
      elegirLista('');
      await cargarListas();
      await cargarIngredientes();
      setMensaje({ texto: `Lista “${r.nombre}” eliminada (${r.ingredientes_eliminados} alimentos).` });
    } catch (e) {
      setMensaje({ error: true, texto: e.message });
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(ingredientes.total / POR_PAGINA));
  const vacio = q ? 'Sin resultados para esa búsqueda.' : 'Sin datos todavía. Cárgalos desde “Cargar Excel”.';

  return (
    <section>
      <h1>Inventario</h1>
      <p className="lead">Ingredientes organizados por listas, con su información nutricional por porción, y recetas disponibles.</p>

      <div className="row mb">
        <label>
          Lista{' '}
          <select value={listaId} onChange={(e) => elegirLista(e.target.value)}>
            <option value="">Todas las listas</option>
            {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre} ({l.total_items})</option>)}
          </select>
        </label>
        <input
          type="search" className="search" placeholder="Buscar por nombre, código o fuente"
          value={texto} onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      {listaSel && (
        <div className="panel lista-info mb">
          <div>
            <strong>{listaSel.nombre}</strong>
            <span className="count"> · {listaSel.total_items} alimentos · actualizada {formatoFecha(listaSel.actualizado_en)}</span>
            {listaSel.importaciones_activas > 0 && (
              <span className="badge badge-procesando">{listaSel.importaciones_activas} importación(es) en curso</span>
            )}
          </div>
          <div className="row">
            <Link className="btn" to={`/cargar?lista=${listaSel.id}`}>Actualizar con Excel</Link>
            <button className="btn" onClick={() => renombrar(listaSel)}>Renombrar</button>
            <button className="btn danger" onClick={() => eliminar(listaSel)}>Eliminar lista</button>
          </div>
        </div>
      )}
      <Mensaje mensaje={mensaje} />

      {!listaId && (
        <>
          <h2>Listas <span className="count">({listas.length})</span></h2>
          {listas.length ? (
            <div className="scroll">
              <table>
                <thead>
                  <tr><th>Nombre</th><th>Alimentos</th><th>Actualizada</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {listas.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.nombre}
                        {l.importaciones_activas > 0 && <span className="badge badge-procesando">en curso</span>}
                      </td>
                      <td className="num">{l.total_items}</td>
                      <td>{formatoFecha(l.actualizado_en)}</td>
                      <td>
                        <div className="acciones">
                          <button className="btn btn-sm" onClick={() => elegirLista(String(l.id))}>Ver</button>
                          <Link className="btn btn-sm" to={`/cargar?lista=${l.id}`}>Actualizar con Excel</Link>
                          <button className="btn btn-sm" onClick={() => renombrar(l)}>Renombrar</button>
                          <button className="btn btn-sm danger" onClick={() => eliminar(l)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">Aún no hay listas. Se crean al importar un Excel de ingredientes.</div>
          )}
        </>
      )}

      <h2>Ingredientes <span className="count">({ingredientes.total})</span></h2>
      <DataTable filas={ingredientes.items.map(filaIngrediente(nutrientes, !listaId))} vacio={vacio} />
      {ingredientes.total > POR_PAGINA && (
        <div className="row mt pager">
          <button className="btn" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
          <span>Página {pagina} de {totalPaginas}</span>
          <button className="btn" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
        </div>
      )}

      <h2>Recetas <span className="count">({recetas.length})</span></h2>
      <DataTable filas={recetas.map(aplanar)} vacio={vacio} />
    </section>
  );
}