import { NextRequest, NextResponse } from 'next/server';

// Simple ZIP implementation (no external dependencies)
class SimpleZip {
  private files: { name: string; content: Buffer }[] = [];

  addFile(name: string, content: string | Buffer) {
    this.files.push({
      name,
      content: typeof content === 'string' ? Buffer.from(content) : content,
    });
  }

  generate(): Buffer {
    const localFileHeaders: Buffer[] = [];
    const centralDirectory: Buffer[] = [];
    let offset = 0;

    for (const file of this.files) {
      const filename = Buffer.from(file.name, 'utf8');
      const content = file.content;
      
      // Local file header
      const localHeader = Buffer.alloc(30 + filename.length);
      localHeader.writeUInt32LE(0x04034b50, 0); // Signature
      localHeader.writeUInt16LE(20, 4); // Version needed
      localHeader.writeUInt16LE(0, 6); // General purpose bit flag
      localHeader.writeUInt16LE(0, 8); // Compression method (store)
      localHeader.writeUInt16LE(0, 10); // File last mod time
      localHeader.writeUInt16LE(0, 12); // File last mod date
      localHeader.writeUInt32LE(this.crc32(content), 14); // CRC-32
      localHeader.writeUInt32LE(content.length, 18); // Compressed size
      localHeader.writeUInt32LE(content.length, 22); // Uncompressed size
      localHeader.writeUInt16LE(filename.length, 26); // Filename length
      localHeader.writeUInt16LE(0, 28); // Extra field length
      filename.copy(localHeader, 30);

      localFileHeaders.push(localHeader);
      localFileHeaders.push(content);
      localFileHeaders.push(filename);

      // Central directory header
      const centralHeader = Buffer.alloc(46 + filename.length);
      centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
      centralHeader.writeUInt16LE(20, 4); // Version made by
      centralHeader.writeUInt16LE(20, 6); // Version needed
      centralHeader.writeUInt16LE(0, 8); // General purpose bit flag
      centralHeader.writeUInt16LE(0, 10); // Compression method
      centralHeader.writeUInt16LE(0, 12); // File last mod time
      centralHeader.writeUInt16LE(0, 14); // File last mod date
      centralHeader.writeUInt32LE(this.crc32(content), 16); // CRC-32
      centralHeader.writeUInt32LE(content.length, 20); // Compressed size
      centralHeader.writeUInt32LE(content.length, 24); // Uncompressed size
      centralHeader.writeUInt16LE(filename.length, 28); // Filename length
      centralHeader.writeUInt16LE(0, 30); // Extra field length
      centralHeader.writeUInt16LE(0, 32); // File comment length
      centralHeader.writeUInt16LE(0, 34); // Disk number start
      centralHeader.writeUInt16LE(0, 36); // Internal file attributes
      centralHeader.writeUInt32LE(0, 38); // External file attributes
      centralHeader.writeUInt32LE(offset, 42); // Relative offset of local header
      filename.copy(centralHeader, 46);

      centralDirectory.push(centralHeader);
      
      offset += 30 + filename.length + content.length;
    }

    const centralDirOffset = offset;
    const centralDirBuffers = Buffer.concat(centralDirectory);
    offset += centralDirBuffers.length;

    // End of central directory
    const endOfCentralDir = Buffer.alloc(22);
    endOfCentralDir.writeUInt32LE(0x06054b50, 0); // Signature
    endOfCentralDir.writeUInt16LE(0, 4); // Disk number
    endOfCentralDir.writeUInt16LE(0, 6); // Disk with central directory
    endOfCentralDir.writeUInt16LE(this.files.length, 8); // Entries on disk
    endOfCentralDir.writeUInt16LE(this.files.length, 10); // Total entries
    endOfCentralDir.writeUInt32LE(centralDirBuffers.length, 12); // Central directory size
    endOfCentralDir.writeUInt32LE(centralDirOffset, 16); // Central directory offset
    endOfCentralDir.writeUInt16LE(0, 20); // Comment length

    return Buffer.concat([
      ...localFileHeaders,
      centralDirBuffers,
      endOfCentralDir,
    ]);
  }

  private crc32(data: Buffer): number {
    let crc = 0xffffffff;
    const table = this.getCRC32Table();
    
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
    }
    
    return (crc ^ 0xffffffff) >>> 0;
  }

  private getCRC32Table(): number[] {
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table.push(c);
    }
    return table;
  }
}

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

    // Generate ZIP
    const zip = new SimpleZip();
    
    for (const file of files) {
      // Create directory structure
      const path = file.path;
      zip.addFile(path, file.content);
    }

    const zipBuffer = zip.generate();

    return new NextResponse(new Uint8Array(zipBuffer), {
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
