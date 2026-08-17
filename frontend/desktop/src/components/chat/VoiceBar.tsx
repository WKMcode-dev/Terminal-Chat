import {
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
} from "lucide-react";

interface VoiceBarProps {
  joined: boolean;
  muted: boolean;
  deafened: boolean;
  participants: number;
  testing: boolean;
  inputLevel: number;
  error?: string;
  onJoin: () => void;
  onLeave: () => void;
  onMute: (value: boolean) => void;
  onDeafen: (value: boolean) => void;
  onTest: () => void;
}

export function VoiceBar(props: VoiceBarProps) {
  return (
    <div
      className={
        props.joined
          ? "voice-bar joined"
          : props.testing
            ? "voice-bar testing"
            : "voice-bar"
      }
    >
      <div>
        <span className="voice-icon">
          <Headphones size={17} />
        </span>
        <span>
          <strong>
            {props.testing
              ? "Teste de microfone"
              : props.joined
                ? "Voz conectada"
                : "Sala de voz"}
          </strong>
          <small>
            {props.error ??
              (props.testing
                ? "Você deve escutar a própria voz"
                : `${props.participants} participantes`)}
          </small>
        </span>
        {(props.testing || props.joined) && (
          <span className="voice-meter" aria-label="Nível do microfone">
            <span style={{ width: `${Math.round(props.inputLevel * 100)}%` }} />
          </span>
        )}
      </div>
      <div className="voice-actions">
        {props.joined && (
          <>
            <button
              className={props.muted ? "icon-button danger" : "icon-button"}
              onClick={() => props.onMute(!props.muted)}
              title="Microfone"
              type="button"
            >
              {props.muted ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
            <button
              className={props.deafened ? "icon-button danger" : "icon-button"}
              onClick={() => props.onDeafen(!props.deafened)}
              title="Áudio"
              type="button"
            >
              {props.deafened ? (
                <HeadphoneOff size={17} />
              ) : (
                <Headphones size={17} />
              )}
            </button>
          </>
        )}
        {!props.joined && (
          <button
            className={props.testing ? "voice-test active" : "voice-test"}
            onClick={props.onTest}
            title="Escutar o próprio microfone"
            type="button"
          >
            {props.testing ? <MicOff size={17} /> : <Mic size={17} />}
            {props.testing ? "Parar teste" : "Testar mic"}
          </button>
        )}
        <button
          className={props.joined ? "voice-call danger" : "voice-call"}
          disabled={props.testing}
          onClick={props.joined ? props.onLeave : props.onJoin}
          type="button"
        >
          {props.joined ? <PhoneOff size={17} /> : <Phone size={17} />}
          {props.joined ? "Sair" : "Entrar"}
        </button>
      </div>
    </div>
  );
}
