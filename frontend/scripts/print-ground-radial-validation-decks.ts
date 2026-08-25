import { adaptIdealFinalToNec } from "../src/features/phased-arrays/nec-adapter";
import { generatePhasedArray, startingPhasedArrayModel, switchPhasedRadialRepresentation } from "../src/features/phased-arrays/model";
import { adaptVerticalToNec } from "../src/features/vertical-antennas/nec-adapter";
import { generateVerticalModel, startingVerticalModel } from "../src/features/vertical-antennas/model";
import { getTemplateDefinition } from "../src/features/antenna-templates/definitions";
import { adaptTemplateToNec } from "../src/features/antenna-templates/nec-adapter";
import { generateTemplateModel, initialTemplateParameters } from "../src/features/antenna-templates/model";

const vertical = startingVerticalModel(14_100_000, "ground-mounted-explicit-radials");
const verticalDeck = adaptVerticalToNec(generateVerticalModel(vertical)).deck;

const templateDefinition = getTemplateDefinition("quarter-wave-vertical");
const templateDeck = adaptTemplateToNec(
  generateTemplateModel(templateDefinition, initialTemplateParameters(templateDefinition), templateDefinition.defaultGround!, false).model,
  templateDefinition,
).deck;

const phased = switchPhasedRadialRepresentation(startingPhasedArrayModel(14_100_000), "near-surface-explicit-wires");
const phasedDeck = adaptIdealFinalToNec(generatePhasedArray(phased), [
  { real: 1, imag: 0 },
  { real: 1, imag: 0 },
]).deck;

console.log("--- vertical-surface-16radial-20m-real.nec ---");
console.log(verticalDeck);
console.log("--- template-surface-16radial-20m-real.nec ---");
console.log(templateDeck);
console.log("--- phased-shared-16radial-20m-real.nec ---");
console.log(phasedDeck);
