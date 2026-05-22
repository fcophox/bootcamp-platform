const fs = require('fs');
const path = require('path');

const DESIGN_MD_PATH = path.join(__dirname, '..', 'Design.MD');
const GLOBALS_CSS_PATH = path.join(__dirname, '..', 'app', 'globals.css');

function parseDesignTokens() {
    if (!fs.existsSync(DESIGN_MD_PATH)) {
        console.error(`❌ Error: No se encontró Design.MD en: ${DESIGN_MD_PATH}`);
        return null;
    }

    const content = fs.readFileSync(DESIGN_MD_PATH, 'utf8');
    
    // Regex para capturar filas de la tabla de variables CSS
    // Formato: | --variable | valor_oscuro | valor_claro | descripción |
    const rowRegex = /^\s*\|\s*`?(--[a-zA-Z0-9-_]+)`?\s*\|\s*`?([^|`]+?)`?\s*\|\s*`?([^|`]+?)`?\s*\|/gm;
    
    const darkTokens = [];
    const lightTokens = [];
    
    let match;
    while ((match = rowRegex.exec(content)) !== null) {
        const variable = match[1].trim();
        const darkVal = match[2].trim();
        const lightVal = match[3].trim();
        
        // Ignorar encabezados de tabla de ejemplo
        if (variable === '--background' && darkVal === 'Modo Oscuro (Dark)') continue;
        if (variable === 'Variable CSS') continue;
        
        darkTokens.push(`  ${variable}: ${darkVal};`);
        lightTokens.push(`  ${variable}: ${lightVal};`);
    }
    
    return { darkTokens, lightTokens };
}

function syncStyles() {
    const tokens = parseDesignTokens();
    if (!tokens || tokens.darkTokens.length === 0) {
        console.log('⚠️ No se encontraron tokens válidos en Design.MD para sincronizar.');
        return false;
    }

    if (!fs.existsSync(GLOBALS_CSS_PATH)) {
        console.error(`❌ Error: No se encontró globals.css en: ${GLOBALS_CSS_PATH}`);
        return false;
    }

    let cssContent = fs.readFileSync(GLOBALS_CSS_PATH, 'utf8');

    // Formatear bloques CSS
    const darkBlock = `/* DESIGN-TOKENS-DARK-START */\n:root {\n  color-scheme: dark;\n${tokens.darkTokens.join('\n')}\n}\n/* DESIGN-TOKENS-DARK-END */`;
    const lightBlock = `/* DESIGN-TOKENS-LIGHT-START */\n[data-theme='light'] {\n  color-scheme: light;\n${tokens.lightTokens.join('\n')}\n}\n/* DESIGN-TOKENS-LIGHT-END */`;

    // Reemplazar secciones usando marcadores
    const darkRegex = /\/\*\s*DESIGN-TOKENS-DARK-START\s*\*\/[\s\S]*?\/\*\s*DESIGN-TOKENS-DARK-END\s*\*\//;
    const lightRegex = /\/\*\s*DESIGN-TOKENS-LIGHT-START\s*\*\/[\s\S]*?\/\*\s*DESIGN-TOKENS-LIGHT-END\s*\*\//;

    if (!darkRegex.test(cssContent) || !lightRegex.test(cssContent)) {
        console.error('❌ Error: No se encontraron los comentarios marcadores en globals.css.');
        console.log('Asegúrate de tener /* DESIGN-TOKENS-DARK-START */ y /* DESIGN-TOKENS-DARK-END */ en tu globals.css');
        return false;
    }

    cssContent = cssContent.replace(darkRegex, darkBlock);
    cssContent = cssContent.replace(lightRegex, lightBlock);

    fs.writeFileSync(GLOBALS_CSS_PATH, cssContent, 'utf8');
    console.log(`✨ Sincronización exitosa: ${tokens.darkTokens.length} estilos actualizados en globals.css`);
    return true;
}

// Ejecutar sincronización inicial
console.log('🔄 Iniciando sincronización de estilos desde Design.MD...');
syncStyles();

// Activar modo escucha si se pasa el flag --watch
if (process.argv.includes('--watch')) {
    console.log(`👀 Escuchando cambios en Design.MD de forma activa...`);
    
    let timeoutId;
    fs.watch(DESIGN_MD_PATH, (eventType) => {
        if (eventType === 'change') {
            // Debounce para evitar múltiples lecturas rápidas al guardar el archivo
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                console.log('📝 Cambio detectado en Design.MD. Sincronizando...');
                syncStyles();
            }, 100);
        }
    });
}
