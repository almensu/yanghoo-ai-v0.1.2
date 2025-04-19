declare module 'webvtt-parser' {
  export class Parser {
    parse(input: string): {
      cues: WebVTTCue[];
      regions: any[];
      stylesheet: {
        styles: any[];
      };
    };
  }

  export class WebVTTCue {
    id: string;
    pauseOnExit: boolean;
    startTime: number;
    endTime: number;
    text: string;
    tree: any;
    type: string;
    track: any;
    regionId: string;
    vertical: string;
    snapToLines: boolean;
    line: number;
    position: number;
    size: number;
    align: string;

    constructor();
  }
} 