import { useRef, useState } from 'react';

export default function FileDrop({ onFile, accept = '.xlsx,.xls,.csv', archivo }) {
  const input = useRef(null);
  const [encima, setEncima] = useState(false);

  const elegir = (f) => f && onFile(f);

  return (
    <div
      className={`drop${encima ? ' over' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current.click())}
      onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => { e.preventDefault(); setEncima(false); elegir(e.dataTransfer.files[0]); }}
    >
      <strong>{archivo ? archivo.name : 'Arrastra el archivo aquí'}</strong>
      <br />
      {archivo ? 'Haz clic para elegir otro' : 'o haz clic para elegirlo'}
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => { elegir(e.target.files[0]); e.target.value = ''; }}
      />
    </div>
  );
}
