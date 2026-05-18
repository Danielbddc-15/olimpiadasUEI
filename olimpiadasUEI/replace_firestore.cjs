const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function findAndReplace(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      findAndReplace(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // We want to replace 'firebase/firestore' with the correct relative path to 'src/api/firestoreCompat'
      if (content.includes('firebase/firestore') || content.includes('firebase/auth') || content.includes('react-firebase-hooks/auth')) {
        
        // Calculate relative depth to src/api
        const relativeToSrc = path.relative(path.dirname(fullPath), srcDir);
        const compatPath = relativeToSrc ? `${relativeToSrc}/api/firestoreCompat` : './api/firestoreCompat';
        // Normalize backslashes to forward slashes for imports
        const normalizedCompatPath = compatPath.replace(/\\/g, '/');

        content = content.replace(/['"]firebase\/firestore['"]/g, `"${normalizedCompatPath}"`);
        
        // Remove react-firebase-hooks/auth imports entirely, they shouldn't be used now
        // Or comment them out
        content = content.replace(/import .* from ['"]react-firebase-hooks\/auth['"];?/g, '// import removed');
        
        // Replace firebase/auth imports
        content = content.replace(/import .* from ['"]firebase\/auth['"];?/g, '// auth import removed');

        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  });
}

findAndReplace(srcDir);
console.log('Done!');
