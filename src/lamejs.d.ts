declare module "lamejs" {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number);
    encodeBuffer(left: Int16Array, right?: Int16Array): Uint8Array;
    flush(): Uint8Array;
  }

  const lamejs: {
    readonly Mp3Encoder: typeof Mp3Encoder;
  };

  export = lamejs;
}

declare module "lamejs/src/js/MPEGMode.js" {
  const MPEGMode: {
    readonly STEREO: unknown;
    readonly JOINT_STEREO: unknown;
    readonly DUAL_CHANNEL: unknown;
    readonly MONO: unknown;
    readonly NOT_SET: unknown;
  };

  export = MPEGMode;
}

declare global {
  // eslint-disable-next-line no-var
  var MPEGMode: unknown;
  // eslint-disable-next-line no-var
  var Lame: {
    readonly LAME_MAXMP3BUFFER: number;
    readonly LAME_ID: number;
    readonly V9: number;
    readonly V8: number;
    readonly V7: number;
    readonly V6: number;
    readonly V5: number;
    readonly V4: number;
    readonly V3: number;
    readonly V2: number;
    readonly V1: number;
    readonly V0: number;
    readonly R3MIX: number;
    readonly STANDARD: number;
    readonly EXTREME: number;
    readonly INSANE: number;
    readonly STANDARD_FAST: number;
    readonly EXTREME_FAST: number;
    readonly MEDIUM: number;
    readonly MEDIUM_FAST: number;
  };
  // eslint-disable-next-line no-var
  var BitStream: {
    EQ(a: number, b: number): boolean;
    NEQ(a: number, b: number): boolean;
  };
}

export {};
