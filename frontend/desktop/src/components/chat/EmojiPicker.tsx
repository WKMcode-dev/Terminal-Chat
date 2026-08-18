const EMOJIS = [
  "😀",
  "😄",
  "😂",
  "😊",
  "🥰",
  "😎",
  "🤔",
  "😭",
  "😡",
  "🦊",
  "🐉",
  "🐺",
  "👍",
  "👏",
  "🙏",
  "💪",
  "🔥",
  "✨",
  "💎",
  "🧡",
  "🎮",
  "🎙️",
  "🎧",
  "🚀",
] as const;

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
}

export function EmojiPicker({ onPick }: EmojiPickerProps) {
  return (
    <div className="emoji-picker" role="dialog" aria-label="Seletor de emojis">
      <header>
        <strong>Emojis</strong>
        <small>Win+. ou botão</small>
      </header>
      <div className="emoji-grid">
        {EMOJIS.map((emoji) => (
          <button
            aria-label={`Inserir ${emoji}`}
            key={emoji}
            onClick={() => onPick(emoji)}
            type="button"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
