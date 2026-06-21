export interface DashRepresentation {
  id: string;
  mimeType: string;
  codecs: string;
  bandwidth: number;
  sampleRate: number;
}

export interface DashManifest {
  audioRepresentations: DashRepresentation[];
}

export class TidalDashManifestParser {
  parse(manifestXml: string): DashManifest {
    const manifest: DashManifest = { audioRepresentations: [] };

    // Simple XML parser — walk the DASH MPD tree
    const mpdMatch = manifestXml.match(/<MPD[^>]*>([\s\S]*?)<\/MPD>/i);
    if (!mpdMatch) return manifest;

    const periodMatch = mpdMatch[1].match(/<Period[^>]*>([\s\S]*?)<\/Period>/i);
    if (!periodMatch) return manifest;

    const adaptationSets = periodMatch[1].matchAll(/<AdaptationSet[^>]*>([\s\S]*?)<\/AdaptationSet>/gi);
    for (const adaptationSet of adaptationSets) {
      const contentTypeMatch = adaptationSet[0].match(/contentType\s*=\s*"([^"]+)"/i);
      if (!contentTypeMatch || contentTypeMatch[1] !== 'audio') continue;

      const representations = adaptationSet[1].matchAll(/<Representation\s+([^>]*)\/?>/gi);
      for (const rep of representations) {
        const repAttrs = rep[1];
        const idMatch = repAttrs.match(/id\s*=\s*"([^"]+)"/i);
        const mimeMatch = repAttrs.match(/mimeType\s*=\s*"([^"]+)"/i);
        const codecsMatch = repAttrs.match(/codecs\s*=\s*"([^"]+)"/i);
        const bandwidthMatch = repAttrs.match(/bandwidth\s*=\s*"(\d+)"/i);
        const sampleRateMatch = repAttrs.match(/audioSamplingRate\s*=\s*"(\d+)"/i);

        manifest.audioRepresentations.push({
          id: idMatch?.[1] || '',
          mimeType: mimeMatch?.[1] || '',
          codecs: codecsMatch?.[1] || '',
          bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0,
          sampleRate: sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 0,
        });
      }
    }

    return manifest;
  }

  getBestQualityUrl(manifestXml: string, preferredCodec = 'flac'): string | null {
    const manifest = this.parse(manifestXml);

    const candidates = manifest.audioRepresentations
      .filter(r => r.mimeType.toLowerCase().includes(preferredCodec.toLowerCase()))
      .sort((a, b) => b.bandwidth - a.bandwidth);

    return candidates.length > 0 ? candidates[0].id : null;
  }
}
