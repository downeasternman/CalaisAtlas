/**
 * Build an MBTiles archive from named GeoJSON layers using geojson-vt + vt-pbf,
 * then convert to PMTiles with the local go-pmtiles binary.
 */
import { spawnSync } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import geojsonvt from "geojson-vt";
import vtpbf from "vt-pbf";
import initSqlJs from "sql.js";
import { ROOT, TILES_DIR, ensureDirs } from "../etl/paths";

export type LayerInput = {
  name: string;
  geojson: GeoJSON.FeatureCollection;
  minZoom?: number;
  maxZoom?: number;
};

function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z,
  );
}

function bboxTiles(
  bbox: [number, number, number, number],
  z: number,
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const [west, south, east, north] = bbox;
  const xMin = Math.max(0, lngToTileX(west, z));
  const xMax = Math.min(2 ** z - 1, lngToTileX(east, z));
  const yMin = Math.max(0, latToTileY(north, z));
  const yMax = Math.min(2 ** z - 1, latToTileY(south, z));
  return { xMin, xMax, yMin, yMax };
}

function tmsY(z: number, y: number): number {
  return 2 ** z - 1 - y;
}

export async function buildPmtilesFromLayers(options: {
  outputName: string;
  layers: LayerInput[];
  minZoom: number;
  maxZoom: number;
  bbox: [number, number, number, number];
  attribution: string;
  description: string;
}): Promise<string> {
  await ensureDirs(TILES_DIR, path.join(ROOT, "data", "processed", "mbtiles"));

  const indexes = options.layers.map((layer) => ({
    name: layer.name,
    minZoom: layer.minZoom ?? options.minZoom,
    maxZoom: layer.maxZoom ?? options.maxZoom,
    index: geojsonvt(layer.geojson, {
      maxZoom: layer.maxZoom ?? options.maxZoom,
      indexMaxZoom: layer.maxZoom ?? options.maxZoom,
      indexMaxPoints: 0,
      tolerance: 2,
      extent: 4096,
      buffer: 64,
    }),
  }));

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(ROOT, "node_modules", "sql.js", "dist", file),
  });
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE metadata (name TEXT, value TEXT);
    CREATE TABLE tiles (
      zoom_level INTEGER,
      tile_column INTEGER,
      tile_row INTEGER,
      tile_data BLOB
    );
    CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);
  `);

  const meta = [
    ["name", options.outputName],
    ["format", "pbf"],
    ["bounds", options.bbox.join(",")],
    ["minzoom", String(options.minZoom)],
    ["maxzoom", String(options.maxZoom)],
    ["attribution", options.attribution],
    ["description", options.description],
    ["type", "overlay"],
    ["version", "1"],
    [
      "json",
      JSON.stringify({
        vector_layers: options.layers.map((l) => ({
          id: l.name,
          description: l.name,
          minzoom: l.minZoom ?? options.minZoom,
          maxzoom: l.maxZoom ?? options.maxZoom,
          fields: {},
        })),
      }),
    ],
  ];

  const insertMeta = db.prepare("INSERT INTO metadata (name, value) VALUES (?, ?)");
  for (const [name, value] of meta) {
    insertMeta.run([name, value]);
  }
  insertMeta.free();

  const insertTile = db.prepare(
    "INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
  );

  let tileCount = 0;
  for (let z = options.minZoom; z <= options.maxZoom; z++) {
    const { xMin, xMax, yMin, yMax } = bboxTiles(options.bbox, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const layerMap: Record<string, object> = {};
        for (const layer of indexes) {
          if (z < layer.minZoom || z > layer.maxZoom) continue;
          const tile = layer.index.getTile(z, x, y);
          if (tile && tile.features.length > 0) {
            layerMap[layer.name] = tile;
          }
        }
        if (Object.keys(layerMap).length === 0) continue;
        const raw = Buffer.from(
          // vt-pbf types are loose across geojson-vt versions
          vtpbf.fromGeojsonVt(layerMap as never, { version: 2 }),
        );
        const gz = gzipSync(raw);
        insertTile.run([z, x, tmsY(z, y), gz]);
        tileCount++;
      }
    }
    console.log(`  z${z}: accumulated ${tileCount} tiles`);
  }
  insertTile.free();

  const mbtilesPath = path.join(
    ROOT,
    "data",
    "processed",
    "mbtiles",
    `${options.outputName}.mbtiles`,
  );
  const pmtilesPath = path.join(TILES_DIR, `${options.outputName}.pmtiles`);

  const data = db.export();
  db.close();
  await writeFile(mbtilesPath, Buffer.from(data));
  console.log(`  wrote ${mbtilesPath} (${tileCount} tiles)`);

  const pmtilesBin = path.join(ROOT, "tools", "pmtiles-bin", "pmtiles.exe");
  const convert = spawnSync(pmtilesBin, ["convert", mbtilesPath, pmtilesPath], {
    encoding: "utf8",
  });
  if (convert.status !== 0) {
    throw new Error(
      `pmtiles convert failed: ${convert.stderr || convert.stdout || "unknown error"}`,
    );
  }
  console.log(`  wrote ${pmtilesPath}`);

  try {
    await unlink(mbtilesPath);
  } catch {
    // keep mbtiles if cleanup fails
  }

  return pmtilesPath;
}

export async function readGeoJson(filePath: string): Promise<GeoJSON.FeatureCollection> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as GeoJSON.FeatureCollection;
}

export async function readBbox(
  filePath: string,
): Promise<[number, number, number, number]> {
  const raw = await readFile(filePath, "utf8");
  const data = JSON.parse(raw) as { bbox: [number, number, number, number] };
  return data.bbox;
}
