const FILLERS = /\b(uh-huh|um+|uh+|er|you know)\b/gi;
const CORRECTIONS = /\b(no,? wait|wait,? no|i mean)\b/gi;

export function countVoiceNoise(text: string) {
  return {
    fillers: (text.match(FILLERS) ?? []).length,
    corrections: (text.match(CORRECTIONS) ?? []).length,
  };
}
