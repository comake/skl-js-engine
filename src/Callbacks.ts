export interface Callbacks {
  /**
   * Callback run when a Verb starts being executed
   */
  onVerbStart?: (verb: string, args: Record<string, any>) => void;
  /**
   * Callback run when a Verb is finished being executed
   */
  onVerbEnd?: (verb: string, returnValue: Record<string, any>) => void;
}
