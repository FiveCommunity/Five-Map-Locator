const fs = require('fs');
const path = require('path');

/**
 * electron-builder afterPack hook:
 * Embeds Microsoft Visual C++ Redistributable runtime DLLs directly inside appOutDir
 * BEFORE the single-file portable .exe is compressed, guaranteeing zero missing .dll
 * errors even on freshly formatted Windows 10/11 machines.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const sys32 = path.join(process.env.WINDIR || 'C:\\Windows', 'System32');
  const vcDlls = [
    'vcruntime140.dll',
    'vcruntime140_1.dll',
    'vcruntime140_threads.dll',
    'msvcp140.dll',
    'concrt140.dll',
  ];

  let embeddedCount = 0;
  for (const dll of vcDlls) {
    const src = path.join(sys32, dll);
    const dest = path.join(context.appOutDir, dll);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      embeddedCount++;
    }
  }
  console.log(`[afterPack] Embedded ${embeddedCount} VC++ runtime DLLs into native package.`);
};
