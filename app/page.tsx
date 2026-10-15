export default function Page() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 20 }}>
      <h1>AI Portfolio Factory</h1>
      <p>
        Controlador del agente autónomo. Las interacciones ocurren por Telegram y
        GitHub; esta página solo confirma que el despliegue está vivo.
      </p>
      <ul>
        <li>
          <a href="/api/health">/api/health</a>
        </li>
      </ul>
    </main>
  );
}
