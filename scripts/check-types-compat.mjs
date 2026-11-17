import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

// Owner: Lynx Lab. This restores an omitted upstream declaration, not an invented type.
if (new Date() >= new Date('2026-12-17T00:00:00Z')) {
    throw new Error('ReactLynx declaration compatibility exception expired; reassess upstream')
}
const manifest = JSON.parse(readFileSync('node_modules/@lynx-js/react/package.json', 'utf8'))
if (manifest.version !== '0.125.0')
    throw new Error('Reassess the ReactLynx declaration compatibility file')
// ReactLynx exports its own JSX namespace; the legacy React DOM augmentation conflicts.
// Remove this dev-only patch when upstream supports the two namespaces independently.
const lynxTypes = JSON.parse(readFileSync('node_modules/@lynx-js/types/package.json', 'utf8'))
const elementDeclaration = readFileSync(
    'node_modules/@lynx-js/types/types/common/element/element.d.ts'
)
if (
    lynxTypes.version !== '4.2.1' ||
    createHash('sha256').update(elementDeclaration).digest('hex') !==
        '1872ac77b2288842eacb04c43c297e54d0ff06b02b5ee01b3a6036635cfbc7d4'
) {
    throw new Error('Reassess the Lynx 4.2.1 legacy React JSX declaration patch')
}
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd())
const compatibility = resolve('types/reactlynx-0.125.d.ts')
const program = ts.createProgram(
    parsed.fileNames.filter((file) => resolve(file) !== compatibility),
    parsed.options
)
const diagnostics = ts.getPreEmitDiagnostics(program)
if (
    diagnostics.length === 0 ||
    diagnostics.some(
        (item) =>
            item.code !== 2304 ||
            !ts.flattenDiagnosticMessageText(item.messageText, ' ').includes('ElementNode')
    )
) {
    throw new Error(
        'Reassess compatibility declaration: negative control no longer isolates the missing ElementNode'
    )
}
console.log(
    'PASS negative control: unmodified ReactLynx declarations fail only on omitted ElementNode'
)
