import { describe, expect, it } from 'vitest';
import { buildGeoPlaceGraph } from './site';

describe('buildGeoPlaceGraph', () => {
  it('uses dedicated state and region paths in Place nodes', () => {
    const graph = buildGeoPlaceGraph({
      currentPath: '/de/rottal-inn/stubenberg/test-item',
      currentName: 'Stubenberg',
      countryName: 'Deutschland',
      countryPath: '/region/de',
      stateName: 'Bayern',
      statePath: '/region/de/bayern',
      regionName: 'Niederbayern',
      regionPath: '/region/de/bayern/niederbayern',
      districtName: 'Rottal-Inn',
      districtPath: '/region/de/bayern/niederbayern/rottal-inn',
      municipalityName: 'Stubenberg',
      municipalityPath: '/region/de/bayern/niederbayern/rottal-inn/stubenberg'
    });

    const stateNode = graph.nodes.find((node) => node['@id'] === 'https://culoca.com/region/de/bayern#place-state');
    const regionNode = graph.nodes.find(
      (node) => node['@id'] === 'https://culoca.com/region/de/bayern/niederbayern#place-region'
    );
    const districtNode = graph.nodes.find(
      (node) => node['@id'] === 'https://culoca.com/region/de/bayern/niederbayern/rottal-inn#place-district'
    );

    expect(stateNode).toMatchObject({
      '@type': 'Place',
      name: 'Bayern',
      url: 'https://culoca.com/region/de/bayern'
    });
    expect(regionNode).toMatchObject({
      '@type': 'Place',
      name: 'Niederbayern',
      url: 'https://culoca.com/region/de/bayern/niederbayern'
    });
    expect(districtNode).toMatchObject({
      '@type': 'Place',
      name: 'Rottal-Inn',
      url: 'https://culoca.com/region/de/bayern/niederbayern/rottal-inn'
    });
  });
});
