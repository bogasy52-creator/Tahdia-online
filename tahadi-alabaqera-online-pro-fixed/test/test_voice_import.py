"""Real WAV/MP3 pipeline checks. Sine fixtures are temporary test data, never a speech pack."""
import argparse
import array
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import tempfile
import unittest
import wave

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("voice_import", ROOT / "scripts/import-baloot-voices.py")
IMPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORT)


class VoiceImportTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="voice-import-test-")
        self.root = Path(self.temp.name) / "project"
        self.manifest = self.root / "public/assets/js/baloot-voice-pack.js"
        self.manifest.parent.mkdir(parents=True)
        self.original = (ROOT / "public/assets/js/baloot-voice-pack.js").read_bytes()
        self.manifest.write_bytes(self.original)
        self.recordings = Path(self.temp.name) / "recordings"
        self.recordings.mkdir()
        self.lines = IMPORT.catalog(self.manifest)
        self.args = argparse.Namespace(root=self.root, recordings=self.recordings, speaker="TEST FIXTURE — NOT HUMAN SPEECH", reviewed=True, dry_run=False)

    def tearDown(self):
        self.temp.cleanup()

    def fill(self, silent=False):
        pcm = array.array("h", [0 if silent else int(5000 * math.sin(i * math.tau * 440 / 48000)) for i in range(9600)])
        for key in self.lines:
            with wave.open(str(self.recordings / (key + ".wav")), "wb") as file:
                file.setparams((1, 2, 48000, 0, "NONE", "not compressed"))
                file.writeframes(pcm.tobytes())

    def unchanged(self):
        self.assertEqual(self.manifest.read_bytes(), self.original)
        self.assertFalse((self.root / "public/assets/audio").exists())

    def test_missing_files_do_not_change_project(self):
        with self.assertRaisesRegex(ValueError, "missing="):
            IMPORT.import_pack(self.args)
        self.unchanged()

    def test_approval_cannot_be_inferred_from_audio_validation(self):
        self.fill()
        self.args.reviewed = False
        with self.assertRaisesRegex(ValueError, "--reviewed"):
            IMPORT.import_pack(self.args)
        self.unchanged()

    def test_silence_is_rejected_before_any_project_write(self):
        self.fill(silent=True)
        with self.assertRaisesRegex(ValueError, "silent"):
            IMPORT.import_pack(self.args)
        self.unchanged()

    def test_complete_pack_converts_without_cutting_and_keeps_originals(self):
        self.fill()
        originals = {key: hashlib.sha256((self.recordings / (key + ".wav")).read_bytes()).hexdigest() for key in self.lines}
        report = IMPORT.import_pack(self.args)
        self.assertEqual(report["count"], 56)
        marker = "export const VOICE_PACK = Object.freeze("
        pack, _ = json.JSONDecoder().raw_decode(self.manifest.read_text().split(marker, 1)[1])
        self.assertTrue(pack["approved"])
        self.assertEqual(pack["kind"], "human")
        for key, clip in pack["recordings"].items():
            path = self.root / "public" / clip["src"].lstrip("/")
            self.assertTrue(path.is_file())
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), clip["sha256"])
            self.assertAlmostEqual(clip["seconds"], .2, delta=.005)
            self.assertEqual(hashlib.sha256((self.recordings / (key + ".wav")).read_bytes()).hexdigest(), originals[key])
        self.assertIn("release_refresh_required", report)


if __name__ == "__main__":
    unittest.main()
