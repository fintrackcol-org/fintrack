import { describe, expect, it, vi } from 'vitest';
import { attachedText } from '@/lib/attachedText';
import { uploadPending } from '@/services/attachmentService';

describe('attachedText', () => {
  it('no dice nada si no se eligió ningún soporte', () => {
    expect(attachedText(null)).toBe('');
  });

  it('cuenta los que se subieron', () => {
    expect(attachedText({ uploaded: 1, failed: [] })).toBe('1 soporte adjunto.');
    expect(attachedText({ uploaded: 3, failed: [] })).toBe('3 soportes adjuntos.');
  });

  it('avisa los que fallaron y dónde adjuntarlos', () => {
    expect(attachedText({ uploaded: 0, failed: ['factura.jpg'] })).toBe(
      'No se subió "factura.jpg": adjúntalo desde el detalle del movimiento.',
    );
    expect(attachedText({ uploaded: 1, failed: ['a.pdf', 'b.jpg'] })).toMatch(/^1 soporte adjunto\. No se subieron 2 soportes/);
  });
});

describe('uploadPending', () => {
  it('sube cada archivo al movimiento y sigue aunque uno falle', async () => {
    const upload = vi.fn(async (_id, _blob, name) => {
      if (name === 'malo.pdf') throw new Error('falló');
    });
    const files = [
      { blob: new Blob(['a']), name: 'factura.jpg' },
      { blob: new Blob(['b']), name: 'malo.pdf' },
      { blob: new Blob(['c']), name: 'recibo.png' },
    ];
    const result = await uploadPending('tx-1', files, upload);
    expect(upload).toHaveBeenCalledTimes(3);
    expect(upload).toHaveBeenNthCalledWith(1, 'tx-1', files[0].blob, 'factura.jpg');
    expect(result).toEqual({ uploaded: 2, failed: ['malo.pdf'] });
  });
});
