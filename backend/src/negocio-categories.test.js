import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import { parseCategory, parseNewMovement } from './validators/negocio-movements.validator.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Categorías propias de cada negocio (FT-0058).

test('validación: nombre de 1 a 30 caracteres; el movimiento acepta claves propias "c_"', () => {
  assert.deepEqual(parseCategory({ name: '  Empaques   y bolsas ' }), { name: 'Empaques y bolsas' });
  assert.throws(() => parseCategory({ name: ' ' }), /Datos inválidos/);
  assert.equal(
    parseNewMovement({ kind: 'cost', amount: 1, description: 'x', category: 'c_ab12cd34' }).category,
    'c_ab12cd34',
  );
  assert.throws(() => parseNewMovement({ kind: 'cost', amount: 1, description: 'x', category: 'inventada' }));
});

const { rows } = await pool.query("SELECT to_regclass('public.negocio_categorias') AS tabla");
const options = { skip: !rows[0].tabla && 'Esquema no aplicado: falta la tabla negocio_categorias' };
const TEST_DOMAIN = '@negocio-categorias-test.fintrack.test';

after(async () => {
  if (!options.skip) {
    await pool.query(
      `DELETE FROM negocios WHERE id IN (
         SELECT s.negocio_id FROM negocio_socios s JOIN usuarios u ON u.id = s.usuario_id
         WHERE u.email LIKE $1)`,
      [`%${TEST_DOMAIN}`],
    );
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

async function withApi(fn) {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (url, { method = 'GET', token, body } = {}) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  try {
    await fn(api);
  } finally {
    server.close();
  }
}

async function newUser() {
  const session = await createVerifiedSession({ email: `u-${randomUUID()}${TEST_DOMAIN}`, password: 'clave-segura-1' });
  return { token: session.accessToken, id: session.user.id };
}

test('crear, usar y borrar una categoría propia', options, async () => {
  await withApi(async (api) => {
    const [owner, reader, other] = await Promise.all([newUser(), newUser(), newUser()]);
    const created = await api('/businesses', { method: 'POST', token: owner.token, body: { name: 'Arepas' } });
    const id = created.body.id;
    await pool.query("INSERT INTO negocio_socios (negocio_id, usuario_id, rol) VALUES ($1, $2, 'lector')", [id, reader.id]);
    const otherBusiness = await api('/businesses', { method: 'POST', token: other.token, body: { name: 'Otro' } });

    const categories = `/businesses/${id}/categories`;
    assert.equal((await api(categories, { method: 'POST', token: reader.token, body: { name: 'Empaques' } })).status, 403);
    const cat = await api(categories, { method: 'POST', token: owner.token, body: { name: 'Empaques' } });
    assert.equal(cat.status, 201);
    assert.match(cat.body.key, /^c_[a-z0-9]{8}$/);

    // No se repite el nombre, ni el de una de siempre (sin importar tildes ni mayúsculas).
    for (const name of ['empaques', 'NOMINA']) {
      const dup = await api(categories, { method: 'POST', token: owner.token, body: { name } });
      assert.equal(dup.status, 422, name);
    }

    // Un movimiento con la categoría propia sale con su nombre; la de otro negocio no sirve.
    const movements = `/businesses/${id}/movements`;
    const sale = await api(movements, {
      method: 'POST',
      token: owner.token,
      body: { kind: 'cost', amount: 5000, description: 'Bolsas', category: cat.body.key },
    });
    assert.equal(sale.status, 201);
    assert.equal(sale.body.categoryName, 'Empaques');
    const foreign = await api(`/businesses/${otherBusiness.body.id}/categories`, {
      method: 'POST',
      token: other.token,
      body: { name: 'Ajena' },
    });
    const wrong = await api(movements, {
      method: 'POST',
      token: owner.token,
      body: { kind: 'cost', amount: 1, description: 'x', category: foreign.body.key },
    });
    assert.equal(wrong.status, 422);

    const month = await api(movements, { token: reader.token });
    assert.deepEqual(month.body.customCategories, [{ key: cat.body.key, name: 'Empaques' }]);

    // Al borrarla, sus movimientos pasan a "otros".
    assert.equal((await api(`${categories}/${cat.body.key}`, { method: 'DELETE', token: owner.token })).status, 204);
    const after = await api(movements, { token: owner.token });
    const moved = after.body.movements.find((m) => m.id === sale.body.id);
    assert.equal(moved.category, 'otros');
    assert.equal(moved.categoryName, null);
    assert.deepEqual(after.body.customCategories, []);
    assert.equal((await api(`${categories}/${cat.body.key}`, { method: 'DELETE', token: owner.token })).status, 404);
  });
});
