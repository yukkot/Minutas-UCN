import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import Mensaje from '../components/Mensaje.jsx';
import { DIAS, TIEMPOS } from '../constants.js';
import { kcal } from '../utils.js';

const clave = (dia, tiempo) => `${dia}-${tiempo}`;

// items del backend [{dia, tiempo, receta_id}] <-> objeto { "0-almuerzo": 3 }
const aMapa = (items) => Object.fromEntries(items.map((i) => [clave(i.dia, i.tiempo), i.receta_id]));
const aItems = (mapa, dias) =>
  Object.entries(mapa)
    .map(([k, receta_id]) => {
      const [dia, tiempo] = k.split('-');
      return { dia: Number(dia), tiempo, receta_id };
    })
    .filter((i) => i.dia < dias);

export default function MenuSemanal() {
  const [recetas, setRecetas] = useState([]);
  const [menus, setMenus] = useState([]);
  const [menu, setMenu] = useState(null); // { id, nombre, dias, asignaciones }
  const [cambios, setCambios] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [rec, lista] = await Promise.all([api.recetas.listar(), api.menus.listar()]);
        setRecetas(rec);
        setMenus(lista);
        if (lista.length) abrir(lista[0].id);
      } catch (e) {
        setMensaje({ error: true, texto: e.message });
      }
    })();
  }, []);

  const porId = useMemo(() => Object.fromEntries(recetas.map((r) => [r.id, r])), [recetas]);

  async function abrir(id) {
    const m = await api.menus.obtener(id);
    setMenu({ id: m.id, nombre: m.nombre, dias: m.dias, asignaciones: aMapa(m.items) });
    setCambios(false);
  }

  async function crear() {
    const m = await api.menus.crear({ nombre: `Menú ${new Date().toLocaleDateString('es-CL')}`, dias: 5 });
    setMenus((prev) => [m, ...prev]);
    setMenu({ id: m.id, nombre: m.nombre, dias: m.dias, asignaciones: {} });
  }

  async function guardar() {
    try {
      await api.menus.actualizar(menu.id, {
        nombre: menu.nombre,
        dias: menu.dias,
        items: aItems(menu.asignaciones, menu.dias),
      });
      setCambios(false);
      setMensaje({ texto: 'Menú guardado.' });
    } catch (e) {
      setMensaje({ error: true, texto: e.message, detalle: e.details });
    }
  }

  const editar = (parcial) => { setMenu((m) => ({ ...m, ...parcial })); setCambios(true); setMensaje(null); };

  function asignar(dia, tiempo, valor) {
    const asignaciones = { ...menu.asignaciones };
    if (valor === '') delete asignaciones[clave(dia, tiempo)];
    else asignaciones[clave(dia, tiempo)] = Number(valor);
    editar({ asignaciones });
  }

  function alAzar() {
    const asignaciones = {};
    for (let d = 0; d < menu.dias; d++) {
      for (const t of TIEMPOS) {
        const delTiempo = recetas.filter((r) => r.tipo === t.id);
        const pool = delTiempo.length ? delTiempo : recetas;
        asignaciones[clave(d, t.id)] = pool[Math.floor(Math.random() * pool.length)].id;
      }
    }
    editar({ asignaciones });
  }

  function totalDia(dia) {
    let suma = 0, asignados = 0, hayKcal = false;
    for (const t of TIEMPOS) {
      const r = porId[menu.asignaciones[clave(dia, t.id)]];
      if (!r) continue;
      asignados++;
      const k = kcal(r);
      if (k !== null) { suma += k; hayKcal = true; }
    }
    return { suma, asignados, hayKcal };
  }

  if (!recetas.length) {
    return (
      <section>
        <h1>Simular menú semanal</h1>
        <Mensaje mensaje={mensaje} />
        <div className="empty">Primero carga recetas desde “Cargar Excel” para armar el menú.</div>
      </section>
    );
  }

  return (
    <section>
      <h1>Simular menú semanal</h1>
      <p className="lead">
        Asigna una receta a cada tiempo de comida. Si las recetas tienen una columna de calorías, se suman por día.
      </p>

      <div className="row mb">
        <label>
          Menú{' '}
          <select value={menu?.id ?? ''} onChange={(e) => abrir(Number(e.target.value))} disabled={!menus.length}>
            {!menus.length && <option value="">Sin menús</option>}
            {menus.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>
        <button className="btn" onClick={crear}>Nuevo menú</button>
      </div>

      {!menu ? (
        <div className="empty">Crea un menú para empezar.</div>
      ) : (
        <>
          <div className="row mb">
            <label>
              Nombre{' '}
              <input type="text" value={menu.nombre} onChange={(e) => editar({ nombre: e.target.value })} />
            </label>
            <label>
              Días{' '}
              <select value={menu.dias} onChange={(e) => editar({ dias: Number(e.target.value) })}>
                <option value={5}>Lunes a viernes</option>
                <option value={7}>Semana completa</option>
              </select>
            </label>
            <button className="btn" onClick={alAzar}>Rellenar al azar</button>
            <button className="btn danger" onClick={() => editar({ asignaciones: {} })}>Vaciar</button>
            <button className="btn primary" onClick={guardar} disabled={!cambios}>
              {cambios ? 'Guardar menú' : 'Guardado'}
            </button>
          </div>
          <Mensaje mensaje={mensaje} />

          <div className="scroll">
            <div className="week" style={{ '--days': menu.dias }}>
              <div className="hd" />
              {DIAS.slice(0, menu.dias).map((d) => <div key={d} className="hd">{d}</div>)}

              {TIEMPOS.map((t) => (
                <Fila key={t.id} etiqueta={t.nombre}>
                  {DIAS.slice(0, menu.dias).map((d, i) => (
                    <div key={d}>
                      <select
                        aria-label={`${t.nombre} ${d}`}
                        value={menu.asignaciones[clave(i, t.id)] ?? ''}
                        onChange={(e) => asignar(i, t.id, e.target.value)}
                      >
                        <option value="">—</option>
                        {recetas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </select>
                    </div>
                  ))}
                </Fila>
              ))}

              <Fila etiqueta="Total">
                {DIAS.slice(0, menu.dias).map((d, i) => {
                  const { suma, asignados, hayKcal } = totalDia(i);
                  return (
                    <div key={d} className="tot">
                      {hayKcal && <><b>{Math.round(suma)} kcal</b><br /></>}
                      {asignados} de {TIEMPOS.length} tiempos
                    </div>
                  );
                })}
              </Fila>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Fila({ etiqueta, children }) {
  return (
    <>
      <div className="slot">{etiqueta}</div>
      {children}
    </>
  );
}
