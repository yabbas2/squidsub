import { describe, it, expect } from 'vitest';
import { TidalDashManifestParser } from '../../../src/services/squidwtf/tidal-dash-parser.js';

describe('TidalDashManifestParser', () => {
  const parser = new TidalDashManifestParser();

  it('parse returns manifest with audio representations', () => {
    const xml = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet contentType="audio">
      <Representation id="rep1" mimeType="audio/flac" codecs="flac" bandwidth="1234000" audioSamplingRate="48000"/>
      <Representation id="rep2" mimeType="audio/mp4" codecs="mp4a.40.2" bandwidth="320000" audioSamplingRate="44100"/>
    </AdaptationSet>
    <AdaptationSet contentType="video">
      <Representation id="vid1" mimeType="video/mp4" bandwidth="5000000"/>
    </AdaptationSet>
  </Period>
</MPD>`;

    const manifest = parser.parse(xml);
    expect(manifest.audioRepresentations).toHaveLength(2);
  });

  it('parse filters by contentType', () => {
    const xml = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet contentType="audio">
      <Representation id="a1" mimeType="audio/flac" bandwidth="1000"/>
    </AdaptationSet>
    <AdaptationSet contentType="video">
      <Representation id="v1" mimeType="video/mp4" bandwidth="5000"/>
    </AdaptationSet>
  </Period>
</MPD>`;

    const manifest = parser.parse(xml);
    expect(manifest.audioRepresentations).toHaveLength(1);
  });

  it('parse returns empty for invalid xml', () => {
    const manifest = parser.parse('not xml');
    expect(manifest.audioRepresentations).toHaveLength(0);
  });

  it('getBestQualityUrl returns highest bandwidth flac', () => {
    const xml = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet contentType="audio">
      <Representation id="low" mimeType="audio/flac" bandwidth="500000"/>
      <Representation id="high" mimeType="audio/flac" bandwidth="2000000"/>
    </AdaptationSet>
  </Period>
</MPD>`;

    const id = parser.getBestQualityUrl(xml, 'flac');
    expect(id).toBe('high');
  });

  it('getBestQualityUrl returns null when no matching codec', () => {
    const xml = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet contentType="audio">
      <Representation id="aac" mimeType="audio/mp4" bandwidth="320000"/>
    </AdaptationSet>
  </Period>
</MPD>`;

    const id = parser.getBestQualityUrl(xml, 'flac');
    expect(id).toBeNull();
  });
});
