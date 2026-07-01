const fs = require('fs');
const path = require('path');

// Ensure build directory exists
if (!fs.existsSync('build')) {
    fs.mkdirSync('build');
}

// Files to wrap
const cssFiles = ['styles.css', 'dark-mode.css'];
const jsFiles = ['tabs.js', 'manualIssues.js', 'app.js'];

console.log('Compiling assets for Google Apps Script...');

// Read template HTML file (check index2.html first, fallback to index.html)
let templatePath = 'index2.html';
if (!fs.existsSync(templatePath)) {
    templatePath = 'index.html';
}
if (!fs.existsSync(templatePath)) {
    console.error('Error: Neither index.html nor index2.html was found.');
    process.exit(1);
}
console.log(`Using ${templatePath} as template source...`);
let indexHtml = fs.readFileSync(templatePath, 'utf8');

// Inline stylesheet contents
const stylesContent = fs.readFileSync('styles.css', 'utf8');
const darkModeContent = fs.readFileSync('dark-mode.css', 'utf8');

// Inline script contents
const tabsContent = fs.readFileSync('tabs.js', 'utf8');
const manualIssuesContent = fs.readFileSync('manualIssues.js', 'utf8');
const appContent = fs.readFileSync('app.js', 'utf8');

// Replace stylesheet links with styles
indexHtml = indexHtml.replace(/<link rel="stylesheet" href="styles.css">/g, `<style>\n${stylesContent}\n</style>`);
indexHtml = indexHtml.replace(/<link rel="stylesheet" href="dark-mode.css">/g, `<style>\n${darkModeContent}\n</style>`);

// Replace script tags with scripts
indexHtml = indexHtml.replace(/<script src="tabs.js"><\/script>/g, `<script>\n${tabsContent}\n</script>`);
indexHtml = indexHtml.replace(/<script src="manualIssues.js"><\/script>/g, `<script>\n${manualIssuesContent}\n</script>`);
indexHtml = indexHtml.replace(/<script src="app.js"><\/script>/g, `<script>\n${appContent}\n</script>`);

// Write index.html to build folder and root folder
fs.writeFileSync(path.join('build', 'index.html'), indexHtml);
fs.writeFileSync('index.html', indexHtml);
console.log(`${templatePath} -> build/index.html and index.html compiled (fully inlined).`);

// Wrap and write CSS files as HTML
cssFiles.forEach(file => {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const baseName = path.basename(file, '.css');
        fs.writeFileSync(path.join('build', `${baseName}.html`), `<style>\n${content}\n</style>`);
        console.log(`${file} wrapped -> build/${baseName}.html`);
    }
});

// Wrap and write JS files as HTML
jsFiles.forEach(file => {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const baseName = path.basename(file, '.js');
        fs.writeFileSync(path.join('build', `${baseName}.html`), `<script>\n${content}\n</script>`);
        console.log(`${file} wrapped -> build/${baseName}.html`);
    }
});

// Copy Code.gs and appsscript.json if they exist
const extraFiles = ['Code.gs', 'appsscript.json'];
extraFiles.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join('build', file));
        console.log(`${file} copied -> build/${file}`);
    }
});

console.log('Build completed successfully! Deploy the contents of the "build" directory to Apps Script.');
