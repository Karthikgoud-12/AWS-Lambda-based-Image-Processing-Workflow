
export interface ProcessingOptions {
  size: 'thumbnail' | 'medium' | 'large';
  filter: 'none' | 'grayscale' | 'sepia' | 'invert';
}

export enum WorkflowStep {
  UPLOAD = 0,
  PROCESS = 1,
  MONITOR = 2,
  DONE = 3
}
