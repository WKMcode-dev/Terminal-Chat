import { useCallback, useEffect, useRef, useState } from "react";

import type { ServerEvent } from "@terminal-chat/protocol";

import type { RealtimeClient } from "../services/realtime";

export function useVoice(
  realtime: RealtimeClient | undefined,
  roomId: string | undefined,
) {
  const [joined, setJoined] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [deafened, setDeafenedState] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [testing, setTesting] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [error, setError] = useState<string>();
  const audioContext = useRef<AudioContext | undefined>(undefined);
  const mediaStream = useRef<MediaStream | undefined>(undefined);
  const processor = useRef<ScriptProcessorNode | undefined>(undefined);
  const source = useRef<MediaStreamAudioSourceNode | undefined>(undefined);
  const analyser = useRef<AnalyserNode | undefined>(undefined);
  const meterFrame = useRef<number | undefined>(undefined);
  const nextPlayback = useRef(0);
  const activeRoom = useRef<string | undefined>(undefined);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);

  const stopAudio = useCallback(() => {
    if (meterFrame.current) cancelAnimationFrame(meterFrame.current);
    processor.current?.disconnect();
    source.current?.disconnect();
    analyser.current?.disconnect();
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    void audioContext.current?.close();
    processor.current = undefined;
    source.current = undefined;
    analyser.current = undefined;
    meterFrame.current = undefined;
    mediaStream.current = undefined;
    audioContext.current = undefined;
    nextPlayback.current = 0;
  }, []);

  const stopTest = useCallback(() => {
    stopAudio();
    setTesting(false);
    setInputLevel(0);
  }, [stopAudio]);

  const leave = useCallback(() => {
    if (joined && activeRoom.current) {
      realtime?.send({
        type: "voice.leave",
        payload: { roomId: activeRoom.current },
      });
    }
    stopAudio();
    activeRoom.current = undefined;
    setJoined(false);
    setParticipants(0);
    setInputLevel(0);
  }, [joined, realtime, stopAudio]);

  const join = useCallback(
    async (requestedRoomId?: string) => {
      const activeRoomId = requestedRoomId ?? roomId;
      if (!realtime || !activeRoomId) return;
      try {
        stopTest();
        setError(undefined);
        const context = new AudioContext({ latencyHint: "interactive" });
        await context.resume();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const input = context.createMediaStreamSource(stream);
        const node = context.createScriptProcessor(
          2_048,
          input.channelCount || 1,
          1,
        );
        node.onaudioprocess = (event) => {
          const samples = event.inputBuffer.getChannelData(0);
          if (mutedRef.current) {
            setInputLevel(0);
            return;
          }
          const rms = Math.sqrt(
            samples.reduce((sum, sample) => sum + sample * sample, 0) /
              samples.length,
          );
          setInputLevel(Math.min(1, rms * 4));
          realtime.send({
            type: "voice.audio",
            payload: {
              roomId: activeRoomId,
              sampleRate: event.inputBuffer.sampleRate,
              samples: float32ToBase64(samples),
            },
          });
        };
        input.connect(node);
        node.connect(context.destination);
        audioContext.current = context;
        mediaStream.current = stream;
        source.current = input;
        processor.current = node;
        if (
          !realtime.send({
            type: "voice.join",
            payload: { roomId: activeRoomId },
          })
        ) {
          throw new Error("A conexão em tempo real ainda não está pronta");
        }
        activeRoom.current = activeRoomId;
        setJoined(true);
      } catch (reason) {
        stopAudio();
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível acessar o microfone",
        );
      }
    },
    [realtime, roomId, stopAudio, stopTest],
  );

  const startTest = useCallback(async () => {
    if (joined) {
      setError("Saia da chamada antes de testar o microfone");
      return;
    }
    try {
      stopAudio();
      setError(undefined);
      const context = new AudioContext({ latencyHint: "interactive" });
      await context.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const input = context.createMediaStreamSource(stream);
      const meter = context.createAnalyser();
      meter.fftSize = 256;
      meter.smoothingTimeConstant = 0.7;
      input.connect(meter);
      meter.connect(context.destination);

      audioContext.current = context;
      mediaStream.current = stream;
      source.current = input;
      analyser.current = meter;
      setTesting(true);

      const samples = new Float32Array(meter.fftSize);
      const measure = () => {
        meter.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, sample) => sum + sample * sample, 0) /
            samples.length,
        );
        setInputLevel(Math.min(1, rms * 4));
        meterFrame.current = requestAnimationFrame(measure);
      };
      measure();
    } catch (reason) {
      stopTest();
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível acessar o microfone",
      );
    }
  }, [joined, stopAudio, stopTest]);

  const toggleTest = useCallback(() => {
    if (testing) stopTest();
    else void startTest();
  }, [startTest, stopTest, testing]);

  const setMuted = useCallback((value: boolean) => {
    mutedRef.current = value;
    setMutedState(value);
    if (value) setInputLevel(0);
  }, []);
  const setDeafened = useCallback((value: boolean) => {
    deafenedRef.current = value;
    setDeafenedState(value);
  }, []);

  useEffect(() => {
    if (!realtime) return;
    return realtime.subscribe((event: ServerEvent) => {
      if (event.type === "voice.state" && event.payload.roomId === roomId) {
        setParticipants(event.payload.participantIds.length);
      }
      if (
        event.type === "voice.audio" &&
        event.payload.roomId === roomId &&
        !deafenedRef.current
      ) {
        playAudio(
          event.payload.samples,
          event.payload.sampleRate,
          audioContext.current,
          nextPlayback,
        );
      }
    });
  }, [realtime, roomId]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  useEffect(() => {
    if (joined && activeRoom.current && activeRoom.current !== roomId) leave();
  }, [joined, leave, roomId]);

  return {
    joined,
    muted,
    deafened,
    participants,
    testing,
    inputLevel,
    error,
    join,
    leave,
    setMuted,
    setDeafened,
    toggleTest,
  };
}

function float32ToBase64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.byteLength);
  bytes.set(
    new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength),
  );
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1)
    binary += String.fromCharCode(bytes[index]!);
  return btoa(binary);
}

function playAudio(
  encoded: string,
  sampleRate: number,
  context: AudioContext | undefined,
  nextPlayback: React.RefObject<number>,
): void {
  if (!context) return;
  const binary = atob(encoded);
  if (binary.length % 4 !== 0) return;
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  const samples = new Float32Array(bytes.buffer);
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  const start = Math.max(context.currentTime + 0.02, nextPlayback.current);
  source.start(start);
  nextPlayback.current = start + buffer.duration;
}
