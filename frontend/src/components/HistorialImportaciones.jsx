import { formatoFecha } from '../utils.js';
import { EstadoBadge } from './EstadoImportacion.jsx';

const resultado = (h) => {
  if (h.estado === 'procesando') return h.total_filas ? `${h.procesadas} / ${h.total_filas}` : 'leyendo…';
  if (h.estado === 'fallida') return h.error;
  if (h.estado === 'completada') {
    return [
      `${h.guardadas ?? h.total_filas ?? 0} guardadas`,
      h.eliminadas ? `${h.eliminadas} eliminadas` : null,
      h.omitidas ? `${h.omitidas} omitidas` : null,
      h.total_avisos ? `${h.total_avisos} avisos` : null,
    ].filter(Boolean).join(' · ');
  }
  return '';
};

export default function HistorialImportaciones({ importaciones, onReintentar }) {
  if (!importaciones.length) return <div className="empty">Aún no se ha importado ningún archivo.</div>;
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Estado</th><th>Tipo</th><th>Lista</th><th>Modo</th>
            <th>Archivo</th><th>Resultado</th><th>Fecha</th><th />
          </tr>
        </thead>
        <tbody>
          {importaciones.map((h) => (
            <tr key={h.id}>
              <td className="num">{h.id}</td>
              <td><EstadoBadge estado={h.estado} /></td>
              <td>{h.tipo}</td>
              <td>{h.lista_nombre ?? (h.lista_id ? '' : '—')}</td>
              <td>{h.lista_id || h.tipo === 'ingredientes' ? h.modo : '—'}</td>
              <td>{h.nombre_archivo}</td>
              <td className="resultado">{resultado(h)}</td>
              <td>{formatoFecha(h.creado_en)}</td>
              <td>
                {h.estado === 'fallida' && h.conserva_archivo && (h.tipo !== 'ingredientes' || h.lista_id) && (
                  <button className="btn btn-sm" onClick={() => onReintentar(h.id)}>Reintentar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
