export default function Mensaje({ mensaje }) {
  if (!mensaje) return null;
  return (
    <div className={`msg${mensaje.error ? ' err' : ''}`} role="status">
      {mensaje.texto}
      {mensaje.detalle && <pre className="detalle">{JSON.stringify(mensaje.detalle, null, 2)}</pre>}
    </div>
  );
}
