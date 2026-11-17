/**
 * Crea un usuario de prueba con el correo ya confirmado y devuelve su sesión, para los scripts que
 * corren contra el backend local (`lighthouse.mjs`, `sync-cases.mjs`, `offline-cases.mjs`).
 *
 * Desde FT-0016 el registro no da sesión hasta abrir el enlace del correo. Aquí se marca el correo
 * como confirmado directo en la base del contenedor `db` de docker compose (estos scripts ya exigen
 * `docker compose up -d`) y luego se inicia sesión. Usa 2 intentos del límite de login/registro.
 * Los correos deben ser `@….test`: el backend nunca envía correos a ese dominio reservado.
 */
import { execFileSync } from 'node:child_process';

/**
 * @param {string} api URL base de la API, con `/api/v1`.
 * @param {{ email: string, password: string }} credentials El correo lo genera el script, no un usuario.
 * @returns {Promise<{ user: { id: string, email: string }, accessToken: string, refreshToken: string }>}
 */
export async function createVerifiedSession(api, { email, password }) {
  const post = async (path, extra = {}) => {
    const res = await fetch(api + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`${path} respondió ${res.status}: ${JSON.stringify(json)}`);
    return json;
  };

  // Desde FT-0017 el registro exige aceptar los términos.
  await post('/auth/register', { acceptTerms: true });
  // El correo va como variable de psql (:'email'), no pegado en el SQL. psql solo reemplaza
  // variables en lo que lee por la entrada estándar (con -c no), por eso el SQL va en `input`.
  // Con DATABASE_URL se usa un psql local (sin docker compose).
  const input = "UPDATE usuarios SET email_verificado_at = now() WHERE email = :'email';";
  const stdio = ['pipe', 'ignore', 'inherit'];
  if (process.env.DATABASE_URL) {
    execFileSync('psql', [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-v', `email=${email}`], { input, stdio });
  } else {
    execFileSync(
      'docker',
      [
        'compose', 'exec', '-T', 'db', 'sh', '-c',
        'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q -v email="$1"',
        'psql', email,
      ],
      { input, stdio },
    );
  }
  return post('/auth/login');
}
