import { describe, expect, it } from 'vitest';
import { feedbackLengthError, screenFeedback } from '../../supabase/functions/send-feedback/screen';

describe('feedback screening', () => {
  it('sends ordinary suggestions about the app', () => {
    expect(screenFeedback('Idea para los cromos', 'Estaría bien poder intercambiar cromos repetidos con mis primos.')).toEqual({
      verdict: 'ok',
      reasons: [],
    });
  });

  it('refuses code and injection attempts', () => {
    expect(screenFeedback('Hola', '<script>alert(1)</script> en la app').verdict).toBe('reject');
    expect(screenFeedback("x'; DROP TABLE people; --", 'la app').verdict).toBe('reject');
    expect(screenFeedback('Fallo', 'pulsa <img src=x onerror=alert(1)> en el álbum').verdict).toBe('reject');
  });

  it('flags messages worth a look', () => {
    const spam = screenFeedback('Gana dinero', 'Compra criptomonedas baratas en www.ejemplo-falso.test');
    expect(spam.verdict).toBe('review');
    expect(spam.reasons).toEqual(expect.arrayContaining(['incluye enlaces', 'no parece hablar de la app']));
    expect(screenFeedback('Mi cuenta', 'No puedo entrar en la app, mi contraseña es secreta123').reasons).toContain(
      'menciona datos sensibles',
    );
  });

  it('checks lengths', () => {
    expect(feedbackLengthError('Hi', 'mensaje suficientemente largo')).toMatch(/asunto/);
    expect(feedbackLengthError('Asunto correcto', 'corto')).toMatch(/mensaje/);
    expect(feedbackLengthError('Asunto correcto', 'Este mensaje tiene la longitud adecuada')).toBeNull();
  });
});
