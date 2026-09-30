use std::env;
use std::fs::File;
use std::path::Path;
use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::errors::Error;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, TrackType};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;

fn try_decode(path: &Path) -> Result<(String, u64, u32), String> {
    let file = File::open(path).map_err(|e| format!("open: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let mut format = symphonia::default::get_probe()
        .probe(&hint, mss, FormatOptions::default(), MetadataOptions::default())
        .map_err(|e| format!("probe: {e}"))?;
    let track = format
        .default_track(TrackType::Audio)
        .ok_or_else(|| "no audio track".to_string())?;
    let codec_params = track
        .codec_params
        .as_ref()
        .ok_or_else(|| "codec parameters missing".to_string())?;
    let audio_params = codec_params
        .audio()
        .ok_or_else(|| "no audio codec params".to_string())?;
    let codec_name = format!("{:?}", audio_params.codec);
    let sample_rate = audio_params.sample_rate.unwrap_or(0);
    let track_id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(audio_params, &AudioDecoderOptions::default())
        .map_err(|e| format!("decoder create: {e}"))?;
    let mut frames: u64 = 0;
    loop {
        let packet = match format.next_packet() {
            Ok(Some(p)) => p,
            Ok(None) => break,
            Err(Error::ResetRequired) => break,
            Err(Error::IoError(_)) => break,
            Err(Error::DecodeError(_)) => continue,
            Err(e) => return Err(format!("packet: {e}")),
        };
        if packet.track_id != track_id {
            continue;
        }
        match decoder.decode(&packet) {
            Ok(audio) => {
                frames += audio.frames() as u64;
            }
            Err(Error::DecodeError(_)) | Err(Error::IoError(_)) => continue,
            Err(e) => return Err(format!("decode: {e}")),
        }
        if frames > sample_rate as u64 * 30 {
            break;
        }
    }
    if frames == 0 {
        return Err("decoded zero frames".to_string());
    }
    Ok((codec_name, frames, sample_rate))
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() {
        eprintln!("usage: g12c-decoder-proof <file>...");
        std::process::exit(2);
    }
    for a in args {
        let p = Path::new(&a);
        let name = p.file_name().and_then(|s| s.to_str()).unwrap_or(&a);
        match try_decode(p) {
            Ok((codec, frames, sr)) => {
                println!("PASS\t{name}\tcodec={codec}\tframes={frames}\tsample_rate={sr}");
            }
            Err(e) => {
                println!("UNSUPPORTED\t{name}\terror={e}");
            }
        }
    }
}
