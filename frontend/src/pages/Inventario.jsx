import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import DataTable from '../components/DataTable.jsx';
import Mensaje from '../components/Mensaje.jsx';
import { aplanar } from '../utils.js';

export default function Inventario() {
  const [q, setQ] = useState('');
  const [ingredientes, setIngredientes] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Espera 300 ms después de la última tecla antes de consultar.
    const t = setTimeout(async () => {
      try {
        const [ing, rec] = await Promise.all([api.ingredientes.listar(q), api.recetas.listar(q)]);
        setIngredientes(ing);
        setRecetas(rec);
        setError(null);
      } catch (e) {
        setError({ error: true, texto: `No se pudo cargar el inventario: ${e.message}` });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const vacio = q ? 'Sin resultados para esa búsqueda.' : 'Sin datos todavía. Cárgalos desde “Cargar Excel”.';

  return (
    <section>
      <h1>Inventario</h1>
      <p className="lead">Ingredientes con su información nutricional y recetas disponibles.</p>
      <input
        type="search"
        className="search"
        placeholder="Buscar en ingredientes y recetas"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Mensaje mensaje={error} />

      <h2>Ingredientes <span className="count">({ingredientes.length})</span></h2>
      <DataTable filas={ingredientes.map(aplanar)} vacio={vacio} />

      <h2>Recetas <span className="count">({recetas.length})</span></h2>
      <DataTable filas={recetas.map(aplanar)} vacio={vacio} />
    </section>
  );
}
