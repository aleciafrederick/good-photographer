# PyInstaller spec for GoodPhotographer processor (single executable).
# Run from processor/: pyinstaller -y processor.spec

import os
import cv2

block_cipher = None

# Bundle OpenCV cascade XMLs so they work when frozen (same layout as cv2.data.haarcascades)
cv2_haar = getattr(cv2.data, 'haarcascades', None) or os.path.join(os.path.dirname(cv2.__file__), 'data')
datas = [(cv2_haar, 'cv2/data')]

spec_dir = os.path.dirname(os.path.abspath(SPECPATH))

a = Analysis(
    ['run_processor.py'],
    pathex=[spec_dir],
    binaries=[],
    datas=datas,
    hiddenimports=['cv2', 'numpy', 'PIL', 'PIL._tkinter_finder'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='processor',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
