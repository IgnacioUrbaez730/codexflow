const fs = require('fs');
const file = 'frontend/src/app/[subdomain]/settings/export/page.tsx';
let content = fs.readFileSync(file, 'utf8');
// Remove all occurrences of "use client"; (with or without spaces/newlines)
content = content.replace(/"use client";/g, '');
content = content.replace(/'use client';/g, '');
// Ensure it only has one at the top
content = '"use client";\n' + content.trim();
fs.writeFileSync(file, content);
console.log("File cleaned successfully.");
