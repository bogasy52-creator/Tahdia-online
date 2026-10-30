"""Build a verified sparse update against an actual installed project snapshot."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import zipfile

GENERATED = {'SHA256SUMS.txt', 'public/service-worker.js'}
IGNORED = {'.git', '.wrangler', 'node_modules', '__pycache__'}
TARGET = 'tahadi-alabaqera-online-pro-fixed'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def snapshot(root):
    files = {}
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if any(part in IGNORED for part in relative.parts):
            continue
        if path.is_symlink():
            raise ValueError('Symbolic links cannot be included: ' + str(relative))
        if not path.is_file():
            continue
        name = relative.as_posix()
        if '\\' in name or ':' in name:
            raise ValueError('Unsafe update path: ' + name)
        if name in GENERATED:
            continue
        if relative.parts[0] == '.github':
            raise ValueError('Workflow files require a separate repository update.')
        files[name] = path.read_bytes()
    return files


def release(files):
    package = json.loads(files['package.json'])
    version = package.get('version', '')
    if not isinstance(version, str) or not re.fullmatch(r'\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?', version):
        raise ValueError('A valid package.json release version is required.')
    return version


def build_patch(base, project, output):
    base, project, output = base.resolve(), project.resolve(), output.resolve()
    if not base.is_dir() or not project.is_dir():
        raise ValueError('Both project directories must exist.')
    if any(output.is_relative_to(folder) for folder in [base, project]):
        raise ValueError('Output ZIP must be outside both project directories.')
    old, new = snapshot(base), snapshot(project)
    previous, version = release(old), release(new)
    deleted = sorted(set(old) - set(new))
    if deleted:
        raise ValueError('Sparse updates cannot remove files; use an explicit migration or full release: ' + ', '.join(deleted))
    if old.get('wrangler.jsonc') != new.get('wrangler.jsonc'):
        raise ValueError('Deployed Worker settings must remain unchanged: wrangler.jsonc')
    payload = {name: data for name, data in new.items()
               if name != 'wrangler.jsonc' and (data != old.get(name) or name == 'package.json')}
    if len(payload) + 2 > 2000 or sum(map(len, payload.values())) > 149 * 1024 * 1024:
        raise ValueError('Patch exceeds the installed updater limits; prepare a compatible release package.')
    files = [{'path': name, 'sha256': digest(data), 'size_bytes': len(data),
              'previous_sha256': [digest(old[name]) if name in old else None]}
             for name, data in sorted(payload.items())]
    manifest = {'format': 'busraj-sparse-patch-v1', 'target': TARGET,
                'version': version, 'supported_versions': [previous],
                'generated_by_existing_ci': sorted(GENERATED), 'files': files}
    instructions = ('# باتش تحديث\n\nارفع هذا ZIP وحده إلى جذر المستودع وانتظر نجاح الفحص. '
                    'أُنشئ مقابل النسخة المثبتة ' + previous + ' لتحديثها إلى ' + version + '.\n'
                    'يُعاد إنشاء التخزين المؤقت والبصمات في سير التحديث. '
                    'إذا تغير ملف خارج النسخة الأساسية، يتوقف التطبيق لحفظ التعديل بدل استبداله.\n')
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.update-', suffix='.zip', dir=output.parent)
    os.close(fd)
    try:
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            archive.writestr('patch-manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
            archive.writestr('PATCH_INSTRUCTIONS_AR.md', instructions)
            for name, data in sorted(payload.items()):
                archive.writestr('game-patch/' + name, data)
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise ValueError('ZIP validation failed.')
        os.replace(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return {'file': str(output), 'files': len(files), 'bytes': output.stat().st_size,
            'version': version, 'supported_versions': [previous]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', required=True, type=Path, help='Actual installed project snapshot')
    parser.add_argument('--project', required=True, type=Path, help='Complete next project')
    parser.add_argument('--output', required=True, type=Path, help='ZIP outside both project directories')
    args = parser.parse_args()
    try:
        print(json.dumps(build_patch(args.base, args.project, args.output), ensure_ascii=False))
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, 'Patch not created: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
