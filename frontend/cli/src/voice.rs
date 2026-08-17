use std::{
    collections::VecDeque,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU32, Ordering},
    },
};

use anyhow::{Context, Result, anyhow};
use base64::{Engine, engine::general_purpose::STANDARD};
use cpal::{
    Device, SampleFormat, Stream, StreamConfig,
    traits::{DeviceTrait, HostTrait, StreamTrait},
};
use tokio::sync::mpsc::UnboundedSender;

use crate::protocol::ClientEvent;

pub struct VoiceEngine {
    input: Option<Stream>,
    output: Option<Stream>,
    playback: Arc<Mutex<VecDeque<f32>>>,
    muted: Arc<AtomicBool>,
    deafened: Arc<AtomicBool>,
    input_level: Arc<AtomicU32>,
    output_sample_rate: u32,
}

impl Default for VoiceEngine {
    fn default() -> Self {
        Self {
            input: None,
            output: None,
            playback: Arc::new(Mutex::new(VecDeque::new())),
            muted: Arc::new(AtomicBool::new(false)),
            deafened: Arc::new(AtomicBool::new(false)),
            input_level: Arc::new(AtomicU32::new(0.0_f32.to_bits())),
            output_sample_rate: 48_000,
        }
    }
}

impl VoiceEngine {
    pub fn start(
        &mut self,
        room_id: String,
        sender: UnboundedSender<ClientEvent>,
    ) -> Result<()> {
        self.stop();
        let host = cpal::default_host();
        let input_device = host.default_input_device().context("nenhum microfone foi encontrado")?;
        let output_device = host.default_output_device().context("nenhuma saída de áudio foi encontrada")?;
        let input_supported = input_device.default_input_config()?;
        let output_supported = output_device.default_output_config()?;
        let input_format = input_supported.sample_format();
        let output_format = output_supported.sample_format();
        let input_config: StreamConfig = input_supported.into();
        let output_config: StreamConfig = output_supported.into();
        self.output_sample_rate = output_config.sample_rate;

        let input = build_input(
            &input_device,
            &input_config,
            input_format,
            room_id,
            sender,
            Arc::clone(&self.muted),
            Arc::clone(&self.input_level),
        )?;
        let output = build_output(
            &output_device,
            &output_config,
            output_format,
            Arc::clone(&self.playback),
            Arc::clone(&self.deafened),
        )?;
        input.play()?;
        output.play()?;
        self.input = Some(input);
        self.output = Some(output);
        Ok(())
    }

    pub fn start_test(&mut self) -> Result<()> {
        self.stop();
        let host = cpal::default_host();
        let input_device = host
            .default_input_device()
            .context("nenhum microfone foi encontrado")?;
        let output_device = host
            .default_output_device()
            .context("nenhuma saída de áudio foi encontrada")?;
        let input_supported = input_device.default_input_config()?;
        let output_supported = output_device.default_output_config()?;
        let input_format = input_supported.sample_format();
        let output_format = output_supported.sample_format();
        let input_config: StreamConfig = input_supported.into();
        let output_config: StreamConfig = output_supported.into();
        self.output_sample_rate = output_config.sample_rate;

        let input = build_monitor_input(
            &input_device,
            &input_config,
            input_format,
            self.output_sample_rate,
            Arc::clone(&self.playback),
            Arc::clone(&self.input_level),
        )?;
        let output = build_output(
            &output_device,
            &output_config,
            output_format,
            Arc::clone(&self.playback),
            Arc::new(AtomicBool::new(false)),
        )?;
        input.play()?;
        output.play()?;
        self.input = Some(input);
        self.output = Some(output);
        Ok(())
    }

    pub fn stop(&mut self) {
        self.input = None;
        self.output = None;
        if let Ok(mut playback) = self.playback.lock() {
            playback.clear();
        }
        self.input_level.store(0.0_f32.to_bits(), Ordering::Relaxed);
    }

    pub fn set_muted(&self, muted: bool) {
        self.muted.store(muted, Ordering::Relaxed);
    }

    pub fn set_deafened(&self, deafened: bool) {
        self.deafened.store(deafened, Ordering::Relaxed);
    }

    pub fn microphone_level(&self) -> f32 {
        f32::from_bits(self.input_level.load(Ordering::Relaxed))
    }

    pub fn queue_base64(&self, samples: &str, source_sample_rate: u32) -> Result<()> {
        let bytes = STANDARD.decode(samples).context("áudio recebido em formato inválido")?;
        if bytes.len() % 4 != 0 {
            return Err(anyhow!("o bloco de áudio não contém amostras f32 completas"));
        }
        let source = bytes
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect::<Vec<_>>();
        let samples = resample(&source, source_sample_rate, self.output_sample_rate);
        if let Ok(mut playback) = self.playback.lock() {
            let maximum = self.output_sample_rate as usize * 2;
            if playback.len() + samples.len() > maximum {
                let overflow = playback.len() + samples.len() - maximum;
                let remove = overflow.min(playback.len());
                playback.drain(..remove);
            }
            playback.extend(samples);
        }
        Ok(())
    }
}

fn build_input(
    device: &Device,
    config: &StreamConfig,
    format: SampleFormat,
    room_id: String,
    sender: UnboundedSender<ClientEvent>,
    muted: Arc<AtomicBool>,
    input_level: Arc<AtomicU32>,
) -> Result<Stream> {
    let channels = config.channels as usize;
    let sample_rate = config.sample_rate;
    let error = |_error| {};
    let stream = match format {
        SampleFormat::F32 => device.build_input_stream(
            *config,
            move |data: &[f32], _| {
                publish_input(
                    data,
                    channels,
                    sample_rate,
                    &room_id,
                    &sender,
                    &muted,
                    &input_level,
                )
            },
            error,
            None,
        )?,
        SampleFormat::I16 => device.build_input_stream(
            *config,
            move |data: &[i16], _| {
                let converted = data.iter().map(|sample| *sample as f32 / 32_768.0).collect::<Vec<_>>();
                publish_input(
                    &converted,
                    channels,
                    sample_rate,
                    &room_id,
                    &sender,
                    &muted,
                    &input_level,
                )
            },
            error,
            None,
        )?,
        SampleFormat::U16 => device.build_input_stream(
            *config,
            move |data: &[u16], _| {
                let converted = data
                    .iter()
                    .map(|sample| (*sample as f32 / 65_535.0) * 2.0 - 1.0)
                    .collect::<Vec<_>>();
                publish_input(
                    &converted,
                    channels,
                    sample_rate,
                    &room_id,
                    &sender,
                    &muted,
                    &input_level,
                )
            },
            error,
            None,
        )?,
        _ => return Err(anyhow!("formato do microfone não suportado: {format:?}")),
    };
    Ok(stream)
}

fn publish_input(
    input: &[f32],
    channels: usize,
    sample_rate: u32,
    room_id: &str,
    sender: &UnboundedSender<ClientEvent>,
    muted: &AtomicBool,
    input_level: &AtomicU32,
) {
    if muted.load(Ordering::Relaxed) || channels == 0 {
        input_level.store(0.0_f32.to_bits(), Ordering::Relaxed);
        return;
    }
    let mono = input
        .chunks(channels)
        .map(|frame| frame.iter().copied().sum::<f32>() / frame.len() as f32)
        .collect::<Vec<_>>();
    update_input_level(&mono, input_level);
    let mut bytes = Vec::with_capacity(mono.len() * 4);
    for sample in mono {
        bytes.extend_from_slice(&sample.clamp(-1.0, 1.0).to_le_bytes());
    }
    let _ = sender.send(ClientEvent::VoiceAudio {
        room_id: room_id.to_owned(),
        sample_rate,
        samples: STANDARD.encode(bytes),
    });
}

fn build_monitor_input(
    device: &Device,
    config: &StreamConfig,
    format: SampleFormat,
    output_sample_rate: u32,
    playback: Arc<Mutex<VecDeque<f32>>>,
    input_level: Arc<AtomicU32>,
) -> Result<Stream> {
    let channels = config.channels as usize;
    let input_sample_rate = config.sample_rate;
    let error = |_error| {};
    let stream = match format {
        SampleFormat::F32 => device.build_input_stream(
            *config,
            move |data: &[f32], _| {
                publish_monitor(
                    data,
                    channels,
                    input_sample_rate,
                    output_sample_rate,
                    &playback,
                    &input_level,
                )
            },
            error,
            None,
        )?,
        SampleFormat::I16 => device.build_input_stream(
            *config,
            move |data: &[i16], _| {
                let converted = data
                    .iter()
                    .map(|sample| *sample as f32 / 32_768.0)
                    .collect::<Vec<_>>();
                publish_monitor(
                    &converted,
                    channels,
                    input_sample_rate,
                    output_sample_rate,
                    &playback,
                    &input_level,
                )
            },
            error,
            None,
        )?,
        SampleFormat::U16 => device.build_input_stream(
            *config,
            move |data: &[u16], _| {
                let converted = data
                    .iter()
                    .map(|sample| (*sample as f32 / 65_535.0) * 2.0 - 1.0)
                    .collect::<Vec<_>>();
                publish_monitor(
                    &converted,
                    channels,
                    input_sample_rate,
                    output_sample_rate,
                    &playback,
                    &input_level,
                )
            },
            error,
            None,
        )?,
        _ => return Err(anyhow!("formato do microfone não suportado: {format:?}")),
    };
    Ok(stream)
}

fn publish_monitor(
    input: &[f32],
    channels: usize,
    input_sample_rate: u32,
    output_sample_rate: u32,
    playback: &Mutex<VecDeque<f32>>,
    input_level: &AtomicU32,
) {
    if channels == 0 {
        return;
    }
    let mono = input
        .chunks(channels)
        .map(|frame| frame.iter().copied().sum::<f32>() / frame.len() as f32)
        .collect::<Vec<_>>();
    update_input_level(&mono, input_level);
    let samples = resample(&mono, input_sample_rate, output_sample_rate);
    if let Ok(mut queue) = playback.lock() {
        let maximum = output_sample_rate as usize;
        if queue.len() + samples.len() > maximum {
            let overflow = queue.len() + samples.len() - maximum;
            let remove = overflow.min(queue.len());
            queue.drain(..remove);
        }
        queue.extend(samples);
    }
}

fn update_input_level(samples: &[f32], input_level: &AtomicU32) {
    let level = if samples.is_empty() {
        0.0
    } else {
        let mean_square = samples
            .iter()
            .map(|sample| sample.clamp(-1.0, 1.0).powi(2))
            .sum::<f32>()
            / samples.len() as f32;
        (mean_square.sqrt() * 4.0).clamp(0.0, 1.0)
    };
    input_level.store(level.to_bits(), Ordering::Relaxed);
}

fn build_output(
    device: &Device,
    config: &StreamConfig,
    format: SampleFormat,
    playback: Arc<Mutex<VecDeque<f32>>>,
    deafened: Arc<AtomicBool>,
) -> Result<Stream> {
    let channels = config.channels as usize;
    let error = |_error| {};
    let stream = match format {
        SampleFormat::F32 => device.build_output_stream(
            *config,
            move |data: &mut [f32], _| fill_output(data, channels, &playback, &deafened, |value| value),
            error,
            None,
        )?,
        SampleFormat::I16 => device.build_output_stream(
            *config,
            move |data: &mut [i16], _| {
                fill_output(data, channels, &playback, &deafened, |value| {
                    (value.clamp(-1.0, 1.0) * i16::MAX as f32) as i16
                })
            },
            error,
            None,
        )?,
        SampleFormat::U16 => device.build_output_stream(
            *config,
            move |data: &mut [u16], _| {
                fill_output(data, channels, &playback, &deafened, |value| {
                    ((value.clamp(-1.0, 1.0) * 0.5 + 0.5) * u16::MAX as f32) as u16
                })
            },
            error,
            None,
        )?,
        _ => return Err(anyhow!("formato de saída não suportado: {format:?}")),
    };
    Ok(stream)
}

fn fill_output<T: Copy>(
    output: &mut [T],
    channels: usize,
    playback: &Mutex<VecDeque<f32>>,
    deafened: &AtomicBool,
    convert: impl Fn(f32) -> T,
) {
    let silence = convert(0.0);
    if channels == 0 || deafened.load(Ordering::Relaxed) {
        output.fill(silence);
        return;
    }
    let Ok(mut queue) = playback.lock() else {
        output.fill(silence);
        return;
    };
    for frame in output.chunks_mut(channels) {
        let value = convert(queue.pop_front().unwrap_or(0.0));
        frame.fill(value);
    }
}

fn resample(source: &[f32], from: u32, to: u32) -> Vec<f32> {
    if source.is_empty() || from == to || from == 0 || to == 0 {
        return source.to_vec();
    }
    let output_length = source.len() * to as usize / from as usize;
    (0..output_length)
        .map(|index| {
            let position = index as f64 * from as f64 / to as f64;
            let left = position.floor() as usize;
            let right = (left + 1).min(source.len() - 1);
            let fraction = (position - left as f64) as f32;
            source[left] * (1.0 - fraction) + source[right] * fraction
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::resample;

    #[test]
    fn resamples_audio_without_losing_the_signal() {
        let result = resample(&[0.0, 1.0, 0.0, -1.0], 4, 8);
        assert_eq!(result.len(), 8);
        assert!(result.iter().any(|sample| *sample > 0.5));
    }
}
