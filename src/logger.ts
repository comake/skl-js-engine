export class Logger {
  private static instance: Logger;
  private isDebug: boolean;

  private constructor(isDebug: boolean) {
    this.isDebug = isDebug;
  }

  public static getInstance(isDebug?: boolean): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(isDebug ?? false);
    }
    return Logger.instance;
  }

  public log(...args: any[]): void {
    if (this.isDebug) {
      console.log(...args);
    }
  }
}
