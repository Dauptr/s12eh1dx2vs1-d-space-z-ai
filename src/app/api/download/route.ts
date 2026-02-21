import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { files, projectName, type } = body;
  
  if (!files || !Array.isArray(files)) {
    return NextResponse.json({ error: 'Files array is required' }, { status: 400 });
  }

  try {
    if (type === 'html') {
      // Return single HTML file
      const mainFile = files.find((f: { path: string }) => f.path === 'index.html') || files[0];
      
      return new NextResponse(mainFile.content, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${projectName || 'index'}.html"`,
        },
      });
    }

    // Generate ZIP using a simple but correct implementation
    const zipData = createZip(files);
    const zipBuffer = Buffer.from(zipData);
    
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${projectName || 'project'}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Simple, correct ZIP implementation
function createZip(files: Array<{ path: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const fileData: Array<{
    name: Uint8Array;
    content: Uint8Array;
    crc: number;
    offset: number;
  }> = [];
  
  let offset = 0;
  const chunks: Uint8Array[] = [];

  // Calculate CRC32 table
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  // Calculate CRC32
  const crc32 = (data: Uint8Array): number => {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };

  // Write local file headers and data
  for (const file of files) {
    const name = encoder.encode(file.path);
    const content = encoder.encode(file.content);
    const crc = crc32(content);
    
    // Local file header (30 bytes + name)
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    
    view.setUint32(0, 0x04034B50, true);  // Signature
    view.setUint16(4, 20, true);          // Version needed
    view.setUint16(6, 0, true);           // General purpose flag
    view.setUint16(8, 0, true);           // Compression (store)
    view.setUint16(10, 0, true);          // Mod time
    view.setUint16(12, 0, true);          // Mod date
    view.setUint32(14, crc, true);        // CRC-32
    view.setUint32(18, content.length, true);  // Compressed size
    view.setUint32(22, content.length, true);  // Uncompressed size
    view.setUint16(26, name.length, true);     // Name length
    view.setUint16(28, 0, true);           // Extra length
    header.set(name, 30);
    
    chunks.push(header);
    chunks.push(content);
    
    fileData.push({ name, content, crc, offset });
    offset += header.length + content.length;
  }

  // Central directory
  const centralDirStart = offset;
  let centralDirSize = 0;

  for (const file of fileData) {
    const entry = new Uint8Array(46 + file.name.length);
    const view = new DataView(entry.buffer);
    
    view.setUint32(0, 0x02014B50, true);   // Signature
    view.setUint16(4, 20, true);           // Version made by
    view.setUint16(6, 20, true);           // Version needed
    view.setUint16(8, 0, true);            // General purpose flag
    view.setUint16(10, 0, true);           // Compression
    view.setUint16(12, 0, true);           // Mod time
    view.setUint16(14, 0, true);           // Mod date
    view.setUint32(16, file.crc, true);    // CRC-32
    view.setUint32(20, file.content.length, true);  // Compressed size
    view.setUint32(24, file.content.length, true);  // Uncompressed size
    view.setUint16(28, file.name.length, true);     // Name length
    view.setUint16(30, 0, true);           // Extra length
    view.setUint16(32, 0, true);           // Comment length
    view.setUint16(34, 0, true);           // Disk number
    view.setUint16(36, 0, true);           // Internal attributes
    view.setUint32(38, 0, true);           // External attributes
    view.setUint32(42, file.offset, true); // Local header offset
    entry.set(file.name, 46);
    
    chunks.push(entry);
    centralDirSize += entry.length;
  }

  // End of central directory
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  
  eocdView.setUint32(0, 0x06054B50, true);       // Signature
  eocdView.setUint16(4, 0, true);                // Disk number
  eocdView.setUint16(6, 0, true);                // Disk with central dir
  eocdView.setUint16(8, files.length, true);    // Entries on disk
  eocdView.setUint16(10, files.length, true);   // Total entries
  eocdView.setUint32(12, centralDirSize, true); // Central dir size
  eocdView.setUint32(16, centralDirStart, true);// Central dir offset
  eocdView.setUint16(20, 0, true);              // Comment length
  
  chunks.push(eocd);

  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return result;
}
