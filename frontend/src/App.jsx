import { NavLink, Navigate, Route, Routes } from 'react-router';
import CargarExcel from './pages/CargarExcel.jsx';
import Inventario from './pages/Inventario.jsx';
import MenuSemanal from './pages/MenuSemanal.jsx';

const SECCIONES = [
  { ruta: '/cargar', nombre: 'Cargar Excel' },
  { ruta: '/inventario', nombre: 'Inventario' },
  { ruta: '/menu', nombre: 'Menú semanal' },
];

export default function App() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Minutas</span>
          <nav aria-label="Secciones">
            {SECCIONES.map((s) => (
              <NavLink key={s.ruta} to={s.ruta}>{s.nombre}</NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/cargar" replace />} />
          <Route path="/cargar" element={<CargarExcel />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/menu" element={<MenuSemanal />} />
          <Route path="*" element={<p className="empty">Página no encontrada.</p>} />
        </Routes>
      </main>
    </>
  );
}
