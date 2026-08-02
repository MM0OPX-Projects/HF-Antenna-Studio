import { SPEED_OF_LIGHT_M_PER_S } from "../verified-dipole/model";
import type { AntennaTemplateDefinition, TemplateAntennaModel, TemplateValidationIssue } from "./schema";

export interface SegmentedTemplateWire {
  wireId: string;
  tag: number;
  segments: number;
  segmentLengthM: number;
}

export interface TemplateSegmentation {
  wires: SegmentedTemplateWire[];
  feed: { tag: number; segment: number };
  totalSegments: number;
  issues: TemplateValidationIssue[];
}

function oddAtLeast(value: number): number {
  const integer = Math.max(1, Math.ceil(value));
  return integer % 2 === 0 ? integer + 1 : integer;
}

export function segmentTemplateModel(model: TemplateAntennaModel, definition: AntennaTemplateDefinition): TemplateSegmentation {
  const wavelengthM = SPEED_OF_LIGHT_M_PER_S / model.frequencyHz;
  const issues: TemplateValidationIssue[] = [];
  const wires = model.wires.map((wire, index) => {
    const lengthM = Math.hypot(wire.endM.x - wire.startM.x, wire.endM.y - wire.startM.y, wire.endM.z - wire.startM.z);
    const desired = oddAtLeast(lengthM / (wavelengthM * definition.segmentation.maximumSegmentLengthWavelengths));
    const segments = Math.min(definition.segmentation.maximumSegmentsPerWire, Math.max(definition.segmentation.minimumSegmentsPerWire, desired));
    const segmentLengthM = lengthM / segments;
    if (segmentLengthM / wavelengthM > 0.05) issues.push({ severity: "error", code: "segments-too-long", message: `${wire.id} segments exceed 0.05 wavelength.` });
    else if (segmentLengthM / wavelengthM > definition.segmentation.maximumSegmentLengthWavelengths) issues.push({ severity: "warning", code: "segments-target", message: `${wire.id} could not meet the recommended segment-length target.` });
    if (segmentLengthM < wire.diameterM) issues.push({ severity: "error", code: "segments-radius", message: `${wire.id} segment length is shorter than its wire diameter.` });
    return { wireId: wire.id, tag: index + 1, segments, segmentLengthM };
  });
  const feedWire = wires.find((wire) => wire.wireId === model.feed.wireId);
  if (!feedWire) throw new Error("Cannot segment a missing feed wire.");
  const segment = Math.max(1, Math.min(feedWire.segments, Math.floor(model.feed.position * feedWire.segments) + 1));
  return { wires, feed: { tag: feedWire.tag, segment }, totalSegments: wires.reduce((sum, wire) => sum + wire.segments, 0), issues };
}
