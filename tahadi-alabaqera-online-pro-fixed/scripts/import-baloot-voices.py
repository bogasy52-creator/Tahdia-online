#!/usr/bin/env python3
"""Validate a complete reviewed human voice pack without trimming speech or changing speed."""
import argparse
import array
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def catalog(path):
    source = path.read_text(encoding="utf-8")
    marker = "export const VOICE_LINES = Object.freeze("
    if source.count(marker) != 1:
        raise ValueError("Cannot read the recording catalog")
    lines, _ = json.JSONDecoder().raw_decode(source.split(marker, 1)[1])
    if not isinstance(lines, dict) or len(lines) != 56:
        raise ValueError("The complete 56-call catalog is required")
    if any(not key.replace("_", "").isalnum() for key in lines):
        raise ValueError("Invalid recording identifier")
    return lines


def run(command):
    result = subprocess.run(command, capture_output=True, check=False)
    if result.returncode:
        raise ValueError("Audio conversion/inspection failed: " + result.stderr.decode(errors="replace")[-600:])
    return result.stdout


def measure(path):
    raw = run(["ffmpeg", "-v", "error", "-nostdin", "-f", "wav" if path.suffix == ".wav" else "mp3", "-i", str(path), "-vn", "-ac", "1",
               "-ar", "48000", "-t", "13", "-f", "f32le", "pipe:1"])
    samples = array.array("f")
    samples.frombytes(raw)
    if sys.byteorder != "little":
        samples.byteswap()
    if not samples or any(not math.isfinite(v) for v in samples):
        raise ValueError(path.name + ": invalid or empty audio")
    seconds = len(samples) / 48000
    peak = max(abs(v) for v in samples)
    rms = math.sqrt(sum(v * v for v in samples) / len(samples))
    if not .12 <= seconds <= 12:
        raise ValueError(path.name + ": duration must be between 0.12 and 12 seconds")
    if rms < .00001 or peak < .001:
        raise ValueError(path.name + ": recording is silent")
    return {"seconds": round(seconds, 6), "peak": round(peak, 6), "rms": round(rms, 6),
            "clipped_samples": sum(abs(v) >= .9999 for v in samples)}


def checked_paths(folder, lines):
    if not folder.is_dir():
        raise ValueError("The recordings directory does not exist")
    expected = {key + ".wav" for key in lines}
    actual = {p.name for p in folder.iterdir() if p.is_file() and p.suffix.lower() == ".wav"}
    missing, extra = sorted(expected - actual), sorted(actual - expected)
    if missing or extra:
        raise ValueError("Recording names do not match; missing=" + ", ".join(missing) + "; extra=" + ", ".join(extra))
    result = {}
    for key in lines:
        path = folder / (key + ".wav")
        if path.is_symlink() or not 44 <= path.stat().st_size <= 20 * 1024 * 1024:
            raise ValueError(path.name + ": invalid recording file")
        result[key] = path
    return result


def import_pack(args):
    root = args.root.resolve()
    module = root / "public/assets/js/baloot-voice-pack.js"
    if module.is_symlink():
        raise ValueError("The voice manifest must be a regular file")
    lines = catalog(module)
    paths = checked_paths(args.recordings.resolve(), lines)
    if not args.dry_run and not args.reviewed:
        raise ValueError("Listen to every recording and confirm --reviewed before installing")
    if not args.speaker.strip():
        raise ValueError("A speaker label is required")
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            raise ValueError(tool + " is required")
    fingerprint = hashlib.sha256(args.speaker.encode("utf-8"))
    original, output = {}, {}
    with tempfile.TemporaryDirectory(prefix="baloot-voice-check-") as temp:
        staged = Path(temp)
        for key, path in paths.items():
            metadata = json.loads(run(["ffprobe", "-v", "error", "-f", "wav", "-show_streams", "-show_format", "-of", "json", str(path)]))
            streams = metadata.get("streams", [])
            if len(streams) != 1 or streams[0].get("codec_type") != "audio" or not streams[0].get("codec_name", "").startswith("pcm_"):
                raise ValueError(path.name + ": supply a PCM WAV recording")
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            fingerprint.update((key + digest).encode("utf-8"))
            original[key] = {"sha256": digest, **measure(path)}
            dest = staged / (key + ".mp3")
            # Keep the complete take, natural pauses, speed and pitch unchanged.
            run(["ffmpeg", "-v", "error", "-nostdin", "-f", "wav", "-i", str(path), "-map_metadata", "-1",
                 "-vn", "-ac", "1", "-ar", "48000", "-codec:a", "libmp3lame", "-q:a", "2", str(dest)])
            measured = measure(dest)
            if abs(measured["seconds"] - original[key]["seconds"]) > .06:
                raise ValueError(path.name + ": converted duration changed unexpectedly")
            output[key] = {"text": lines[key], "seconds": measured["seconds"],
                           "sha256": hashlib.sha256(dest.read_bytes()).hexdigest()}
        pack_id = "human-" + fingerprint.hexdigest()[:16]
        for key in lines:
            output[key]["src"] = "/assets/audio/baloot-human/" + pack_id + "/" + key + ".mp3"
        pack = {"id": pack_id, "kind": "human", "approved": bool(args.reviewed),
                "voice": args.speaker.strip(), "recordings": output}
        report = {"pack_id": pack_id, "speaker": args.speaker.strip(), "reviewed": bool(args.reviewed),
                  "dry_run": args.dry_run, "count": len(output), "originals": original,
                  "clipping_warnings": [key for key in lines if original[key]["clipped_samples"]],
                  "note": "Automated checks cannot verify pronunciation, speaker identity or natural delivery."}
        if args.dry_run:
            return report
        audio_parent = root / "public/assets/audio/baloot-human"
        for parent in [audio_parent, *audio_parent.parents]:
            if parent == root.parent:
                break
            if parent.is_symlink():
                raise ValueError("Voice output directories must not be symbolic links")
        audio_parent.mkdir(parents=True, exist_ok=True)
        destination = audio_parent / pack_id
        if destination.exists():
            if destination.is_symlink() or not destination.is_dir():
                raise ValueError("An incompatible voice pack already uses this identifier")
            for key in lines:
                existing = destination / (key + ".mp3")
                if existing.is_symlink() or not existing.is_file() or hashlib.sha256(existing.read_bytes()).hexdigest() != output[key]["sha256"]:
                    raise ValueError("Existing voice pack differs; no files were replaced")
        else:
            staging = Path(tempfile.mkdtemp(prefix=".incoming-", dir=audio_parent))
            try:
                for key in lines:
                    shutil.copyfile(staged / (key + ".mp3"), staging / (key + ".mp3"))
                os.rename(staging, destination)
            finally:
                if staging.exists():
                    shutil.rmtree(staging)
        payload = "/* Human recording catalog. Updated atomically by import-baloot-voices.py. */\n"
        payload += "export const VOICE_LINES = Object.freeze(" + json.dumps(lines, ensure_ascii=False, indent=2) + ");\n"
        payload += "export const VOICE_PACK = Object.freeze(" + json.dumps(pack, ensure_ascii=False, indent=2) + ");\n"
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=module.parent, delete=False) as handle:
            manifest_temp = Path(handle.name)
            handle.write(payload)
        try:
            os.replace(manifest_temp, module)
        finally:
            manifest_temp.unlink(missing_ok=True)
        report["release_refresh_required"] = ["node scripts/build-offline.mjs", "node scripts/refresh-checksums.mjs"]
        return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--recordings", type=Path, required=True)
    parser.add_argument("--speaker", required=True)
    parser.add_argument("--reviewed", action="store_true", help="Confirm a human reviewed all 56 complete takes")
    parser.add_argument("--dry-run", action="store_true", help="Inspect and convert without changing the project")
    args = parser.parse_args()
    try:
        print(json.dumps(import_pack(args), ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print("Voice import failed: " + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
