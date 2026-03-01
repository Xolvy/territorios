import { PDFDocument, PDFRawStream, PDFArray } from 'pdf-lib';
import fs from 'fs';

const cleanPdf = async (inputFile, outputFile) => {
    const doc = await PDFDocument.load(fs.readFileSync(inputFile));
    const pages = doc.getPages();
    for (const page of pages) {
        const { Contents } = page.node.normalizedEntries();
        if (!Contents) continue;

        const contentsArr = Contents instanceof PDFArray ? Contents.asArray() : [Contents];

        for (const ref of contentsArr) {
            const stream = doc.context.lookup(ref);
            if (stream && stream instanceof PDFRawStream) {
                const contentStr = Buffer.from(stream.contents).toString('utf-8');
                const cleaned = contentStr.replace(/BT[\s\S]*?ET/g, 'BT ET');
                stream.contents = new Uint8Array(Buffer.from(cleaned, 'utf-8'));
            }
        }
    }
    fs.writeFileSync(outputFile, await doc.save());
    console.log('Cleaned', outputFile);
};

await cleanPdf('public/p_conductores.pdf', 'public/p_conductores_clean.pdf');
await cleanPdf('public/p_publicadores.pdf', 'public/p_publicadores_clean.pdf');
