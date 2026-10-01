import type { Village } from "./types";

/**
 * Demo villages. The names and coordinates are fictional placeholders
 * clustered around a single rural block so that the map has something
 * meaningful to show; they do not represent real surveillance units.
 */
export const VILLAGES: Village[] = [
  { name: "Rampur", block: "North Block", lat: 26.9124, lng: 75.7873 },
  { name: "Govindpur", block: "East Block", lat: 26.8956, lng: 75.8234 },
  { name: "Lakshmipur", block: "North Block", lat: 26.9345, lng: 75.7654 },
  { name: "Chandanpur", block: "South Block", lat: 26.8789, lng: 75.8012 },
  { name: "Narayanpur", block: "North Block", lat: 26.9456, lng: 75.789 },
  { name: "Sunderpur", block: "South Block", lat: 26.8678, lng: 75.8123 },
  { name: "Devpur", block: "East Block", lat: 26.9234, lng: 75.8345 },
  { name: "Kamalpur", block: "South Block", lat: 26.889, lng: 75.7789 },
];

export const VILLAGE_NAMES = VILLAGES.map((village) => village.name);
