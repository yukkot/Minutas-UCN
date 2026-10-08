const ETIQUETAS = {
  pendiente: 'En cola',
  procesando: 'Procesando',
  completada: 'Completada',
  fallida: 'Fallida',
};

export function EstadoBadge({ estado }) {
  return <span className={`badge badge-${estado}`}>{ETIQUETAS[estado] ?? estado}</span>;
}

/** Tarjeta con el avance de una importación (se actualiza por sondeo desde la página). */
export function ProgresoImportacion({ importacion, onReintentar }) {
  const { estado, total_filas: total, procesadas = 0 } = importacion;
  const porcentaje = total ? Math.round((procesadas / total) * 100) : 0;

  return (
    <div className="progreso" role="status" aria-live="polite">
      <div className="row">
        <strong>Importación #{importacion.id}</strong>
        <EstadoBadge estado={estado} />
        <span className="count">
          {importacion.nombre_archivo}
          {importacion.lista_nombre && ` → lista “${importacion.lista_nombre}” (${importacion.modo})`}
        </span>
      </div>

      {estado === 'pendiente' && <p className="hint">Esperando a que un worker la tome…</p>}

      {estado === 'procesando' && (
        <>
          <div className="barra" aria-label={`Avance ${porcentaje}%`}>
            <div style={{ width: `${total ? porcentaje : 5}%` }} />
          </div>
          <p className="hint">{total ? `${procesadas} de ${total} filas (${porcentaje}%)` : 'Leyendo el archivo…'}</p>
        </>
      )}

      {estado === 'completada' && (
        <p>
          {importacion.guardadas} filas guardadas
          {importacion.eliminadas ? `, ${importacion.eliminadas} eliminadas de la lista` : ''}
          {importacion.omitidas ? `, ${importacion.omitidas} omitidas` : ''}
          {importacion.total_avisos ? ` · ${importacion.total_avisos} avisos` : ''}.
        </p>
      )}

      {estado === 'fallida' && (
        <>
          <p className="msg err">{importacion.error}</p>
          {importacion.error_detalle && <pre className="detalle">{JSON.stringify(importacion.error_detalle, null, 2)}</pre>}
          {importacion.conserva_archivo && (importacion.tipo !== 'ingredientes' || importacion.lista_id) && onReintentar && (
            <button className="btn" onClick={() => onReintentar(importacion.id)}>Reintentar</button>
          )}
        </>
      )}
    </div>
  );
}
