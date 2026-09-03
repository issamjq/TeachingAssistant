// The public face of the materials feature. Other features import from
// here, never from a file inside — see the no-restricted-imports rule.
export {
  listMaterials,
  updateMaterial,
  deleteMaterial,
  uploadMaterial,
  setMaterialClasses,
  extractMaterial,
  extractPending,
  materialLabel,
  MAX_BYTES,
  type Material,
  type Attachment,
} from "./api";
export { default as MaterialPicker } from "./MaterialPicker";
export { default as MaterialsView } from "./MaterialsView";
