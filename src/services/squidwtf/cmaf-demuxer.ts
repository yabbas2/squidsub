export class CmafDemuxer {
  private static readonly FTYP_MARKER = Buffer.from([0x66, 0x74, 0x79, 0x70]); // 'ftyp'
  private static readonly MOOV_MARKER = Buffer.from([0x6D, 0x6F, 0x6F, 0x76]); // 'moov'
  private static readonly MDAT_MARKER = Buffer.from([0x6D, 0x64, 0x61, 0x74]); // 'mdat'
  private static readonly STSD_MARKER = Buffer.from([0x73, 0x74, 0x73, 0x64]); // 'stsd'
  private static readonly FLAC_MARKER = Buffer.from([0x66, 0x4C, 0x61, 0x43]); // 'fLaC'

  extractFlacFromMp4(mp4Data: Buffer): Buffer {
    // Try to find raw fLaC marker
    const flacPos = this.findSequence(mp4Data, CmafDemuxer.FLAC_MARKER);
    if (flacPos >= 0) {
      return mp4Data.subarray(flacPos);
    }

    // Try to find STSD atom with FLAC descriptor
    const stsdPos = this.findBox(mp4Data, CmafDemuxer.STSD_MARKER);
    if (stsdPos < 0) {
      throw new Error('No STSD atom found in CMAF file');
    }

    const boxSize = this.readBoxSize(mp4Data, stsdPos);
    const descriptionData = mp4Data.subarray(stsdPos + 8, stsdPos + boxSize);

    // Find DFxFF marker (FLAC header marker in MP4)
    const dfffMarker = Buffer.from([0xDF, 0xFF]);
    const dfffPos = this.findSequence(descriptionData, dfffMarker);
    if (dfffPos < 0 || dfffPos + 4 >= descriptionData.length) {
      throw new Error('No FLAC header marker found in STSD');
    }

    const flacDataLength = descriptionData.readInt32BE(dfffPos + 4);
    if (flacDataLength <= 0 || dfffPos + 8 + flacDataLength > descriptionData.length) {
      throw new Error('Invalid FLAC data length in STSD');
    }

    return descriptionData.subarray(dfffPos + 8, dfffPos + 8 + flacDataLength);
  }

  isCmafWithFlac(data: Buffer): boolean {
    return (
      this.findSequence(data, CmafDemuxer.FTYP_MARKER) >= 0 &&
      this.findSequence(data, CmafDemuxer.MOOV_MARKER) >= 0 &&
      this.findSequence(data, CmafDemuxer.MDAT_MARKER) >= 0
    );
  }

  private findSequence(data: Buffer, pattern: Buffer): number {
    for (let i = 0; i <= data.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (data[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  }

  private findBox(data: Buffer, type: Buffer): number {
    for (let i = 0; i <= data.length - 8; i++) {
      if (
        data[i + 4] === type[0] && data[i + 5] === type[1] &&
        data[i + 6] === type[2] && data[i + 7] === type[3]
      ) {
        return i;
      }
    }
    return -1;
  }

  private readBoxSize(data: Buffer, offset: number): number {
    return data.readUInt32BE(offset);
  }
}
