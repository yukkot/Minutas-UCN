const esNumero = (v) => typeof v === 'number';

/** Tabla genérica: las columnas salen de las claves de las filas. */
export default function DataTable({ filas, vacio = 'Sin datos todavía.' }) {
  if (!filas?.length) return <div className="empty">{vacio}</div>;
  const columnas = [...new Set(filas.flatMap(Object.keys))];

  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>{columnas.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {columnas.map((c) => (
                <td key={c} className={esNumero(fila[c]) ? 'num' : undefined}>{fila[c] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
