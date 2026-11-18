import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import path from 'node:path';
import { env } from '../config/env.js';

/**
 * Dónde viven los archivos de los soportes de pago (FT-0044). Hay tres formas con las mismas tres
 * operaciones; el resto del código no sabe cuál se usa:
 * - Disco: en desarrollo, en `backend/uploads/` (ignorado por git).
 * - Supabase Storage: en producción, en un espacio privado. Render borra su disco en cada
 *   despliegue, así que allá nunca se usa el disco.
 * - Amazon S3: en el entorno de pruebas en AWS (FT-0064), en un bucket privado.
 *
 * @typedef {object} AttachmentStorage
 * @property {'disco'|'supabase'|'s3'} kind Cuál es.
 * @property {(key: string, data: Buffer, contentType: string) => Promise<void>} save Guarda un archivo.
 * @property {(key: string) => Promise<Buffer>} read Lee un archivo.
 * @property {(keys: string[]) => Promise<void>} remove No falla si alguno ya no existe.
 */

/**
 * @param {string} dir Carpeta base.
 * @returns {AttachmentStorage}
 */
export function createDiskStorage(dir) {
  // `key` la arma el servicio (usuario/uuid.ext), nunca viene del usuario: no puede salir de `dir`.
  const fileOf = (key) => path.join(dir, ...key.split('/'));
  return {
    kind: 'disco',
    async save(key, data) {
      await mkdir(path.dirname(fileOf(key)), { recursive: true });
      await writeFile(fileOf(key), data);
    },
    read: (key) => readFile(fileOf(key)),
    async remove(keys) {
      await Promise.all(keys.map((key) => rm(fileOf(key), { force: true })));
    },
  };
}

/**
 * Espacio privado de Supabase Storage por su API REST, con la clave `service_role` (solo en el
 * backend). El frontend nunca habla con Supabase: los archivos pasan siempre por la API.
 * @param {{ url: string, key: string, bucket: string, fetchImpl?: typeof fetch }} config
 * @returns {AttachmentStorage}
 */
export function createSupabaseStorage({ url, key, bucket, fetchImpl = fetch }) {
  const headers = { Authorization: `Bearer ${key}`, apikey: key };
  const objectUrl = (objectKey) => `${url}/storage/v1/object/${bucket}/${objectKey}`;
  const check = async (res, action) => {
    if (!res.ok) throw new Error(`Supabase Storage respondió ${res.status} al ${action}`);
    return res;
  };
  return {
    kind: 'supabase',
    async save(objectKey, data, contentType) {
      await check(
        await fetchImpl(objectUrl(objectKey), {
          method: 'POST',
          headers: { ...headers, 'Content-Type': contentType, 'x-upsert': 'false' },
          body: data,
        }),
        'guardar',
      );
    },
    async read(objectKey) {
      const res = await check(await fetchImpl(objectUrl(objectKey), { headers }), 'leer');
      return Buffer.from(await res.arrayBuffer());
    },
    async remove(keys) {
      if (keys.length === 0) return;
      await check(
        await fetchImpl(`${url}/storage/v1/object/${bucket}`, {
          method: 'DELETE',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: keys }),
        }),
        'borrar',
      );
    },
  };
}

/**
 * Bucket privado de Amazon S3 (entorno de pruebas en AWS, FT-0064). Las credenciales no van en
 * la configuración: el SDK las toma del rol de la instancia EC2 (o de las variables `AWS_*`).
 * @param {{ bucket: string, region: string, client?: { send: (command: object) => Promise<any> } }} config
 * @returns {AttachmentStorage}
 */
export function createS3Storage({ bucket, region, client = new S3Client({ region }) }) {
  return {
    kind: 's3',
    async save(key, data, contentType) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }));
    },
    async read(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return Buffer.from(await res.Body.transformToByteArray());
    },
    async remove(keys) {
      if (keys.length === 0) return;
      await client.send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }),
      );
    },
  };
}

/**
 * Elige el almacenamiento según la configuración: S3 si hay `S3_BUCKET`, si no Supabase, y en
 * desarrollo el disco. En producción sin ninguno devuelve `null`: los soportes quedan apagados en
 * vez de guardarse en un disco que se borra.
 * @param {typeof env} [config]
 * @returns {AttachmentStorage|null}
 */
export function selectStorage(config = env) {
  if (config.s3Bucket) return createS3Storage({ bucket: config.s3Bucket, region: config.awsRegion });
  if (config.supabaseUrl && config.supabaseServiceKey) {
    return createSupabaseStorage({
      url: config.supabaseUrl,
      key: config.supabaseServiceKey,
      bucket: config.attachmentsBucket,
    });
  }
  if (config.nodeEnv === 'production') return null;
  return createDiskStorage(path.resolve(config.uploadsDir));
}
