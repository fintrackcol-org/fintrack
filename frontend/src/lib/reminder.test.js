import { describe, expect, it } from 'vitest';
import { DEFAULT_REMINDER, reminderSummary } from './reminder';

describe('reminderSummary (FT-0063)', () => {
  it('dice cuándo, a qué hora y por dónde', () => {
    expect(reminderSummary(DEFAULT_REMINDER)).toBe('Te avisamos 1 día antes, a tu hora de avisos, por notificación.');
    expect(reminderSummary({ daysBefore: [0, 7, 3], time: '07:30', channel: 'both' })).toBe(
      'Te avisamos 7 días antes, 3 días antes y el mismo día, a las 07:30, por notificación y WhatsApp.',
    );
  });

  it('sin días elegidos, avisa que no habrá aviso', () => {
    expect(reminderSummary({ daysBefore: [], time: null, channel: 'whatsapp' })).toBe('No te avisaremos.');
  });
});
