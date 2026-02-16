const fs = require('fs');
const path = require('path');

async function main() {
  const spritesDir = path.join(__dirname, '..', 'assets', 'sprites');
  if (!fs.existsSync(spritesDir)) {
    console.log('No sprites folder found at', spritesDir);
    return;
  }

  let sharp;
  try {
    sharp = require('sharp');
  } catch (err) {
    console.log('Optional dependency `sharp` not installed. Install it to enable optimization:');
    console.log('  npm install --save-dev sharp');
    return;
  }

  const files = fs.readdirSync(spritesDir).filter(f => f.endsWith('.png'));
  for (const f of files) {
    const full = path.join(spritesDir, f);
    const out = path.join(spritesDir, `opt_${f}`);
    try {
      await sharp(full).png({ quality: 80 }).toFile(out);
      console.log('Optimized', f, '->', out);
    } catch (e) {
      console.warn('Failed to optimize', f, e.message);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
