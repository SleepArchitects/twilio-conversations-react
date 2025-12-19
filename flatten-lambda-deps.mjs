import { readdir, cp, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const serverDir = '.open-next/server-functions/default/node_modules';
const pnpmDir = join(serverDir, '.pnpm');

async function flattenDeps() {
  console.log('🔄 Flattening pnpm dependencies for Lambda...');
  
  // Read all pnpm modules
  const pnpmPackages = await readdir(pnpmDir);
  
  let copied = 0;
  for (const pkg of pnpmPackages) {
    const pkgPath = join(pnpmDir, pkg, 'node_modules');
    if (!existsSync(pkgPath)) continue;
    
    const modules = await readdir(pkgPath);
    for (const mod of modules) {
      if (mod === '.bin') continue;
      
      const targetPath = join(serverDir, mod);
      const sourcePath = join(pkgPath, mod);
      
      // Only copy if not already exists at root
      if (!existsSync(targetPath)) {
        await mkdir(join(serverDir, mod.split('/')[0]), { recursive: true });
        await cp(sourcePath, targetPath, { recursive: true, force: false });
        copied++;
        console.log(`  ✓ ${mod}`);
      }
    }
  }
  
  console.log(`✅ Flattened ${copied} packages`);
}

flattenDeps().catch(console.error);
