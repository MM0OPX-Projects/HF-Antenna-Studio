/** Parametric End-Fed Half-Wave template shared by Design and Wire Editor. */
import type { AntennaTemplate, WireGeometry, Excitation, FeedpointData, FrequencyRange } from "./types";
import { autoSegment } from "../engine/segmentation";
import { MAX_FREQUENCY_MHZ, MIN_FREQUENCY_MHZ } from "../engine/limits";

const C_MHZ_M = 300;
const ORIENTATION = { horizontal: 0, sloper: 1, invertedV: 2, vertical: 3 } as const;
const INVERTED_V_MODE = { classic: 0, advanced: 1 } as const;
function value(p: Record<string, number>, k: string, fallback: number) { return Number.isFinite(p[k]) ? p[k]! : fallback; }
function pointAt(s: [number,number,number], length: number, bearingDeg: number, elevationDeg: number): [number,number,number] {
  const b = bearingDeg*Math.PI/180, e = elevationDeg*Math.PI/180, h = length*Math.cos(e);
  return [s[0]+h*Math.cos(b), s[1]+h*Math.sin(b), s[2]+length*Math.sin(e)];
}
function makeWire(tag: number, start: [number,number,number], end: [number,number,number], length: number, radius: number, maxFreq: number): WireGeometry {
  const actual = Math.max(length, 0.01);
  return { tag, segments: Math.max(3, autoSegment(actual, maxFreq, 21)), x1:start[0], y1:start[1], z1:start[2], x2:end[0], y2:end[1], z2:end[2], radius };
}
function endpoint(w: WireGeometry, end: "a"|"b"): [number,number,number] { return end === "a" ? [w.x1,w.y1,w.z1] : [w.x2,w.y2,w.z2]; }

export const efhwTemplate: AntennaTemplate = {
  id: "efhw", name: "End-Fed Half-Wave", nameShort: "EFHW",
  description: "Parametric end-fed half-wave for horizontal, sloper, inverted-V or vertical installations.",
  longDescription: "An EFHW is a half-wave radiator excited at one terminal through a high-impedance transformer. Geometry, return path and ground are explicit modelling choices; the generated half-wave length is only a starting dimension and should be tuned for the actual installation.",
  icon: "—~", category: "wire", difficulty: "beginner",
  bands: ["80m","40m","20m","15m","10m"], defaultGround: { type:"average" },
  defaultMatching: { type:"unun", ratio:49, feedlineZ0:50 },
  tips: [
    "The half-wave dimension is a starting value; nearby ground, supports and the return path change resonance.",
    "Feed end A or B may be selected. The marker and NEC source follow the selected terminal.",
    "The transformer is an ideal impedance transformation; transformer losses and common-mode current are not solved.",
    "An end-fed model needs a physically meaningful counterpoise, feed line or other return path.",
    "For an inverted-V, the apex is an electrical junction and the feed remains at a terminal end."
  ],
  relatedTemplates: ["dipole","inverted-v","vertical"],
  validateParameters(params) {
    const frequency=value(params,"frequency",7.1), lambda=C_MHZ_M/frequency;
    const length=value(params,"length_mode",0)===1 ? value(params,"total_length",lambda*0.5*0.97) : lambda*0.5*0.97;
    const orientation=Math.round(value(params,"orientation",1));
    const endA=Math.max(0.05,value(params,"feed_height",10));
    const endB=Math.max(0.05,value(params,"far_end_height",3));
    const issues: import("./types").TemplateParameterIssue[]=[];
    if (orientation===ORIENTATION.sloper && Math.abs(endB-endA)>=length) issues.push({severity:"error",code:"efhw-sloper-height-span",message:`The ${(Math.abs(endB-endA)).toFixed(2)} m height difference must be less than the ${length.toFixed(2)} m wire length.`});
    if (orientation===ORIENTATION.invertedV) {
      const apex=value(params,"apex_height",12);
      if (Math.round(value(params,"inverted_v_mode",0))===INVERTED_V_MODE.classic) {
        const included=value(params,"included_angle",120)*Math.PI/180;
        const terminalHeight=apex-(length/2)*Math.cos(included/2);
        if (terminalHeight<=0) issues.push({severity:"error",code:"efhw-classic-below-ground",message:"This apex height and included angle place the symmetric inverted-V ends at or below ground. Raise the apex or increase the included angle."});
      } else {
        const ratio=Math.min(0.9,Math.max(0.1,value(params,"apex_position",50)/100)), legA=length*ratio, legB=length-legA;
        if (apex<=endA || apex<=endB) issues.push({severity:"error",code:"efhw-apex-not-highest",message:"The inverted-V apex must be higher than both terminal ends."});
        if (apex-endA>=legA || apex-endB>=legB) issues.push({severity:"error",code:"efhw-leg-height-span",message:"An inverted-V leg is too short to reach its requested endpoint height. Increase total length, lower an end, or change the apex position share."});
      }
    }
    if (orientation===ORIENTATION.vertical && value(params,"feed_end",0)>=0.5) issues.push({severity:"warning",code:"efhw-top-feed-return",message:"Top-feeding the vertical places the explicit return path at the upper terminal. Confirm this represents the intended physical feed system."});
    if (value(params,"counterpoise_enabled",1)<0.5) issues.push({severity:"warning",code:"efhw-no-return-path",message:"No explicit counterpoise is present. An EFHW still requires a feed line, counterpoise, ground or another physically meaningful return path."});
    if (value(params,"counterpoise_enabled",1)>=0.5 && value(params,"counterpoise_length",2.1)<lambda*0.005) issues.push({severity:"warning",code:"efhw-short-counterpoise",message:"The counterpoise is shorter than 0.005λ; feed impedance may be dominated by the omitted feed system and environment."});
    return issues;
  },
  summarizeParameters(params) {
    if (Math.round(value(params,"orientation",1))!==ORIENTATION.invertedV) return [];
    const frequency=value(params,"frequency",7.1), lambda=C_MHZ_M/frequency;
    const length=value(params,"length_mode",0)===1?value(params,"total_length",lambda*0.5*0.97):lambda*0.5*0.97;
    const apex=value(params,"apex_height",12);
    if (Math.round(value(params,"inverted_v_mode",0))===INVERTED_V_MODE.classic) {
      const angle=value(params,"included_angle",120), terminalHeight=apex-(length/2)*Math.cos(angle*Math.PI/360);
      return [`Classic symmetric geometry · equal ${(length/2).toFixed(3)} m legs`, `Derived End A / End B height: ${terminalHeight.toFixed(3)} m`, `Actual included angle: ${angle.toFixed(1)}°`];
    }
    const ratio=Math.min(0.9,Math.max(0.1,value(params,"apex_position",50)/100)), legA=length*ratio, legB=length-legA;
    const dropA=apex-value(params,"feed_height",10), dropB=apex-value(params,"far_end_height",3);
    const hA=Math.sqrt(Math.max(0,legA*legA-dropA*dropA)), hB=Math.sqrt(Math.max(0,legB*legB-dropB*dropB));
    const cosine=Math.max(-1,Math.min(1,(-hA*hB+dropA*dropB)/(legA*legB)));
    const actual=Math.acos(cosine)*180/Math.PI;
    return [`Advanced asymmetric geometry · legs ${legA.toFixed(3)} / ${legB.toFixed(3)} m`, `Derived actual included angle: ${actual.toFixed(1)}°`, `Leg droop below horizontal: ${(Math.asin(dropA/legA)*180/Math.PI).toFixed(1)}° / ${(Math.asin(dropB/legB)*180/Math.PI).toFixed(1)}°`];
  },
  parameters: [
    {key:"frequency",label:"Design Frequency",description:"Fundamental frequency for the starting half-wave dimension",unit:"MHz",min:0.5,max:MAX_FREQUENCY_MHZ,step:0.1,defaultValue:7.1,decimals:3},
    {key:"orientation",label:"Orientation",description:"How the continuous EFHW is arranged",unit:"",min:0,max:3,step:1,defaultValue:1,decimals:0,options:[{value:0,label:"Horizontal"},{value:1,label:"Sloper"},{value:2,label:"Inverted-V"},{value:3,label:"Vertical"}]},
    {key:"feed_end",label:"Feed End",description:"Terminal excited by the NEC voltage source",unit:"",min:0,max:1,step:1,defaultValue:0,decimals:0,options:[{value:0,label:"End A"},{value:1,label:"End B"}]},
    {key:"length_mode",label:"Length",description:"Use the frequency-derived starting length or a manual dimension",unit:"",min:0,max:1,step:1,defaultValue:0,decimals:0,options:[{value:0,label:"Frequency-derived"},{value:1,label:"Manual"}]},
    {key:"total_length",label:"Manual Total Length",description:"Total radiating wire length when Manual is selected",unit:"m",min:1,max:100,step:0.01,defaultValue:(C_MHZ_M/7.1)*0.5*0.97,decimals:3,visibleWhen:p=>value(p,"length_mode",0)===1},
    {key:"inverted_v_mode",label:"Inverted-V Geometry",description:"Classic derives equal end heights from a true included angle; Advanced derives the angle from independently entered heights",unit:"",min:0,max:1,step:1,defaultValue:0,decimals:0,options:[{value:0,label:"Classic symmetric"},{value:1,label:"Advanced asymmetric"}],visibleWhen:p=>Math.round(value(p,"orientation",1))===ORIENTATION.invertedV},
    {key:"feed_height",label:"End A / Base Height",description:"End A height for sloper/advanced inverted-V, horizontal height, or vertical base height",unit:"m",min:0.05,max:100,step:0.1,defaultValue:10,decimals:2,visibleWhen:p=>Math.round(value(p,"orientation",1))!==ORIENTATION.invertedV||Math.round(value(p,"inverted_v_mode",0))===INVERTED_V_MODE.advanced},
    {key:"far_end_height",label:"End B Height",description:"End B height for a sloper or advanced asymmetric inverted-V",unit:"m",min:0.05,max:100,step:0.1,defaultValue:3,decimals:2,visibleWhen:p=>Math.round(value(p,"orientation",1))===ORIENTATION.sloper||(Math.round(value(p,"orientation",1))===ORIENTATION.invertedV&&Math.round(value(p,"inverted_v_mode",0))===INVERTED_V_MODE.advanced)},
    {key:"apex_height",label:"Inverted-V Apex Height",description:"Height of the junction between the two inverted-V legs",unit:"m",min:0.05,max:100,step:0.1,defaultValue:12,decimals:2,visibleWhen:p=>Math.round(value(p,"orientation",1))===ORIENTATION.invertedV},
    {key:"apex_position",label:"Apex Position",description:"Percentage of total wire length from End A to the apex",unit:"%",min:10,max:90,step:1,defaultValue:50,decimals:0,visibleWhen:p=>Math.round(value(p,"orientation",1))===ORIENTATION.invertedV&&Math.round(value(p,"inverted_v_mode",0))===INVERTED_V_MODE.advanced},
    {key:"included_angle",label:"True Included Angle",description:"Physical angle between equal legs in the vertical antenna plane",unit:"deg",min:60,max:180,step:1,defaultValue:120,decimals:0,visibleWhen:p=>Math.round(value(p,"orientation",1))===ORIENTATION.invertedV&&Math.round(value(p,"inverted_v_mode",0))===INVERTED_V_MODE.classic},
    {key:"bearing",label:"Bearing",description:"Bearing from the apex toward End B (or from End A toward End B for straight arrangements)",unit:"deg",min:0,max:359,step:1,defaultValue:90,decimals:0,visibleWhen:p=>Math.round(value(p,"orientation",1))!==ORIENTATION.vertical},
    {key:"wire_diameter",label:"Wire Diameter",description:"Conductor diameter",unit:"mm",min:0.5,max:20,step:0.1,defaultValue:1,decimals:1},
    {key:"counterpoise_enabled",label:"Counterpoise",description:"Add an explicit return wire at the selected feed terminal",unit:"",min:0,max:1,step:1,defaultValue:1,decimals:0,options:[{value:1,label:"Enabled"},{value:0,label:"Disabled"}]},
    {key:"counterpoise_length",label:"Counterpoise Length",description:"Length of the explicit return wire",unit:"m",min:0.01,max:50,step:0.01,defaultValue:2.1,decimals:2,visibleWhen:p=>value(p,"counterpoise_enabled",1)>=0.5},
    {key:"counterpoise_bearing",label:"Counterpoise Bearing",description:"Horizontal direction of the return wire",unit:"deg",min:0,max:359,step:1,defaultValue:0,decimals:0,visibleWhen:p=>value(p,"counterpoise_enabled",1)>=0.5}
  ],
  generateGeometry(params) {
    const frequency=value(params,"frequency",7.1), lambda=C_MHZ_M/frequency;
    const length=value(params,"length_mode",0)===1 ? value(params,"total_length",lambda*0.5*0.97) : lambda*0.5*0.97;
    const orientation=Math.round(value(params,"orientation",1)), bearing=value(params,"bearing",90), radius=value(params,"wire_diameter",1)/2000, maxFreq=frequency*1.15;
    let wires: WireGeometry[], feedPoint: [number,number,number];
    if (orientation===ORIENTATION.invertedV) {
      const apexHeight=Math.max(0.05,value(params,"apex_height",10)), apex:[number,number,number]=[0,0,apexHeight];
      const classic=Math.round(value(params,"inverted_v_mode",0))===INVERTED_V_MODE.classic;
      const ratio=classic?0.5:Math.min(0.9,Math.max(0.1,value(params,"apex_position",50)/100)), legA=length*ratio, legB=length-legA;
      let elevationA:number,elevationB:number;
      if (classic) {
        const included=Math.max(60,Math.min(180,value(params,"included_angle",120)));
        const droop=(180-included)/2;
        elevationA=-droop;
        elevationB=-droop;
      } else {
        const endAHeight=Math.max(0.05,value(params,"feed_height",10)), endBHeight=Math.max(0.05,value(params,"far_end_height",3));
        elevationA=Math.asin(Math.max(-1,Math.min(1,(endAHeight-apexHeight)/legA)))*180/Math.PI;
        elevationB=Math.asin(Math.max(-1,Math.min(1,(endBHeight-apexHeight)/legB)))*180/Math.PI;
      }
      // A classic inverted-V is planar: horizontal projections point in
      // opposite directions along the selected bearing axis.
      const endA=pointAt(apex,legA,bearing+180,elevationA);
      const endB=pointAt(apex,legB,bearing,elevationB);
      wires=[makeWire(1,endA,apex,legA,radius,maxFreq),makeWire(2,apex,endB,legB,radius,maxFreq)];
      feedPoint=value(params,"feed_end",0)<0.5?endA:endB;
    } else if (orientation===ORIENTATION.vertical) {
      const bottom:[number,number,number]=[0,0,Math.max(0.05,value(params,"feed_height",1))], top:[number,number,number]=[0,0,bottom[2]+length];
      wires=[makeWire(1,bottom,top,length,radius,maxFreq)]; feedPoint=value(params,"feed_end",0)<0.5?bottom:top;
    } else {
      const endA:[number,number,number]=[0,0,Math.max(0.05,value(params,"feed_height",10))];
      const endBHeight=orientation===ORIENTATION.horizontal?endA[2]:Math.max(0.05,value(params,"far_end_height",3)), dz=endBHeight-endA[2];
      const horizontal=Math.sqrt(Math.max(0,length*length-Math.min(length*length,dz*dz)));
      const endB=pointAt(endA,length,bearing,Math.atan2(dz,Math.max(0.01,horizontal))*180/Math.PI);
      wires=[makeWire(1,endA,endB,length,radius,maxFreq)]; feedPoint=value(params,"feed_end",0)<0.5?endA:endB;
    }
    if (value(params,"counterpoise_enabled",1)>=0.5) {
      const cpLength=Math.max(0.01,value(params,"counterpoise_length",lambda*0.05)), end=pointAt(feedPoint,cpLength,value(params,"counterpoise_bearing",bearing+180),0);
      wires.push(makeWire(99,feedPoint,end,cpLength,radius,maxFreq));
    }
    return wires;
  },
  generateExcitation(params,wires): Excitation {
    const endB=value(params,"feed_end",0)>=0.5, radiator=wires.filter(w=>w.tag!==99), feedWire=endB?radiator[radiator.length-1]!:radiator[0]!;
    return {wire_tag:feedWire.tag,segment:endB?feedWire.segments:1,voltage_real:1,voltage_imag:0,position_ratio:endB?1:0};
  },
  generateFeedpoints(params,wires): FeedpointData[] {
    const endB=value(params,"feed_end",0)>=0.5, radiator=wires.filter(w=>w.tag!==99), feedWire=endB?radiator[radiator.length-1]!:radiator[0]!;
    return [{position:endpoint(feedWire,endB?"b":"a"),wireTag:feedWire.tag}];
  },
  defaultFrequencyRange(params): FrequencyRange {
    const frequency=value(params,"frequency",7.1), bandwidth=frequency*0.1;
    return {start_mhz:Math.max(MIN_FREQUENCY_MHZ,frequency-bandwidth/2),stop_mhz:Math.min(MAX_FREQUENCY_MHZ,frequency+bandwidth/2),steps:31};
  }
};
