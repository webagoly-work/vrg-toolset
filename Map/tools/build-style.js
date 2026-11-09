#!/usr/bin/env node
// ---------------------------------------------------------------------------
// build-style.js — writes Map/style/terep.json, the "VRG Terep" map style:
// high-contrast field/day colours, hillshade, 3D buildings and terrain.
//
//   node Map/tools/build-style.js
//
// The layer structure comes from @protomaps/basemaps (BSD-3-Clause,
// (c) Protomaps LLC; Vendor/protomaps-basemaps, see vendor-manifest.json);
// the colours, the hillshade, the 3D buildings and the terrain are ours.
// URLs are written as "{origin}/..." and filled in by the page at load time,
// so the same file works from any port or host.
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const path = require('path');
const MAP = path.resolve(__dirname, '..');
const lib = require(path.join(MAP, '..', 'Vendor', 'protomaps-basemaps', 'dist', 'cjs', 'index.cjs'));

// VRG Terep: readable in sunlight. Darker building fills and casings than the stock
// light flavour, warm major roads, saturated water and green, near-black labels.
const terep = Object.assign({}, lib.namedFlavor('light'), {
  background: '#e9e5dc', earth: '#f1eee6',
  park_a: '#cfe5c4', park_b: '#a9d39a', wood_a: '#c4dcb5', wood_b: '#8fc27c',
  scrub_a: '#d3e3c6', scrub_b: '#a8cf96', hospital: '#f0d8d8', school: '#efe3cf',
  industrial: '#dcdbe3', pedestrian: '#ece6d6', military: '#dcd6cc', zoo: '#cfe3d6',
  water: '#6fb6dd', sand: '#efe6c8', beach: '#f1e7c4', aerodrome: '#dedfe6', runway: '#c9cad2',
  buildings: '#cdbfab',
  other: '#ffffff', minor_service: '#fbfaf7', minor_a: '#ffffff', minor_b: '#ffffff', link: '#ffe9b0',
  major: '#ffe29a', highway: '#ffc96b', railway: '#6d6a72', pier: '#d9d3c7',
  minor_service_casing: '#b9b1a4', minor_casing: '#a9a092', link_casing: '#c79a45',
  major_casing_early: '#c99a3f', major_casing_late: '#c99a3f',
  highway_casing_early: '#b77e22', highway_casing_late: '#b77e22',
  bridges_other: '#ffffff', bridges_minor: '#ffffff', bridges_link: '#ffe9b0', bridges_major: '#ffe29a', bridges_highway: '#ffc96b',
  bridges_other_casing: '#8f877a', bridges_minor_casing: '#8f877a', bridges_link_casing: '#a87a2c',
  bridges_major_casing: '#a87a2c', bridges_highway_casing: '#9a6a18',
  boundaries: '#8a7f95',
  roads_label_minor: '#3f3b36', roads_label_minor_halo: '#ffffff',
  roads_label_major: '#2e2a25', roads_label_major_halo: '#ffffff',
  subplace_label: '#4d4943', subplace_label_halo: '#f4f1ea',
  city_label: '#1f1d1a', city_label_halo: '#f4f1ea',
  state_label: '#6e6878', state_label_halo: '#f4f1ea', country_label: '#5e5868',
  address_label: '#5b4f43', address_label_halo: '#ffffff',
  landcover: {
    grassland: 'rgba(214, 233, 196, 1)', barren: 'rgba(240, 232, 208, 1)', urban_area: 'rgba(232, 227, 216, 1)',
    farmland: 'rgba(230, 236, 204, 1)', glacier: 'rgba(255, 255, 255, 1)', scrub: 'rgba(222, 232, 200, 1)',
    forest: 'rgba(184, 216, 170, 1)',
  },
});

const layers = lib.layers('protomaps', terep, { lang: 'hu' });

// Flat buildings fade out where the 3D ones take over.
for (const l of layers) {
  if (l.id === 'buildings') {
    l.paint['fill-opacity'] = ['interpolate', ['linear'], ['zoom'], 13, 0.55, 14.5, 0.8, 15, 0];
    l.paint['fill-outline-color'] = '#a8987f';
  }
  if (l.id === 'address_label') l.minzoom = 17.5;
}

// Hillshade right above the land cover, so roads and buildings stay crisp on top of it.
const hill = {
  id: 'hillshade', type: 'hillshade', source: 'hillshade', maxzoom: 17,
  paint: {
    'hillshade-shadow-color': '#5a5246', 'hillshade-highlight-color': '#fffaf0',
    'hillshade-accent-color': '#7d6f5a', 'hillshade-exaggeration': 0.35, 'hillshade-illumination-anchor': 'map',
  },
};
const at = layers.findIndex(l => l.id === 'landuse_park');
layers.splice(at < 0 ? 2 : at, 0, hill);

// 3D buildings. Protomaps v4 carries OSM height / min_height (levels x 3 m when only levels
// are mapped); unmapped buildings get 7 m so a street still reads as a street.
const b3d = {
  id: 'buildings-3d', type: 'fill-extrusion', source: 'protomaps', 'source-layer': 'buildings', minzoom: 14.5,
  filter: ['in', ['get', 'kind'], ['literal', ['building', 'building_part']]],
  paint: {
    'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'height'], 7],
      0, '#ddd2c2', 12, '#d2c4b0', 30, '#bfae96', 80, '#a9957a'],
    'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.2, ['coalesce', ['get', 'height'], 7]],
    'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
    'fill-extrusion-opacity': 0.92,
    'fill-extrusion-vertical-gradient': true,
  },
};
const lbl = layers.findIndex(l => l.type === 'symbol');
layers.splice(lbl < 0 ? layers.length : lbl, 0, b3d);

const style = {
  version: 8,
  name: 'VRG Terep',
  metadata: {
    'vrg:about': 'VRG Térkép field/day style. Built by Map/tools/build-style.js; do not edit by hand.',
    'vrg:attribution': 'Layer structure (c) Protomaps LLC, BSD-3-Clause (@protomaps/basemaps). Colours, hillshade and 3D by VRG.',
  },
  glyphs: '{origin}/data/fonts/{fontstack}/{range}.pbf',
  sprite: '{origin}/data/sprites/light',
  sources: {
    protomaps: {
      type: 'vector', url: 'pmtiles://{origin}/data/hungary.pmtiles',
      attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a>',
    },
    terrain: {
      type: 'raster-dem', url: 'pmtiles://{origin}/data/terrain.pmtiles', encoding: 'terrarium', tileSize: 512,
      attribution: '<a href="https://mapterhorn.com/attribution">Mapterhorn</a> (Copernicus GLO-30)',
    },
    // Same file, own source: MapLibre renders hillshade better when it does not share the 3D terrain source.
    hillshade: { type: 'raster-dem', url: 'pmtiles://{origin}/data/terrain.pmtiles', encoding: 'terrarium', tileSize: 512 },
  },
  terrain: { source: 'terrain', exaggeration: 1.25 },
  sky: {
    'sky-color': '#bcd6ea', 'horizon-color': '#efe9dc', 'fog-color': '#efe9dc',
    'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.85, 'atmosphere-blend': 0.6,
  },
  light: { anchor: 'map', position: [1.2, 210, 35], color: '#ffffff', intensity: 0.35 },
  layers,
};

fs.mkdirSync(path.join(MAP, 'style'), { recursive: true });
const out = path.join(MAP, 'style', 'terep.json');
fs.writeFileSync(out, JSON.stringify(style, null, 1) + '\n');
console.log('wrote ' + path.relative(process.cwd(), out) + ' (' + layers.length + ' layers)');
